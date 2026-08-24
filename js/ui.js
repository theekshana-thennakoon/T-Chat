/* ==========================================================================
   UI NAVIGATION, THEMES, & MODAL HANDLERS
   ========================================================================== */

const UIModule = {
  init() {
    this.bindNavigation();
    this.bindSettings();
    this.bindModals();
  },

  bindNavigation() {
    // Sidebar Tab Switching
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        const pane = document.getElementById(`tab-content-${targetTab}`);
        if (pane) pane.classList.add('active');
      });
    });

    // Mobile Back Button to return to Chat list
    const btnBack = document.getElementById('btn-back-to-chats');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        document.querySelector('.app-container').classList.remove('chat-active');
      });
    }

    // Open Profile Drawer
    const btnProfile = document.getElementById('btn-open-profile-drawer');
    if (btnProfile) {
      btnProfile.addEventListener('click', () => {
        const tabSettings = document.querySelector('.tab-btn[data-tab="settings"]');
        if (tabSettings) tabSettings.click();
      });
    }

    // Start First Chat button (Empty State)
    const btnStartFirst = document.getElementById('btn-start-first-chat');
    if (btnStartFirst) {
      btnStartFirst.addEventListener('click', () => {
        const tabContacts = document.querySelector('.tab-btn[data-tab="contacts"]');
        if (tabContacts) tabContacts.click();
      });
    }
  },

  bindSettings() {
    // Dark/Light Theme switch
    const chkDark = document.getElementById('chk-dark-mode');
    if (chkDark) {
      chkDark.addEventListener('change', (e) => {
        if (e.target.checked) {
          document.body.classList.remove('light-theme');
          document.body.classList.add('dark-theme');
        } else {
          document.body.classList.remove('dark-theme');
          document.body.classList.add('light-theme');
        }
      });
    }

    // Sound toggle
    const chkSound = document.getElementById('chk-sounds');
    if (chkSound) {
      chkSound.addEventListener('change', (e) => {
        if (window.SoundManager) {
          window.SoundManager.enabled = e.target.checked;
        }
      });
    }

    // Firebase Settings Modal buttons
    const btnOpenFb = document.getElementById('btn-open-firebase-settings');
    const btnOpenFb2 = document.getElementById('btn-open-firebase-config-settings');
    const modalFb = document.getElementById('firebase-settings-modal');

    if (btnOpenFb) btnOpenFb.onclick = () => modalFb.classList.add('active');
    if (btnOpenFb2) btnOpenFb2.onclick = () => modalFb.classList.add('active');

    const btnSaveKeys = document.getElementById('btn-save-firebase-keys');
    if (btnSaveKeys) {
      btnSaveKeys.onclick = () => {
        const config = {
          apiKey: document.getElementById('cfg-apiKey').value.trim(),
          authDomain: document.getElementById('cfg-authDomain').value.trim(),
          projectId: document.getElementById('cfg-projectId').value.trim(),
          storageBucket: document.getElementById('cfg-storageBucket').value.trim(),
          messagingSenderId: document.getElementById('cfg-messagingSenderId').value.trim(),
          appId: document.getElementById('cfg-appId').value.trim()
        };
        if (!config.apiKey || !config.projectId) {
          alert('API Key and Project ID are required!');
          return;
        }
        window.saveCustomFirebaseConfig(config);
      };
    }

    const btnResetDemo = document.getElementById('btn-reset-demo-mode');
    if (btnResetDemo) {
      btnResetDemo.onclick = () => window.resetToDemoMode();
    }
  },

  bindModals() {
    // Open contacts modal
    const btnContacts = document.getElementById('btn-open-contacts-modal');
    if (btnContacts) {
      btnContacts.onclick = () => {
        const tabContacts = document.querySelector('.tab-btn[data-tab="contacts"]');
        if (tabContacts) tabContacts.click();
      };
    }

    // Simulated Call Modal
    const btnVoiceCall = document.getElementById('btn-sim-voice-call');
    const btnVideoCall = document.getElementById('btn-sim-video-call');
    const callModal = document.getElementById('call-modal');
    const btnEndCall = document.getElementById('btn-end-call');

    if (btnVoiceCall) {
      btnVoiceCall.onclick = () => {
        if (window.ChatModule && window.ChatModule.activeContact) {
          document.getElementById('call-user-name').textContent = window.ChatModule.activeContact.name;
          document.getElementById('call-user-avatar').src = window.ChatModule.activeContact.avatar;
          document.getElementById('call-status-label').textContent = 'TChat Voice Calling...';
          callModal.classList.add('active');
        }
      };
    }

    if (btnVideoCall) {
      btnVideoCall.onclick = () => {
        if (window.ChatModule && window.ChatModule.activeContact) {
          document.getElementById('call-user-name').textContent = window.ChatModule.activeContact.name;
          document.getElementById('call-user-avatar').src = window.ChatModule.activeContact.avatar;
          document.getElementById('call-status-label').textContent = 'TChat Video Calling...';
          callModal.classList.add('active');
        }
      };
    }

    if (btnEndCall) {
      btnEndCall.onclick = () => callModal.classList.remove('active');
    }
  }
};

window.UIModule = UIModule;
