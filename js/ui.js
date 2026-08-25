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
    this.bindSecurityProtection();
    this.bindContextMenuAndLongPress();
  },

  bindContextMenuAndLongPress() {
    const menu = document.getElementById('custom-context-menu');
    const itemCopy = document.getElementById('context-action-copy');
    const itemPaste = document.getElementById('context-action-paste');

    let currentTargetMsgText = '';
    let currentTargetInput = null;

    const hideContextMenu = () => {
      if (menu) menu.classList.add('hidden');
    };

    window.addEventListener('click', hideContextMenu);
    window.addEventListener('scroll', hideContextMenu, true);

    const showContextMenuAt = (x, y, showCopy, showPaste, msgText, inputEl) => {
      if (!menu) return;

      currentTargetMsgText = msgText || '';
      currentTargetInput = inputEl || null;

      if (showCopy) itemCopy.classList.remove('hidden');
      else itemCopy.classList.add('hidden');

      if (showPaste) itemPaste.classList.remove('hidden');
      else itemPaste.classList.add('hidden');

      if (!showCopy && !showPaste) {
        hideContextMenu();
        return;
      }

      const menuWidth = 175;
      const menuHeight = 90;
      const posX = Math.min(x, window.innerWidth - menuWidth - 10);
      const posY = Math.min(y, window.innerHeight - menuHeight - 10);

      menu.style.left = `${posX}px`;
      menu.style.top = `${posY}px`;
      menu.classList.remove('hidden');
    };

    // 1. Desktop / Laptop Right Click Listener
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Disable default context menu globally

      const messageBubble = e.target.closest('.message-bubble') || e.target.closest('.message-row');
      const inputEl = e.target.closest('input, textarea');

      if (messageBubble) {
        const textP = messageBubble.querySelector('p');
        const textQuote = messageBubble.querySelector('.quote-body-text');
        const msgText = textP ? textP.textContent : (textQuote ? textQuote.textContent : messageBubble.textContent);
        
        showContextMenuAt(e.clientX, e.clientY, true, false, msgText, null);
      } else if (inputEl) {
        showContextMenuAt(e.clientX, e.clientY, false, true, '', inputEl);
      } else {
        hideContextMenu();
      }
    });

    // 2. Mobile Touch Long-Press Listener (450ms hold)
    let longPressTimer = null;

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const target = touch.target;

      longPressTimer = setTimeout(() => {
        const messageBubble = target.closest('.message-bubble') || target.closest('.message-row');
        const inputEl = target.closest('input, textarea');

        if (messageBubble || inputEl) {
          if (messageBubble) {
            const textP = messageBubble.querySelector('p');
            const textQuote = messageBubble.querySelector('.quote-body-text');
            const msgText = textP ? textP.textContent : (textQuote ? textQuote.textContent : messageBubble.textContent);
            showContextMenuAt(touch.clientX, touch.clientY, true, false, msgText, null);
          } else if (inputEl) {
            showContextMenuAt(touch.clientX, touch.clientY, false, true, '', inputEl);
          }
        }
      }, 450);
    }, { passive: true });

    window.addEventListener('touchmove', () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    });

    window.addEventListener('touchend', () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    });

    // 3. Bind Copy Action
    if (itemCopy) {
      itemCopy.onclick = (e) => {
        e.stopPropagation();
        hideContextMenu();
        if (currentTargetMsgText) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(currentTargetMsgText).then(() => {
              window.showToast('Message copied to clipboard!', 'success');
            }).catch(() => {
              this.fallbackCopyText(currentTargetMsgText);
            });
          } else {
            this.fallbackCopyText(currentTargetMsgText);
          }
        }
      };
    }

    // 4. Bind Paste Action
    if (itemPaste) {
      itemPaste.onclick = async (e) => {
        e.stopPropagation();
        hideContextMenu();
        if (currentTargetInput) {
          currentTargetInput.focus();
          try {
            if (navigator.clipboard && navigator.clipboard.readText) {
              const text = await navigator.clipboard.readText();
              if (text) {
                const start = currentTargetInput.selectionStart || currentTargetInput.value.length;
                const end = currentTargetInput.selectionEnd || currentTargetInput.value.length;
                const val = currentTargetInput.value;
                currentTargetInput.value = val.substring(0, start) + text + val.substring(end);
                currentTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
                window.showToast('Pasted from clipboard!', 'success');
              }
            } else {
              window.showToast('Use Ctrl+V to paste', 'info');
            }
          } catch (err) {
            window.showToast('Use Ctrl+V to paste', 'info');
          }
        }
      };
    }
  },

  fallbackCopyText(text) {
    const txtArea = document.createElement('textarea');
    txtArea.value = text;
    document.body.appendChild(txtArea);
    txtArea.select();
    try {
      document.execCommand('copy');
      window.showToast('Message copied to clipboard!', 'success');
    } catch (err) {
      window.showToast('Could not copy message', 'error');
    }
    document.body.removeChild(txtArea);
  },

  bindSecurityProtection() {
    window.addEventListener('keydown', (e) => {
      const key = e.key ? e.key.toLowerCase() : '';
      const code = e.code ? e.code.toLowerCase() : '';
      
      // Prevent Ctrl+U (View Page Source)
      if ((e.ctrlKey || e.metaKey) && (key === 'u' || code === 'keyu')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Prevent Ctrl+Shift+I (Open DevTools Inspect Element)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'i' || code === 'keyi')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Prevent Ctrl+Shift+J (Open DevTools Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'j' || code === 'keyj')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Prevent Ctrl+Shift+C (Inspect Element Picker)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'c' || code === 'keyc')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Prevent F12 (Open DevTools)
      if (key === 'f12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);
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
        if (window.ChatModule) {
          window.ChatModule.closeConversation();
        } else {
          document.querySelector('.app-container').classList.remove('chat-active');
        }
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
