/* ==========================================================================
   APP BOOTSTRAP & MAIN INITIALIZATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing TChat Web & Mobile Application...');

  // 1. Initialize Backend & Config
  window.initBackendServices();

  // 2. Initialize UI Module
  if (window.UIModule) {
    window.UIModule.init();
  }

  // 3. Initialize Auth Module
  if (window.AuthModule) {
    window.AuthModule.init();
  }

  // 4. Callback when user is logged in
  window.onAppReady = (user) => {
    console.log('👤 User authenticated:', user.name);

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
});
