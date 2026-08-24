/* Global Top-Right Toast Notification System */
window.showToast = function(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  let iconClass = 'fa-circle-check';
  if (type === 'error' || type === 'danger') iconClass = 'fa-circle-xmark';
  else if (type === 'warning') iconClass = 'fa-triangle-exclamation';

  toast.className = `toast-notification ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);

  // Trigger smooth enter animation
  requestAnimationFrame(() => {
    toast.classList.add('active');
  });

  // Auto remove after duration
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 350);
  }, duration);
};

// Override native browser alert to route all system alerts to top-right Toast Notifications
window.alert = function(msg) {
  let type = 'success';
  const lower = String(msg).toLowerCase();
  if (lower.includes('error') || lower.includes('failed') || lower.includes('could not') || lower.includes('wrong') || lower.includes('invalid')) {
    type = 'error';
  } else if (lower.includes('please') || lower.includes('required') || lower.includes('already')) {
    type = 'warning';
  }
  window.showToast(msg, type);
};

// Global Splash Screen Controller
window.hideSplashScreen = function(delay = 650) {
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.classList.add('hidden');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 550);
    }
  }, delay);
};

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
        const tabProfile = document.querySelector('.tab-btn[data-tab="profile"]');
        if (tabProfile) tabProfile.click();
      });
    }

    // 3 Dots Menu Button -> Open Settings Modal
    const btnMenu = document.getElementById('btn-open-menu');
    const btnChatOptions = document.getElementById('btn-chat-options');
    const settingsModal = document.getElementById('settings-modal');

    if (btnMenu && settingsModal) {
      btnMenu.addEventListener('click', () => {
        settingsModal.classList.add('active');
      });
    }

    if (btnChatOptions && settingsModal) {
      btnChatOptions.addEventListener('click', () => {
        settingsModal.classList.add('active');
      });
    }

    // Settings Profile Card click -> switch to Profile tab
    const btnSettingsProfile = document.getElementById('btn-settings-profile');
    if (btnSettingsProfile) {
      btnSettingsProfile.addEventListener('click', () => {
        if (settingsModal) settingsModal.classList.remove('active');
        const tabProfile = document.querySelector('.tab-btn[data-tab="profile"]');
        if (tabProfile) tabProfile.click();
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
    // Universal Close Modal buttons (.btn-close-modal)
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) modal.classList.remove('active');
      });
    });

    // Close modal on clicking backdrop
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

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
