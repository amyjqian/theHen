let activeTabId = null;
let activeDomain = null;
let startTime = null;
const CHECK_INTERVAL_ALARMS = 'check_activity';

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(CHECK_INTERVAL_ALARMS, { periodInMinutes: 0.5 }); // Check every 30s
});

// Track Tab Activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await handleTabChange(activeInfo.tabId);
});

// Track URL Changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId === activeTabId && changeInfo.url) {
        await handleTabChange(tabId);
    }
});

// Periodic Check (Rule Engine)
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === CHECK_INTERVAL_ALARMS) {
        await checkRules();
    }
});

async function handleTabChange(tabId) {
    // 1. Commit time for previous domain
    if (activeDomain && startTime) {
        const duration = Date.now() - startTime;
        await updateTimeSpent(activeDomain, duration);
    }

    // 2. Set new active tab info
    activeTabId = tabId;
    const tab = await chrome.tabs.get(tabId).catch(() => null);

    if (tab && tab.url && tab.url.startsWith('http')) {
        try {
            const url = new URL(tab.url);
            activeDomain = url.hostname;
            startTime = Date.now();
        } catch (e) {
            activeDomain = null;
            startTime = null;
        }
    } else {
        activeDomain = null;
        startTime = null;
    }
}

async function updateTimeSpent(domain, durationMs) {
    const data = await chrome.storage.local.get(['activityLog']);
    const log = data.activityLog || {};
    const today = new Date().toDateString();

    if (!log[today]) log[today] = {};
    if (!log[today][domain]) log[today][domain] = 0;

    log[today][domain] += durationMs;

    await chrome.storage.local.set({ activityLog: log });
}

async function checkRules() {
    if (!activeDomain || !startTime) return;

    // Add current session time to stored time for accurate checking
    const currentSessionDuration = Date.now() - startTime;
    const data = await chrome.storage.local.get(['activityLog', 'userSettings', 'persona']);
    const log = data.activityLog || {};
    const today = new Date().toDateString();
    const storedDuration = (log[today] && log[today][activeDomain]) || 0;
    const totalDuration = storedDuration + currentSessionDuration;

    // Simple hardcoded categories for prototype
    const socialSites = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'reddit.com', 'tiktok.com'];
    const isSocial = socialSites.some(site => activeDomain.includes(site));

    // Threshold: 15 minutes (900,000 ms) for social sites
    // For demo purposes, let's make it 30 seconds (30,000 ms) if user intensity is 'brutal' or 'firm'
    // Or just 15 mins normally. 
    // Let's use 10 seconds for easier testing.
    const threshold = 10 * 1000; // 10 seconds for testing

    if (isSocial && totalDuration > threshold) {
        // Check if we already intervened recently to avoid spam
        const lastIntervention = await chrome.storage.session.get(['lastIntervention']);
        const now = Date.now();
        // Cooldown: 15 seconds for testing (was 60000)
        if (lastIntervention.lastIntervention && (now - lastIntervention.lastIntervention < 10000)) {
            console.log('Intervention cooling down...');
            return;
        }

        console.log('TRIGGERING INTERVENTION');
        triggerIntervention(activeTabId, activeDomain, totalDuration, data.persona);
    }
}

async function triggerIntervention(tabId, domain, duration, persona) {
    if (!persona) return;

    const data = await chrome.storage.local.get(['userSettings']);
    const settings = data.userSettings;

    let message;
    const minutes = Math.floor(duration / 60000);

    // Use LLM if API Key exists and isn't 'mock'
    if (settings && settings.apiKey && settings.apiKey.startsWith('sk-')) {
        try {
            message = await generateInterventionMessage(persona, domain, minutes, settings);
        } catch (e) {
            console.error('LLM Gen Failed:', e);
            message = `You've spent ${minutes} minutes on ${domain}. ${persona.catchphrases[0]}`;
        }
    } else {
        // Fallback / Mock
        message = `You've spent ${minutes} minutes on ${domain}. ${persona.catchphrases[0]}`;
    }

    // Send message to Content Script
    chrome.tabs.sendMessage(tabId, {
        action: 'SHOW_INTERVENTION',
        data: {
            personaName: persona.name,
            message: message,
            tone: persona.tone
        }
    }).catch(() => {
        // Tab might be closed or not ready
    });

    // Log intervention, stats...
    await chrome.storage.session.set({ lastIntervention: Date.now() });

    const stats = await chrome.storage.local.get(['stats']);
    const currentStats = stats.stats || { interventionsToday: 0 };
    currentStats.interventionsToday++;
    await chrome.storage.local.set({ stats: currentStats });
}

async function generateInterventionMessage(persona, domain, minutes, settings) {
    const prompt = `
    You are ${persona.name}, an accountability partner.
    Tone: ${persona.tone}.
    User Identity Goal: ${settings.identity}.
    User Weakness: ${settings.weakness}.
    
    The user has been on ${domain} for ${minutes} minutes.
    
    Generate a 1-2 sentence intervention message.
    It should be ${settings.intensity} in intensity.
    Refer to their identity goal to guilt/motivate them.
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${settings.apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "openai/gpt-3.5-turbo",
            "messages": [
                { "role": "system", "content": "You are a concise accountability coach." },
                { "role": "user", "content": prompt }
            ]
        })
    });

    if (!response.ok) throw new Error('API Error');
    const json = await response.json();
    return json.choices[0].message.content;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CLOSE_TAB' && sender.tab) {
        // If they complied by closing via our button, reset the cooldown
        // so if they come back immediately, we get them again.
        chrome.storage.session.remove(['lastIntervention']);
        chrome.tabs.remove(sender.tab.id);
    }
});
