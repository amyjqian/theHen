document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const onboardingView = document.getElementById('onboarding-view');
    const dashboardView = document.getElementById('dashboard-view');
    const saveBtn = document.getElementById('save-settings');
    const resetBtn = document.getElementById('reset-settings');
    const loadingState = document.getElementById('loading-state');
  
    // Inputs
    const goalInput = document.getElementById('goal');
    const motivationSelect = document.getElementById('motivation');
    const intensitySelect = document.getElementById('intensity');
  
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
      }
    }
  
    async function handleSave() {
      const goal = goalInput.value.trim();
      if (!goal) {
        alert('Please enter a goal.');
        return;
      }
  
      const settings = {
        goal,
        motivation: motivationSelect.value,
        intensity: intensitySelect.value
      };
  
      // Show loading state (conceptually)
      saveBtn.disabled = true;
      saveBtn.textContent = 'Generating Persona...';
  
      // Simulate Persona Generation (Mock LLM)
      // In a real app, this would call the background script to fetch from an API
      const persona = generateMockPersona(settings);
  
      // Save everything
      await chrome.storage.local.set({
        userSettings: settings,
        persona: persona,
        stats: { interventionsToday: 0 }
      });
  
      saveBtn.disabled = false;
      saveBtn.textContent = 'Create Persona';
      
      showDashboard(persona, { interventionsToday: 0 });
    }
  
    async function handleReset() {
      if(confirm('Are you sure you want to reset your persona and stats?')) {
        await chrome.storage.local.clear();
        showOnboarding();
        // Clear inputs
        goalInput.value = '';
      }
    }
  
    // MOCK GENERATOR - To be replaced by LLM call in background
    function generateMockPersona(settings) {
      const names = {
        'strict': 'Sergeant Focus',
        'gentle': 'Glenda Guide',
        'brutal': 'The Terminator',
        'guilt': 'Disappointed Mom',
        'future_self': 'Future You',
         'rewards': 'Coach Cheer'
      };

      const catchphrases = {
          'strict': ['No pain, no gain.', 'Get back to work!', 'Slacking is for the weak.'],
          'gentle': ['Just a gentle nudge.', 'You can do this.', 'Remember your goal.'],
          'brutal': ['Pathetic.', 'Is that all you got?', 'You are failing.'],
          'guilt': ['I expected better.', 'Don\'t let me down.', 'Think of all the wasted potential.'],
          'future_self': ['Invest in tomorrow.', 'Your future starts now.', 'Be the person you want to be.'],
          'rewards': ['Eyes on the prize!', 'You are doing great!', 'Keep it up!']
      }
      
      let key = settings.motivation;
      // Fallback if motivation doesn't match keys exactly (though values match options)
      if (!names[key]) key = 'strict';
  
      return {
        name: names[key],
        tone: settings.motivation,
        strategy: settings.intensity,
        catchphrases: catchphrases[key]
      };
    }
  });