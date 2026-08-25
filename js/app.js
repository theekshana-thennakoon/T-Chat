/* ==========================================================================
   APP BOOTSTRAP & MAIN INITIALIZATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing TChat Web & Mobile Application...');

  // 1. Callback when user is logged in
  window.onAppReady = (user) => {
    console.log('👤 User authenticated:', user ? user.name : 'Active Session');

    if (window.ContactsModule) {
      window.ContactsModule.init();
    }

    if (window.ChatModule) {
      window.ChatModule.init();
    }

    if (window.StatusModule) {
      window.StatusModule.init();
    }
  };

  // 2. Initialize Backend & Config
  window.initBackendServices();

  // 3. Initialize UI Module
  if (window.UIModule) {
    window.UIModule.init();
  }

  // 4. Initialize Auth Module (Will trigger checkSession & onAppReady)
  if (window.AuthModule) {
    window.AuthModule.init();
  }

  // 5. Safety Failsafe: Always dismiss splash screen after initialization
  setTimeout(() => {
    if (window.hideSplashScreen) {
      window.hideSplashScreen(0);
    }
  }, 800);
});
