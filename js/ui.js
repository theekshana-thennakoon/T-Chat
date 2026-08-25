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

/* Global Centered Confirmation Modal Dialog System */
window.showConfirm = function(options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const iconWrapper = document.getElementById('confirm-modal-icon');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnOk = document.getElementById('btn-confirm-ok');

    if (!modal) {
      resolve(false);
      return;
    }

    const title = options.title || 'Confirm Action';
    const message = options.message || (typeof options === 'string' ? options : 'Are you sure you want to proceed?');
    const okText = options.okText || 'Confirm';
    const cancelText = options.cancelText || 'Cancel';
    const isDanger = options.isDanger !== false;
    const iconClass = options.icon || (isDanger ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-info');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (btnOk) {
      btnOk.textContent = okText;
      btnOk.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
    }
    if (btnCancel) btnCancel.textContent = cancelText;

    if (iconWrapper) {
      iconWrapper.className = isDanger ? 'confirm-icon-wrapper' : 'confirm-icon-wrapper info';
      iconWrapper.innerHTML = `<i class="${iconClass}"></i>`;
    }

    const handleOk = () => {
      cleanup();
      modal.classList.remove('active');
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      modal.classList.remove('active');
      resolve(false);
    };

    const handleBackdrop = (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    };

    const cleanup = () => {
      if (btnOk) btnOk.removeEventListener('click', handleOk);
      if (btnCancel) btnCancel.removeEventListener('click', handleCancel);
      modal.removeEventListener('click', handleBackdrop);
    };

    if (btnOk) btnOk.addEventListener('click', handleOk);
    if (btnCancel) btnCancel.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleBackdrop);

    modal.classList.add('active');
  });
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

/* Global Centered Delete Choice Modal System (Delete for Me vs Delete for Everyone) */
window.showDeleteChoiceModal = function(title = 'Delete Chat?', subtext = 'Choose how you want to delete this conversation.') {
  return new Promise((resolve) => {
    const modal = document.getElementById('delete-choice-modal');
    const titleEl = document.getElementById('delete-modal-title');
    const subtextEl = document.getElementById('delete-modal-subtext');
    const btnEveryone = document.getElementById('btn-delete-for-everyone');
    const btnMe = document.getElementById('btn-delete-for-me');
    const btnCancel = document.getElementById('btn-delete-choice-cancel');

    if (!modal) {
      resolve(null);
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (subtextEl) subtextEl.textContent = subtext;

    const handleEveryone = () => {
      cleanup();
      modal.classList.remove('active');
      resolve('everyone');
    };

    const handleMe = () => {
      cleanup();
      modal.classList.remove('active');
      resolve('me');
    };

    const handleCancel = () => {
      cleanup();
      modal.classList.remove('active');
      resolve(null);
    };

    const handleBackdrop = (e) => {
      if (e.target === modal) handleCancel();
    };

    const cleanup = () => {
      if (btnEveryone) btnEveryone.removeEventListener('click', handleEveryone);
      if (btnMe) btnMe.removeEventListener('click', handleMe);
      if (btnCancel) btnCancel.removeEventListener('click', handleCancel);
      modal.removeEventListener('click', handleBackdrop);
    };

    if (btnEveryone) btnEveryone.addEventListener('click', handleEveryone);
    if (btnMe) btnMe.addEventListener('click', handleMe);
    if (btnCancel) btnCancel.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleBackdrop);

    modal.classList.add('active');
  });
};

  bindContextMenuAndLongPress() {
    const menu = document.getElementById('custom-context-menu');
    const itemCopy = document.getElementById('context-action-copy');
    const itemSelect = document.getElementById('context-action-select');
    const itemDeleteMsg = document.getElementById('context-action-delete-msg');
    const itemPaste = document.getElementById('context-action-paste');

    let currentTargetMsgText = '';
    let currentTargetMsgId = '';
    let currentTargetInput = null;

    const hideContextMenu = () => {
      if (menu) menu.classList.add('hidden');
    };

    window.addEventListener('click', hideContextMenu);
    window.addEventListener('scroll', hideContextMenu, true);

    const showContextMenuAt = (x, y, showMsgActions, showPaste, msgText, msgId, inputEl) => {
      if (!menu) return;

      currentTargetMsgText = msgText || '';
      currentTargetMsgId = msgId || '';
      currentTargetInput = inputEl || null;

      if (showMsgActions) {
        if (itemCopy) itemCopy.classList.remove('hidden');
        if (itemSelect) itemSelect.classList.remove('hidden');
        if (itemDeleteMsg) itemDeleteMsg.classList.remove('hidden');
      } else {
        if (itemCopy) itemCopy.classList.add('hidden');
        if (itemSelect) itemSelect.classList.add('hidden');
        if (itemDeleteMsg) itemDeleteMsg.classList.add('hidden');
      }

      if (showPaste && itemPaste) itemPaste.classList.remove('hidden');
      else if (itemPaste) itemPaste.classList.add('hidden');

      if (!showMsgActions && !showPaste) {
        hideContextMenu();
        return;
      }

      const menuWidth = 180;
      const menuHeight = 140;
      const posX = Math.min(x, window.innerWidth - menuWidth - 10);
      const posY = Math.min(y, window.innerHeight - menuHeight - 10);

      menu.style.left = `${posX}px`;
      menu.style.top = `${posY}px`;
      menu.classList.remove('hidden');
    };

    // 1. Desktop / Laptop Right Click Listener
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      const messageBubble = e.target.closest('.message-bubble');
      const inputEl = e.target.closest('input, textarea');

      if (messageBubble) {
        const textP = messageBubble.querySelector('p');
        const textQuote = messageBubble.querySelector('.quote-body-text');
        const msgText = textP ? textP.textContent : (textQuote ? textQuote.textContent : messageBubble.textContent);
        const msgId = messageBubble.id || '';

        showContextMenuAt(e.clientX, e.clientY, true, false, msgText, msgId, null);
      } else if (inputEl) {
        showContextMenuAt(e.clientX, e.clientY, false, true, '', '', inputEl);
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
        const messageBubble = target.closest('.message-bubble');
        const inputEl = target.closest('input, textarea');

        if (messageBubble || inputEl) {
          if (messageBubble) {
            const textP = messageBubble.querySelector('p');
            const textQuote = messageBubble.querySelector('.quote-body-text');
            const msgText = textP ? textP.textContent : (textQuote ? textQuote.textContent : messageBubble.textContent);
            const msgId = messageBubble.id || '';
            showContextMenuAt(touch.clientX, touch.clientY, true, false, msgText, msgId, null);
          } else if (inputEl) {
            showContextMenuAt(touch.clientX, touch.clientY, false, true, '', '', inputEl);
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
          navigator.clipboard.writeText(currentTargetMsgText).then(() => {
            window.showToast('Message copied to clipboard!', 'success');
          }).catch(() => {
            window.showToast('Could not copy message', 'error');
          });
        }
      };
    }

    // 4. Bind Select Action
    if (itemSelect) {
      itemSelect.onclick = (e) => {
        e.stopPropagation();
        hideContextMenu();
        if (currentTargetMsgId && window.ChatModule) {
          window.ChatModule.toggleMessageSelection(currentTargetMsgId);
        }
      };
    }

    // 5. Bind Delete Message Action
    if (itemDeleteMsg) {
      itemDeleteMsg.onclick = (e) => {
        e.stopPropagation();
        hideContextMenu();
        if (currentTargetMsgId && window.ChatModule) {
          window.ChatModule.deleteSingleMessage(currentTargetMsgId);
        }
      };
    }
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
