document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const onboardingView = document.getElementById('onboarding-view');
  const dashboardView = document.getElementById('dashboard-view');
  const saveBtn = document.getElementById('save-settings');
  const resetBtn = document.getElementById('reset-settings');
  const loadingState = document.getElementById('loading-state');

  // Inputs
  const identityInput = document.getElementById('identity');
  const goalInput = document.getElementById('goal');
  const weaknessInput = document.getElementById('weakness');
  const motivationSelect = document.getElementById('motivation');
  const intensitySelect = document.getElementById('intensity');
  const apiKeyInput = document.getElementById('apikey');

  // Dashboard Elements
  const personaNameEl = document.getElementById('persona-name');
  const personaTaglineEl = document.getElementById('persona-tagline');
  const personaInitialsEl = document.getElementById('persona-initials');
  const interventionCountEl = document.getElementById('intervention-count');

  // Load state
  const data = await chrome.storage.local.get(['userSettings', 'persona', 'stats']);

  if (data.userSettings && data.persona) {
    showDashboard(data.persona, data.stats);
  } else {
    showOnboarding();
  }

  // Event Listeners
  saveBtn.addEventListener('click', handleSave);
  resetBtn.addEventListener('click', handleReset);

  function showOnboarding() {
    onboardingView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }

  function showDashboard(persona, stats) {
    onboardingView.classList.add('hidden');
    dashboardView.classList.remove('hidden');

    personaNameEl.textContent = persona.name;
    personaTaglineEl.textContent = persona.catchphrases ? persona.catchphrases[0] : 'Watching you.';
    personaInitialsEl.textContent = persona.name.substring(0, 2).toUpperCase();

    if (stats) {
      interventionCountEl.textContent = stats.interventionsToday || 0;

      const total = stats.interventionsToday || 0;
      const complied = stats.interventionsComplied || 0;
      let rate = 100;

      if (total > 0) {
        rate = Math.round((complied / total) * 100);
      }

      document.getElementById('compliance-rate').textContent = `${rate}%`;
    }
  }

  async function handleSave() {
    const identity = identityInput.value.trim();
    const goal = goalInput.value.trim();
    const weakness = weaknessInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!identity || !apikey) {
      alert('Please fill in your Identity and API Key.');
      return;
    }

    const settings = {
      identity,
      goal,
      weakness,
      motivation: motivationSelect.value,
      intensity: intensitySelect.value,
      apiKey
    };

    // Show loading state
    saveBtn.disabled = true;
    saveBtn.textContent = 'Summoning Partner...';

    try {
      // call Background to generate persona (keeping logic centralized or doing here?)
      // Doing here for immediate feedback, but background is better for safety usually. 
      // Popup closes if user clicks away, so let's do it here with await.
      const persona = await generatePersonaFromLLM(settings);

      // Save everything
      await chrome.storage.local.set({
        userSettings: settings,
        persona: persona,
        stats: { interventionsToday: 0 }
      });

      showDashboard(persona, { interventionsToday: 0 });
    } catch (e) {
      alert('Failed to generate persona: ' + e.message);
      console.error(e);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Generate My Partner';
    }
  }

  async function handleReset() {
    if (confirm('Are you sure you want to kill this persona and start over?')) {
      await chrome.storage.local.clear();
      // Clear inputs (visual reset)
      identityInput.value = '';
      goalInput.value = '';
      weaknessInput.value = '';
      // We might want to keep the API key for convenience, but clear method wipes it.
      showOnboarding();
    }
  }

  async function generatePersonaFromLLM(settings) {
    if (!settings.apiKey.startsWith('sk-')) {
      // Allow Mock if key is "mock" for testing logic without wasting tokens
      if (settings.apiKey === 'mock') return generateMockPersona(settings);
      throw new Error('Invalid API Key format');
    }

    const prompt = `
    You are an expert personalized accountability coach generator.
    Create a detailed persona based on this user profile:
    - Target Identity: "${settings.identity}"
    - Tactical Goal: "${settings.goal}"
    - Core Weakness: "${settings.weakness}"
    - Coaching Style: "${settings.motivation}"
    - Intensity Level: "${settings.intensity}"

    Return ONLY a JSON object with this structure:
    {
      "name": "Creative Name",
      "tone": "Description of tone",
      "catchphrases": ["Phrase 1", "Phrase 2", "Phrase 3"]
    }
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "openai/gpt-3.5-turbo", // Cost-effective default
        "messages": [
          { "role": "system", "content": "You are a creative JSON generator." },
          { "role": "user", "content": prompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API Error: ${err}`);
    }

    const json = await response.json();
    const content = json.choices[0].message.content;

    try {
      return JSON.parse(content);
    } catch (e) {
      // Fallback if LLM returns markdown code blocks
      const clean = content.replace(/```json/g, '').replace(/```/g, '');
      return JSON.parse(clean);
    }
  }

  function generateMockPersona(settings) {
    return {
      name: 'Mock Marcus',
      tone: settings.motivation,
      catchphrases: ['This is a mock response.', 'Use a real key for AI magic.']
    };
  }
});
