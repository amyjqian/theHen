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
        if (lastIntervention.lastIntervention && (now - lastIntervention.lastIntervention < 60000)) {
            return; // Cooldown 1 min
        }

        triggerIntervention(activeTabId, activeDomain, totalDuration, data.persona);
    }
}

async function triggerIntervention(tabId, domain, duration, persona) {
    if (!persona) return; // User hasn't set up yet

    // Mock message generation (LLM placeholder)
    const minutes = Math.floor(duration / 60000);
    const message = `You've spent ${minutes} minutes on ${domain}. ${persona.catchphrases[0]}`;

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

    // Log intervention
    await chrome.storage.session.set({ lastIntervention: Date.now() });

    const stats = await chrome.storage.local.get(['stats']);
    const currentStats = stats.stats || { interventionsToday: 0 };
    currentStats.interventionsToday++;
    await chrome.storage.local.set({ stats: currentStats });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CLOSE_TAB' && sender.tab) {
        chrome.tabs.remove(sender.tab.id);
    }
});
