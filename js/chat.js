/* ==========================================================================
   REAL-TIME CHAT MESSAGING ENGINE
   ========================================================================== */

const ChatModule = {
  activeContact: null,
  messages: {},
  quotingMessage: null,
  firestoreListener: null,
  isLoadingChats: true,
  isLoadingMessages: false,
  searchMatches: [],
  currentMatchIndex: -1,
  searchQuery: '',
  pinnedChats: JSON.parse(localStorage.getItem('tchat_pinned_chats') || '{}'),
  deletedChats: JSON.parse(localStorage.getItem('tchat_deleted_chats') || '{}'),
  selectedChatForMenu: null,
  selectedMessageIds: new Set(),
  isSelectionMode: false,
  pendingSendImages: [],
  activeImageIndex: 0,
  activeViewingDocUrl: null,
  activeViewingDocName: null,
  galleryFilter: 'all',
  selectedGalleryIds: [],
  galleryLibrary: [
    { id: 'g1', type: 'image', isVideo: false, url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=60', name: 'Beach Sunset' },
    { id: 'g2', type: 'image', isVideo: false, url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=500&auto=format&fit=crop&q=60', name: 'Starry Mountains' },
    { id: 'g3', type: 'image', isVideo: false, url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&auto=format&fit=crop&q=60', name: 'Foggy Forest' },
    { id: 'g4', type: 'image', isVideo: false, url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=500&auto=format&fit=crop&q=60', name: 'Nature Trail' },
    { id: 'g5', type: 'image', isVideo: false, url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&auto=format&fit=crop&q=60', name: 'Yosemite Lake' },
    { id: 'g6', type: 'image', isVideo: false, url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=500&auto=format&fit=crop&q=60', name: 'Green Valley' },
    { id: 'g7', type: 'video', isVideo: true, url: 'https://www.w3schools.com/html/mov_bbb.mp4', name: 'Sample Video 1' },
    { id: 'g8', type: 'video', isVideo: true, url: 'https://www.w3schools.com/html/movie.mp4', name: 'Sample Video 2' }
  ],

  pdfState: {
    pdfDoc: null,
    pageNum: 1,
    pageRendering: false,
    pageNumPending: null,
    scale: 1.0,
    rotation: 0,
    sidebarOpen: false,
    activeBlobUrl: null
  },

  documentCache: {},

  init() {
    this.bindEvents();
    this.initPdfReaderControls();
    this.loadAllChats();
  },

  bindEvents() {
    // Send message input
    const txtInput = document.getElementById('message-input');
    const btnSendOrMic = document.getElementById('btn-send-or-mic');
    
    if (txtInput) {
      txtInput.addEventListener('input', (e) => {
        const text = e.target.value;
        const iconMic = document.getElementById('icon-mic');
        const iconSend = document.getElementById('icon-send');
        
        if (text.trim().length > 0) {
          iconMic.classList.add('hidden');
          iconSend.classList.remove('hidden');
        } else {
          iconMic.classList.remove('hidden');
          iconSend.classList.add('hidden');
        }

        // Mention Trigger Check
        this.handleMentionInput(text);

        // Auto resize textarea height
        txtInput.style.height = 'auto';
        txtInput.style.height = Math.min(txtInput.scrollHeight, 100) + 'px';
      });

      txtInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    if (btnSendOrMic) {
      btnSendOrMic.addEventListener('click', () => {
        if (window.VoiceModule && window.VoiceModule.isRecording) {
          window.VoiceModule.stopRecording(true);
          return;
        }
        const text = txtInput.value.trim();
        if (text.length > 0) {
          this.handleSendMessage();
        } else {
          // Trigger voice recorder
          if (window.VoiceModule) {
            window.VoiceModule.startRecording();
          }
        }
      });
    }

    // Attachment input listeners & Paste listener for image customization modal
    const btnOpenGallery = document.getElementById('btn-open-gallery-modal');
    if (btnOpenGallery) {
      btnOpenGallery.onclick = () => {
        const drop = document.getElementById('attach-dropdown');
        if (drop) drop.classList.add('hidden');
        this.openMediaGalleryModal();
      };
    }

    const deviceFileGallery = document.getElementById('gallery-browse-device-input');
    if (deviceFileGallery) {
      deviceFileGallery.onchange = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          this.handleDeviceGalleryFiles(files);
          deviceFileGallery.value = '';
        }
      };
    }

    const fileImg = document.getElementById('attach-image-input');
    if (fileImg) {
      fileImg.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          this.handleMultipleImageFiles(files);
          fileImg.value = '';
          const drop = document.getElementById('attach-dropdown');
          if (drop) drop.classList.add('hidden');
        }
      });
    }

    if (txtInput) {
      txtInput.addEventListener('paste', (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (items) {
          const imageFiles = [];
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile();
              if (file) imageFiles.push(file);
            }
          }
          if (imageFiles.length > 0) {
            e.preventDefault();
            this.handleMultipleImageFiles(imageFiles);
          }
        }
      });
    }

    // Image preview & caption modal action listeners
    const btnConfirmImg = document.getElementById('btn-confirm-image-send');
    const btnCancelImg = document.getElementById('btn-cancel-image-send');
    const btnCloseImg = document.getElementById('btn-close-img-modal');
    const imageCaptionInput = document.getElementById('image-caption-input');

    if (btnConfirmImg) {
      btnConfirmImg.onclick = () => this.sendPendingImages();
    }
    if (btnCancelImg) {
      btnCancelImg.onclick = () => this.cancelPendingImages();
    }
    if (btnCloseImg) {
      btnCloseImg.onclick = () => this.cancelPendingImages();
    }

    if (imageCaptionInput) {
      imageCaptionInput.oninput = (e) => {
        if (this.pendingSendImages && this.pendingSendImages[this.activeImageIndex]) {
          this.pendingSendImages[this.activeImageIndex].caption = e.target.value;
        }
      };
      imageCaptionInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.sendPendingImages();
        }
      };
    }

    const fileDoc = document.getElementById('attach-file-input');
    if (fileDoc) {
      fileDoc.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          files.forEach(file => this.handleDocumentFileUpload(file));
          fileDoc.value = '';
          const drop = document.getElementById('attach-dropdown');
          if (drop) drop.classList.add('hidden');
        }
      });
    }

    // Document viewer modal buttons
    const btnNewTabDoc = document.getElementById('btn-open-doc-new-tab');
    const btnDownloadDoc = document.getElementById('btn-download-doc');
    const btnCloseDocModal = document.getElementById('btn-close-doc-modal');

    if (btnNewTabDoc) btnNewTabDoc.onclick = () => this.openDocumentInNewTab();
    if (btnDownloadDoc) btnDownloadDoc.onclick = () => this.downloadDocumentFile();
    if (btnCloseDocModal) {
      btnCloseDocModal.onclick = () => this.closeDocumentViewerModal();
    }

    // Toggle emoji picker & attachment menus
    const btnEmoji = document.getElementById('btn-toggle-emoji');
    if (btnEmoji) {
      btnEmoji.addEventListener('click', () => {
        document.getElementById('emoji-picker-container').classList.toggle('hidden');
      });
    }

    // Emoji click selection
    const emojiGrid = document.getElementById('emoji-grid');
    if (emojiGrid) {
      emojiGrid.addEventListener('click', (e) => {
        if (e.target.nodeName === 'DIV' || e.target.textContent) {
          const emoji = e.target.textContent.trim();
          if (emoji && txtInput) {
            txtInput.value += emoji;
            txtInput.dispatchEvent(new Event('input'));
          }
        }
      });
    }

    const btnAttach = document.getElementById('btn-toggle-attach');
    if (btnAttach) {
      btnAttach.addEventListener('click', () => {
        document.getElementById('attach-dropdown').classList.toggle('hidden');
      });
    }

    // Close quote bar
    const btnCloseQuote = document.getElementById('btn-close-quote');
    if (btnCloseQuote) {
      btnCloseQuote.addEventListener('click', () => this.clearQuote());
    }

    // Click active chat header to view contact profile modal
    const btnViewChatInfo = document.getElementById('btn-view-chat-info');
    if (btnViewChatInfo) {
      btnViewChatInfo.addEventListener('click', () => this.openContactProfileModal());
    }

    // Contact Profile Modal actions
    const btnViewChatMsg = document.getElementById('btn-view-contact-chat');
    if (btnViewChatMsg) {
      btnViewChatMsg.addEventListener('click', () => {
        const modal = document.getElementById('contact-profile-modal');
        if (modal) modal.classList.remove('active');
      });
    }
    const btnViewChatCall = document.getElementById('btn-view-contact-call');
    if (btnViewChatCall) {
      btnViewChatCall.addEventListener('click', () => {
        const modal = document.getElementById('contact-profile-modal');
        if (modal) modal.classList.remove('active');
        const btnSimCall = document.getElementById('btn-sim-voice-call');
        if (btnSimCall) btnSimCall.click();
      });
    }

    // Search bar filtering
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        this.filterChatsList(term);
      });
    }

    // In-Chat Search Header Controls
    const btnSearchInChat = document.getElementById('btn-search-in-chat');
    const btnCloseSearch = document.getElementById('btn-close-chat-search');
    const btnClearSearch = document.getElementById('btn-clear-chat-search');
    const chatSearchInput = document.getElementById('chat-search-input');
    const btnPrevMatch = document.getElementById('btn-prev-search-match');
    const btnNextMatch = document.getElementById('btn-next-search-match');

    if (btnSearchInChat) {
      btnSearchInChat.addEventListener('click', () => this.openChatSearch());
    }

    if (btnCloseSearch) {
      btnCloseSearch.addEventListener('click', () => this.closeChatSearch());
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (chatSearchInput) {
          chatSearchInput.value = '';
          chatSearchInput.focus();
        }
        this.performChatSearch('');
      });
    }

    if (chatSearchInput) {
      chatSearchInput.addEventListener('input', (e) => {
        this.performChatSearch(e.target.value);
      });

      chatSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeChatSearch();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.navigateSearchMatch(e.shiftKey ? -1 : 1);
        }
      });
    }

    if (btnPrevMatch) {
      btnPrevMatch.addEventListener('click', () => this.navigateSearchMatch(-1));
    }

    if (btnNextMatch) {
      btnNextMatch.addEventListener('click', () => this.navigateSearchMatch(1));
    }

    // Chat Item Context Menu (Pin / Delete) Action Listeners
    const btnPinAction = document.getElementById('chat-item-action-pin');
    if (btnPinAction) {
      btnPinAction.addEventListener('click', () => {
        if (this.selectedChatForMenu) {
          this.togglePinChat(this.selectedChatForMenu);
        }
      });
    }

    const btnDeleteAction = document.getElementById('chat-item-action-delete');
    if (btnDeleteAction) {
      btnDeleteAction.addEventListener('click', () => {
        if (this.selectedChatForMenu) {
          this.deleteChat(this.selectedChatForMenu);
        }
      });
    }

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('chat-item-context-menu');
      if (menu && !menu.classList.contains('hidden')) {
        if (!e.target.closest('#chat-item-context-menu') && !e.target.closest('.chat-item-menu-btn')) {
          this.closeChatItemMenu();
        }
      }
    });

    // Message Selection Action Listeners
    const btnCancelSel = document.getElementById('btn-cancel-selection');
    const btnCopySel = document.getElementById('btn-copy-selected-messages');
    const btnDeleteSel = document.getElementById('btn-delete-selected-messages');

    if (btnCancelSel) {
      btnCancelSel.addEventListener('click', () => this.clearMessageSelection());
    }

    if (btnCopySel) {
      btnCopySel.addEventListener('click', () => this.copySelectedMessages());
    }

    if (btnDeleteSel) {
      btnDeleteSel.addEventListener('click', () => this.deleteSelectedMessages());
    }
  },

  openChatSearch() {
    const searchBar = document.getElementById('chat-search-bar');
    const header = document.getElementById('chat-header');
    const input = document.getElementById('chat-search-input');
    if (!searchBar || !header) return;

    header.classList.add('search-active');
    searchBar.classList.remove('hidden');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
    this.performChatSearch('');
  },

  closeChatSearch() {
    const searchBar = document.getElementById('chat-search-bar');
    const header = document.getElementById('chat-header');
    const input = document.getElementById('chat-search-input');
    const clearBtn = document.getElementById('btn-clear-chat-search');
    const counter = document.getElementById('chat-search-counter');
    const navBtns = document.getElementById('chat-search-nav-btns');

    if (header) header.classList.remove('search-active');
    if (searchBar) searchBar.classList.add('hidden');
    if (input) input.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    if (counter) counter.classList.add('hidden');
    if (navBtns) navBtns.classList.add('hidden');

    this.clearSearchHighlights();
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.searchQuery = '';
  },

  clearSearchHighlights() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.querySelectorAll('.message-bubble.search-match-active').forEach(el => {
      el.classList.remove('search-match-active');
    });

    container.querySelectorAll('mark.search-highlight').forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    });
  },

  performChatSearch(query) {
    this.searchQuery = (query || '').trim();
    const clearBtn = document.getElementById('btn-clear-chat-search');
    const counter = document.getElementById('chat-search-counter');
    const navBtns = document.getElementById('chat-search-nav-btns');

    if (clearBtn) {
      if (this.searchQuery.length > 0) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    this.clearSearchHighlights();
    this.searchMatches = [];
    this.currentMatchIndex = -1;

    if (!this.searchQuery) {
      if (counter) counter.classList.add('hidden');
      if (navBtns) navBtns.classList.add('hidden');
      return;
    }

    const container = document.getElementById('chat-messages-container');
    if (!container || !this.activeContact) return;

    const msgs = this.messages[this.activeContact.id] || [];
    const lowerQuery = this.searchQuery.toLowerCase();

    const matchingMsgs = msgs.filter(m => m.text && m.text.toLowerCase().includes(lowerQuery));

    if (matchingMsgs.length === 0) {
      if (counter) {
        counter.textContent = '0 matches';
        counter.classList.remove('hidden');
      }
      if (navBtns) navBtns.classList.add('hidden');
      return;
    }

    matchingMsgs.forEach(m => {
      const bubbleEl = document.getElementById(m.id);
      if (bubbleEl) {
        this.searchMatches.push(m.id);
        const pEl = bubbleEl.querySelector('p');
        if (pEl) {
          const text = pEl.textContent;
          const regex = new RegExp(`(${this.escapeRegExp(this.searchQuery)})`, 'gi');
          pEl.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
        }
      }
    });

    if (this.searchMatches.length > 0) {
      this.currentMatchIndex = 0;
      if (counter) {
        counter.textContent = `1 of ${this.searchMatches.length}`;
        counter.classList.remove('hidden');
      }
      if (navBtns) navBtns.classList.remove('hidden');
      this.focusMatch(0);
    }
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  focusMatch(index) {
    if (this.searchMatches.length === 0 || index < 0 || index >= this.searchMatches.length) return;

    document.querySelectorAll('.message-bubble.search-match-active').forEach(el => {
      el.classList.remove('search-match-active');
    });

    const msgId = this.searchMatches[index];
    const bubbleEl = document.getElementById(msgId);
    if (bubbleEl) {
      bubbleEl.classList.add('search-match-active');
      bubbleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const counter = document.getElementById('chat-search-counter');
    if (counter) {
      counter.textContent = `${index + 1} of ${this.searchMatches.length}`;
    }
  },

  navigateSearchMatch(direction) {
    if (this.searchMatches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex + direction + this.searchMatches.length) % this.searchMatches.length;
    this.focusMatch(this.currentMatchIndex);
  },

  toggleChatItemMenu(e, contactId) {
    e.preventDefault();
    this.selectedChatForMenu = contactId;
    const menu = document.getElementById('chat-item-context-menu');
    const pinText = document.getElementById('chat-item-pin-text');
    const pinIcon = document.getElementById('chat-item-pin-icon');
    if (!menu) return;

    const isPinned = !!this.pinnedChats[contactId];
    if (pinText) pinText.textContent = isPinned ? 'Unpin Chat' : 'Pin Chat';
    if (pinIcon) pinIcon.className = isPinned ? 'fa-solid fa-thumbtack-slash' : 'fa-solid fa-thumbtack';

    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.left - 120;

    if (left < 10) left = 10;
    if (top + 100 > window.innerHeight) top = rect.top - 100;

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.classList.remove('hidden');
  },

  closeChatItemMenu() {
    const menu = document.getElementById('chat-item-context-menu');
    if (menu) menu.classList.add('hidden');
    this.selectedChatForMenu = null;
  },

  togglePinChat(contactId) {
    if (!contactId) return;
    const isPinned = !this.pinnedChats[contactId];
    this.pinnedChats[contactId] = isPinned;
    localStorage.setItem('tchat_pinned_chats', JSON.stringify(this.pinnedChats));
    this.closeChatItemMenu();

    if (window.showToast) {
      window.showToast(isPinned ? 'Chat pinned to top' : 'Chat unpinned', 'success');
    }

    this.renderChatsList();
  },

  async deleteChat(contactId) {
    if (!contactId) return;

    const targetContact = window.ContactsModule ? window.ContactsModule.contacts.find(c => c.id === contactId) : null;
    const contactObj = targetContact || this.activeContact || { id: contactId };

    const choice = await window.showDeleteChoiceModal(
      'Delete Conversation?',
      'Choose how you want to delete this chat conversation.'
    );

    if (!choice) return;

    this.deletedChats[contactId] = true;
    delete this.messages[contactId];
    delete this.pinnedChats[contactId];

    localStorage.setItem('tchat_deleted_chats', JSON.stringify(this.deletedChats));
    localStorage.setItem('tchat_pinned_chats', JSON.stringify(this.pinnedChats));

    if (choice === 'everyone') {
      if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
        const chatId = this.getChatRoomId(contactObj);
        window.AppConfig.db.collection('chats').doc(chatId).delete()
          .catch(err => console.warn('Firestore room delete notice:', err));
      }
      if (window.showToast) window.showToast('Chat deleted for everyone', 'info');
    } else {
      if (window.showToast) window.showToast('Chat deleted for you', 'info');
    }

    this.closeChatItemMenu();

    if (this.activeContact && (this.activeContact.id === contactId || (this.activeContact.phone && this.activeContact.phone === contactId))) {
      this.closeConversation();
    }

    this.renderChatsList();
  },

  toggleMessageSelection(msgId) {
    if (!msgId) return;

    if (this.selectedMessageIds.has(msgId)) {
      this.selectedMessageIds.delete(msgId);
    } else {
      this.selectedMessageIds.add(msgId);
    }

    this.isSelectionMode = this.selectedMessageIds.size > 0;
    this.updateSelectionUI();
  },

  clearMessageSelection() {
    this.selectedMessageIds.clear();
    this.isSelectionMode = false;
    this.updateSelectionUI();
  },

  updateSelectionUI() {
    const selectionBar = document.getElementById('chat-selection-bar');
    const header = document.getElementById('chat-header');
    const countLabel = document.getElementById('selection-count-label');

    if (this.isSelectionMode) {
      if (header) header.classList.add('selection-active');
      if (selectionBar) selectionBar.classList.remove('hidden');
      if (countLabel) countLabel.textContent = `${this.selectedMessageIds.size} Selected`;
    } else {
      if (header) header.classList.remove('selection-active');
      if (selectionBar) selectionBar.classList.add('hidden');
    }

    const container = document.getElementById('chat-messages-container');
    if (container) {
      container.querySelectorAll('.message-bubble').forEach(bubble => {
        const id = bubble.id;
        if (this.selectedMessageIds.has(id)) {
          bubble.classList.add('selected');
          if (!bubble.querySelector('.message-select-checkbox')) {
            const chk = document.createElement('div');
            chk.className = 'message-select-checkbox';
            chk.innerHTML = '<i class="fa-solid fa-check"></i>';
            bubble.appendChild(chk);
          }
        } else {
          bubble.classList.remove('selected');
          const chk = bubble.querySelector('.message-select-checkbox');
          if (chk) chk.remove();
        }
      });
    }
  },

  copySelectedMessages() {
    if (this.selectedMessageIds.size === 0 || !this.activeContact) return;

    const msgs = this.messages[this.activeContact.id] || [];
    const selectedMsgs = msgs.filter(m => this.selectedMessageIds.has(m.id));

    const textToCopy = selectedMsgs.map(m => {
      if (m.type === 'image') return '[📷 Photo]';
      if (m.type === 'voice') return '[🎤 Voice Note]';
      return m.text || '';
    }).filter(Boolean).join('\n');

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        if (window.showToast) window.showToast(`${selectedMsgs.length} message(s) copied to clipboard`, 'success');
      }).catch(() => {
        if (window.showToast) window.showToast('Could not copy messages', 'error');
      });
    }

    this.clearMessageSelection();
  },

  async deleteSingleMessage(msgId) {
    if (!msgId) return;
    this.selectedMessageIds.clear();
    this.selectedMessageIds.add(msgId);
    this.isSelectionMode = true;
    await this.deleteSelectedMessages();
  },

  async deleteSelectedMessages() {
    if (this.selectedMessageIds.size === 0 || !this.activeContact) return;

    const count = this.selectedMessageIds.size;
    const contactId = this.activeContact.id;
    const msgs = this.messages[contactId] || [];
    const selectedArray = Array.from(this.selectedMessageIds);

    const myUid = window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : 'me';
    const myPhone = window.AppConfig.currentUser ? window.AppConfig.currentUser.phone : '';
    const myCleanPhone = myPhone ? myPhone.replace(/\D/g, '') : '';

    // Check if any selected message is a received (incoming) message
    const hasReceivedMessage = selectedArray.some(mId => {
      const bubble = document.getElementById(mId);
      if (bubble && bubble.classList.contains('in')) return true;

      const m = msgs.find(msg => msg.id === mId);
      if (m) {
        const msgSenderClean = m.senderPhone ? m.senderPhone.replace(/\D/g, '') : '';
        const isOut = (m.sender === myUid) || (m.sender === 'me') || (myPhone && m.senderPhone === myPhone) || (myCleanPhone && msgSenderClean === myCleanPhone);
        if (!isOut) return true;
      }
      return false;
    });

    const allowEveryone = !hasReceivedMessage;

    const choice = await window.showDeleteChoiceModal(
      `Delete ${count} Message${count > 1 ? 's' : ''}?`,
      allowEveryone ? 'Choose how you want to delete the selected message(s).' : 'Received messages can only be deleted for you.',
      allowEveryone
    );

    if (!choice) return;

    if (choice === 'everyone') {
      if (!allowEveryone) {
        if (window.showToast) window.showToast('Cannot delete received messages for everyone', 'warning');
        return;
      }

      if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
        const chatId = this.getChatRoomId(this.activeContact);
        selectedArray.forEach(mId => {
          window.AppConfig.db.collection('chats').doc(chatId).collection('messages').doc(mId).delete()
            .catch(err => console.warn('Firestore msg delete notice:', err));
        });
      }

      this.messages[contactId] = (this.messages[contactId] || []).filter(m => !this.selectedMessageIds.has(m.id));
      try { MockDB.set('messages_' + contactId, this.messages[contactId]); } catch(e){}

      if (window.showToast) window.showToast(`${count} message(s) deleted for everyone`, 'info');
    } else if (choice === 'me') {
      this.messages[contactId] = (this.messages[contactId] || []).filter(m => !this.selectedMessageIds.has(m.id));
      try { MockDB.set('messages_' + contactId, this.messages[contactId]); } catch(e){}

      if (window.showToast) window.showToast(`${count} message(s) deleted for you`, 'info');
    }

    this.clearMessageSelection();
    this.renderMessages();
    this.renderChatsList();
  },

  openContactProfileModal() {
    if (!this.activeContact) return;
    const modal = document.getElementById('contact-profile-modal');
    if (!modal) return;

    let contactObj = this.activeContact;
    if (window.ContactsModule && window.ContactsModule.contacts) {
      const activeClean = this.activeContact.phone ? this.activeContact.phone.replace(/\D/g, '') : '';
      const found = window.ContactsModule.contacts.find(c => c.id === this.activeContact.id || (c.phone && c.phone.replace(/\D/g, '') === activeClean));
      if (found) contactObj = found;
    }

    const avatarUrl = contactObj.avatar || this.activeContact.avatar || ('https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(contactObj.phone || contactObj.id || contactObj.name || 'user2'));
    
    const viewAvatar = document.getElementById('view-contact-avatar');
    if (viewAvatar) {
      viewAvatar.src = avatarUrl;
      viewAvatar.style.display = 'block';
      viewAvatar.style.visibility = 'visible';
    }

    document.getElementById('view-contact-name').textContent = contactObj.name || this.activeContact.name;
    document.getElementById('view-contact-phone').textContent = contactObj.phone || this.activeContact.phone || '';
    document.getElementById('view-contact-about').textContent = contactObj.about || this.activeContact.about || 'Hey there! I am using TChat.';
    
    const statusEl = document.getElementById('chat-contact-status');
    if (statusEl) {
      document.getElementById('view-contact-status-text').textContent = statusEl.textContent;
    }

    modal.classList.add('active');
  },

  formatLastSeen(timestamp) {
    if (!timestamp) return 'last seen recently';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'last seen recently';

    const now = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `last seen today at ${timeStr}`;
    } else if (isYesterday) {
      return `last seen yesterday at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      return `last seen ${dateStr} at ${timeStr}`;
    }
  },

  getChatRoomId(contact) {
    if (!contact) return '';
    const myUser = window.AppConfig.currentUser || {};
    
    // Normalize phone numbers or fallback to UIDs
    const myKey = (myUser.phone ? myUser.phone.replace(/\D/g, '') : '') || myUser.uid || 'me';
    const contactKey = (contact.phone ? contact.phone.replace(/\D/g, '') : '') || contact.uid || contact.id;

    // Alphabetically sort the two keys so both Sender and Receiver generate the EXACT same room ID
    const roomKey = [myKey, contactKey].sort().join('_');
    return 'room_' + roomKey;
  },

  closeConversation() {
    this.closeChatSearch();
    this.clearMessageSelection();
    this.activeContact = null;
    localStorage.removeItem('tchat_active_chat_id');
    const noChat = document.getElementById('no-chat-selected');
    const activeChat = document.getElementById('active-chat-screen');
    if (noChat) noChat.classList.add('active');
    if (activeChat) activeChat.classList.remove('active');
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('chat-active');
    this.renderChatsList();
  },

  openConversation(contact) {
    this.closeChatSearch();
    this.clearMessageSelection();
    this.activeContact = contact;
    if (contact && contact.id) {
      localStorage.setItem('tchat_active_chat_id', contact.id);
    }
    
    // UI layout active state
    document.getElementById('no-chat-selected').classList.remove('active');
    document.getElementById('active-chat-screen').classList.add('active');
    document.querySelector('.app-container').classList.add('chat-active');

    // Header Meta
    const avatarUrl = contact.avatar || ('https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(contact.phone || contact.id || contact.name));
    const headerAvatar = document.getElementById('chat-contact-avatar');
    if (headerAvatar) headerAvatar.src = avatarUrl;
    document.getElementById('chat-contact-name').textContent = contact.name;
    
    const statusEl = document.getElementById('chat-contact-status');
    if (contact.online) {
      statusEl.textContent = 'online';
    } else if (contact.lastSeen) {
      statusEl.textContent = this.formatLastSeen(contact.lastSeen);
    } else {
      statusEl.textContent = 'last seen recently';
    }

    // Query Firestore for real-time online/lastSeen state
    if (window.AppConfig.isLiveFirebase && window.AppConfig.db && contact.phone) {
      window.AppConfig.db.collection('users').where('phone', '==', contact.phone).get().then(snap => {
        if (!snap.empty) {
          const uData = snap.docs[0].data();
          if (uData.online) {
            statusEl.textContent = 'online';
          } else if (uData.lastSeen) {
            statusEl.textContent = this.formatLastSeen(uData.lastSeen);
          }
        }
      }).catch(() => {});
    }

    this.isLoadingMessages = true;
    this.renderSkeletonMessages();
    this.loadMessagesForContact(contact);
    this.renderChatsList();
  },

  isSameContact(c1, c2) {
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.id && c2.id && c1.id === c2.id) return true;
    if (c1.uid && c2.uid && c1.uid === c2.uid) return true;
    
    const p1 = c1.phone ? c1.phone.replace(/\D/g, '') : '';
    const p2 = c2.phone ? c2.phone.replace(/\D/g, '') : '';
    if (p1 && p2 && p1 === p2) return true;

    return false;
  },

  loadMessagesForContact(contact) {
    if (!contact) return;
    const contactObj = typeof contact === 'object' ? contact : (window.ContactsModule ? window.ContactsModule.contacts.find(c => c.id === contact || (c.phone && contact && c.phone.replace(/\D/g, '') === String(contact).replace(/\D/g, ''))) : null);
    
    if (!contactObj) return;
    const contactId = contactObj.id;

    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      const chatId = this.getChatRoomId(contactObj);
      
      // Live Firestore Snapshot listener for this chat room
      window.AppConfig.db.collection('chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
          const list = [];
          snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          this.messages[contactId] = list;

          if (this.activeContact && this.isSameContact(this.activeContact, contactObj)) {
            this.renderMessages();
          }
          this.renderChatsList();
        }, err => console.warn('Messages snapshot listener notice:', err));
    } else {
      // Mock DB local storage
      const saved = MockDB.get('messages_' + contactId, null);
      if (saved && Array.isArray(saved)) {
        this.messages[contactId] = saved;
      } else {
        this.messages[contactId] = [];
      }
      if (this.activeContact && this.isSameContact(this.activeContact, contactObj)) {
        this.renderMessages();
      }
    }
  },

  handleSendMessage() {
    const txtInput = document.getElementById('message-input');
    const text = txtInput.value.trim();
    if (!text || !this.activeContact) return;

    this.sendMessage({
      type: 'text',
      text: text
    });

    txtInput.value = '';
    txtInput.dispatchEvent(new Event('input'));
    document.getElementById('emoji-picker-container').classList.add('hidden');
  },

  listenToAllUserChats() {
    if (!window.AppConfig.isLiveFirebase || !window.AppConfig.db || !window.AppConfig.currentUser) return;

    const myUid = window.AppConfig.currentUser.uid;
    const myPhoneClean = window.AppConfig.currentUser.phone ? window.AppConfig.currentUser.phone.replace(/\D/g, '') : '';

    const searchKeys = [myUid, myPhoneClean].filter(Boolean);
    if (searchKeys.length === 0) return;

    // Listen to all chat rooms where current user is a participant
    window.AppConfig.db.collection('chats')
      .where('participants', 'array-contains-any', searchKeys)
      .onSnapshot(snapshot => {
        snapshot.forEach(doc => {
          const roomData = doc.data();
          if (roomData && window.ContactsModule) {
            const parts = roomData.participants || [];
            const otherKey = parts.find(p => p !== myUid && p !== myPhoneClean);

            if (otherKey) {
              let existingContact = window.ContactsModule.contacts.find(c => {
                const cClean = c.phone ? c.phone.replace(/\D/g, '') : c.id;
                return cClean === otherKey || c.phone === otherKey || c.id === otherKey || c.id === roomData.senderUid;
              });

              if (!existingContact) {
                // Auto-create contact entry for receiver so conversation displays in sidebar
                const displayName = roomData.senderName || ('User ' + otherKey);
                const phoneNum = (typeof otherKey === 'string' && !otherKey.startsWith('+') && !otherKey.startsWith('user_')) ? ('+' + otherKey) : otherKey;
                window.ContactsModule.addContact(displayName, phoneNum);
                existingContact = window.ContactsModule.contacts.find(c => c.phone.replace(/\D/g, '') === otherKey);
              }

              if (existingContact) {
                this.loadMessagesForContact(existingContact);
              }
            }
          }
        });
        this.renderChatsList();
      }, err => console.warn('Global user chats listener notice:', err));
  },

  compressAndResizeImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        callback(compressedDataUrl);
      };
      img.onerror = () => {
        callback(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      if (window.showToast) window.showToast('Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);
  },

  openMediaGalleryModal() {
    this.selectedGalleryIds = [];
    this.galleryFilter = 'all';
    const modal = document.getElementById('media-gallery-modal');
    if (!modal) return;

    this.renderMediaGallery();
    modal.classList.add('active');
  },

  setGalleryFilter(filter) {
    this.galleryFilter = filter || 'all';
    document.querySelectorAll('.gallery-tab').forEach(tab => {
      if (tab.dataset.filter === this.galleryFilter) tab.classList.add('active');
      else tab.classList.remove('active');
    });
    this.renderMediaGallery();
  },

  renderMediaGallery() {
    const grid = document.getElementById('gallery-media-grid');
    if (!grid) return;

    const filtered = this.galleryLibrary.filter(item => {
      if (this.galleryFilter === 'photo') return item.type === 'image' || !item.isVideo;
      if (this.galleryFilter === 'video') return item.type === 'video' || item.isVideo;
      return true;
    });

    const uploadTileHtml = `
      <label class="gallery-media-tile gallery-upload-tile" for="gallery-browse-device-input" title="Browse device photos & videos">
        <div class="gallery-upload-icon"><i class="fa-solid fa-plus"></i></div>
        <span class="gallery-upload-text">Browse Files</span>
      </label>
    `;

    const tilesHtml = filtered.map(item => {
      const selectedIndex = this.selectedGalleryIds.indexOf(item.id);
      const isSelected = selectedIndex !== -1;
      const badgeText = isSelected ? (selectedIndex + 1) : '';

      const mediaHtml = item.isVideo ? `
        <video src="${item.url}" muted></video>
        <span class="gallery-type-icon"><i class="fa-solid fa-video"></i> Video</span>
      ` : `
        <img src="${item.url}" alt="${this.escapeHtml(item.name || 'Photo')}">
      `;

      return `
        <div class="gallery-media-tile ${isSelected ? 'selected' : ''}" onclick="ChatModule.toggleGallerySelection('${item.id}')">
          <div class="gallery-badge">${badgeText}</div>
          ${mediaHtml}
        </div>
      `;
    }).join('');

    grid.innerHTML = uploadTileHtml + tilesHtml;

    this.updateGalleryFooterState();
  },

  toggleGallerySelection(id) {
    const idx = this.selectedGalleryIds.indexOf(id);
    if (idx !== -1) {
      this.selectedGalleryIds.splice(idx, 1);
    } else {
      this.selectedGalleryIds.push(id);
    }
    this.renderMediaGallery();
  },

  updateGalleryFooterState() {
    const btnNext = document.getElementById('btn-confirm-gallery-select');
    const infoText = document.getElementById('gallery-footer-info');
    const countHeader = document.getElementById('gallery-selected-count');

    const count = this.selectedGalleryIds.length;
    if (countHeader) countHeader.textContent = count > 0 ? `(${count})` : '';

    if (btnNext) {
      btnNext.disabled = count === 0;
      btnNext.innerHTML = count > 0 ? `<i class="fa-solid fa-check"></i> Next (${count})` : `<i class="fa-solid fa-check"></i> Next`;
    }

    if (infoText) {
      infoText.textContent = count > 0 ? `${count} media item${count > 1 ? 's' : ''} selected` : 'Select photos or videos';
    }
  },

  handleDeviceGalleryFiles(files) {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter(f => f && f.type && (f.type.startsWith('image/') || f.type.startsWith('video/')));
    if (validFiles.length === 0) {
      if (window.showToast) window.showToast('Please select valid image or video file(s)', 'error');
      return;
    }

    let loadedCount = 0;
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const isVid = file.type.startsWith('video/');
        const newItem = {
          id: 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          type: isVid ? 'video' : 'image',
          isVideo: isVid,
          url: e.target.result,
          name: file.name
        };
        this.galleryLibrary.unshift(newItem);
        this.selectedGalleryIds.push(newItem.id);
        loadedCount++;

        if (loadedCount === validFiles.length) {
          this.renderMediaGallery();
        }
      };
      reader.readAsDataURL(file);
    });
  },

  confirmGallerySelection() {
    if (this.selectedGalleryIds.length === 0) return;

    const selectedItems = this.selectedGalleryIds.map(id => this.galleryLibrary.find(item => item.id === id)).filter(Boolean);

    const modal = document.getElementById('media-gallery-modal');
    if (modal) modal.classList.remove('active');

    this.pendingSendImages = selectedItems.map(item => ({
      dataUrl: item.url,
      type: item.type || (item.isVideo ? 'video' : 'image'),
      isVideo: !!item.isVideo,
      caption: ''
    }));

    this.selectedGalleryIds = [];
    this.openImageSendModal();
  },

  handleImageFileUpload(file) {
    if (file) this.handleMultipleImageFiles([file]);
  },

  handleMultipleImageFiles(files) {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter(f => f && f.type && (f.type.startsWith('image/') || f.type.startsWith('video/')));
    if (validFiles.length === 0) {
      if (window.showToast) window.showToast('Please select valid image or video file(s)', 'error');
      return;
    }

    let processedCount = 0;
    const items = [];

    validFiles.forEach((file, index) => {
      const isVid = file.type.startsWith('video/');
      if (isVid) {
        const reader = new FileReader();
        reader.onload = (e) => {
          items[index] = { dataUrl: e.target.result, type: 'video', isVideo: true, caption: '' };
          processedCount++;
          if (processedCount === validFiles.length) {
            this.pendingSendImages = items.filter(Boolean);
            this.activeImageIndex = 0;
            this.openImageSendModal();
          }
        };
        reader.readAsDataURL(file);
      } else {
        this.compressAndResizeImage(file, (dataUrl) => {
          items[index] = { dataUrl: dataUrl, type: 'image', isVideo: false, caption: '' };
          processedCount++;
          if (processedCount === validFiles.length) {
            this.pendingSendImages = items.filter(Boolean);
            this.activeImageIndex = 0;
            this.openImageSendModal();
          }
        });
      }
    });
  },

  openImageSendModal() {
    if (!this.pendingSendImages || this.pendingSendImages.length === 0) return;
    const modal = document.getElementById('image-send-modal');
    if (!modal) {
      this.sendPendingImages();
      return;
    }

    this.activeImageIndex = 0;
    this.renderImageModalPreview();
    modal.classList.add('active');

    const input = document.getElementById('image-caption-input');
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  },

  renderImageModalPreview() {
    if (!this.pendingSendImages || this.pendingSendImages.length === 0) return;
    const activeItem = this.pendingSendImages[this.activeImageIndex] || this.pendingSendImages[0];

    const titleEl = document.getElementById('image-modal-title');
    const imgEl = document.getElementById('image-preview-img');
    const stripEl = document.getElementById('image-thumbnails-strip');
    const captionInput = document.getElementById('image-caption-input');

    const total = this.pendingSendImages.length;
    const isVid = activeItem.isVideo || activeItem.type === 'video';
    if (titleEl) {
      titleEl.textContent = total > 1 ? `Send Media (${total})` : (isVid ? 'Send Video' : 'Send Photo');
    }

    if (imgEl) {
      if (isVid) {
        imgEl.style.display = 'none';
        let vidEl = document.getElementById('image-preview-video');
        if (!vidEl) {
          vidEl = document.createElement('video');
          vidEl.id = 'image-preview-video';
          vidEl.controls = true;
          vidEl.style.maxWidth = '100%';
          vidEl.style.maxHeight = '320px';
          vidEl.style.borderRadius = '8px';
          imgEl.parentElement.appendChild(vidEl);
        }
        vidEl.src = activeItem.dataUrl;
        vidEl.style.display = 'block';
      } else {
        const vidEl = document.getElementById('image-preview-video');
        if (vidEl) vidEl.style.display = 'none';
        imgEl.src = activeItem.dataUrl;
        imgEl.style.display = 'block';
      }
    }

    if (captionInput) {
      captionInput.value = activeItem.caption || '';
    }

    if (stripEl) {
      if (total > 1) {
        stripEl.classList.remove('hidden');
        stripEl.innerHTML = this.pendingSendImages.map((item, idx) => {
          const itemIsVid = item.isVideo || item.type === 'video';
          return itemIsVid ? `
            <video src="${item.dataUrl}" class="image-thumb-item ${idx === this.activeImageIndex ? 'active' : ''}" onclick="ChatModule.switchImageModalTab(${idx})" title="Video ${idx + 1}"></video>
          ` : `
            <img src="${item.dataUrl}" class="image-thumb-item ${idx === this.activeImageIndex ? 'active' : ''}" onclick="ChatModule.switchImageModalTab(${idx})" title="Photo ${idx + 1}">
          `;
        }).join('');
      } else {
        stripEl.classList.add('hidden');
        stripEl.innerHTML = '';
      }
    }
  },

  switchImageModalTab(idx) {
    if (idx < 0 || idx >= this.pendingSendImages.length) return;
    const captionInput = document.getElementById('image-caption-input');
    if (captionInput && this.pendingSendImages[this.activeImageIndex]) {
      this.pendingSendImages[this.activeImageIndex].caption = captionInput.value.trim();
    }

    this.activeImageIndex = idx;
    this.renderImageModalPreview();
  },

  sendPendingImages() {
    const captionInput = document.getElementById('image-caption-input');
    if (captionInput && this.pendingSendImages[this.activeImageIndex]) {
      this.pendingSendImages[this.activeImageIndex].caption = captionInput.value.trim();
    }

    const modal = document.getElementById('image-send-modal');
    if (modal) modal.classList.remove('active');

    const itemsToSend = [...this.pendingSendImages];
    this.pendingSendImages = [];
    this.activeImageIndex = 0;

    itemsToSend.forEach(item => {
      this.sendMessage({
        type: item.type || (item.isVideo ? 'video' : 'image'),
        mediaUrl: item.dataUrl,
        text: item.caption || ''
      });
    });
  },

  cancelPendingImages() {
    const modal = document.getElementById('image-send-modal');
    if (modal) modal.classList.remove('active');
    this.pendingSendImages = [];
    this.activeImageIndex = 0;
  },

  handleDocumentFileUpload(file) {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      if (window.showToast) window.showToast('File size must be under 15MB', 'error');
      return;
    }

    if (window.showToast) window.showToast(`Uploading ${file.name}...`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      this.sendMessage({
        type: 'document',
        text: file.name,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        fileUrl: dataUrl,
        isPdf: isPdf
      });
    };
    reader.readAsDataURL(file);
  },

  dataURLtoBlob(dataurl) {
    if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) return null;
    try {
      const arr = dataurl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch(err) {
      console.warn('DataURL to blob error:', err);
      return null;
    }
  },

  initPdfReaderControls() {
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const btnPrev = document.getElementById('btn-pdf-prev-page');
    const btnNext = document.getElementById('btn-pdf-next-page');
    const pageNumInput = document.getElementById('pdf-page-num');
    const btnZoomIn = document.getElementById('btn-pdf-zoom-in');
    const btnZoomOut = document.getElementById('btn-pdf-zoom-out');
    const zoomSelect = document.getElementById('pdf-zoom-select');
    const btnRotate = document.getElementById('btn-pdf-rotate');
    const btnToggleSidebar = document.getElementById('btn-toggle-pdf-sidebar');
    const btnPrint = document.getElementById('btn-pdf-print');
    const btnFullscreen = document.getElementById('btn-pdf-fullscreen');
    const btnFallbackDownload = document.getElementById('btn-pdf-fallback-download');

    if (btnPrev) btnPrev.onclick = () => this.changePdfPage(-1);
    if (btnNext) btnNext.onclick = () => this.changePdfPage(1);

    if (pageNumInput) {
      pageNumInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (this.pdfState.pdfDoc && val >= 1 && val <= this.pdfState.pdfDoc.numPages) {
          this.queueRenderPdfPage(val);
        } else if (this.pdfState.pdfDoc) {
          pageNumInput.value = this.pdfState.pageNum;
        }
      });
    }

    if (btnZoomIn) btnZoomIn.onclick = () => this.zoomPdf(0.25);
    if (btnZoomOut) btnZoomOut.onclick = () => this.zoomPdf(-0.25);

    if (zoomSelect) {
      zoomSelect.addEventListener('change', (e) => {
        this.setPdfScaleOption(e.target.value);
      });
    }

    if (btnRotate) btnRotate.onclick = () => this.rotatePdf();
    if (btnToggleSidebar) btnToggleSidebar.onclick = () => this.togglePdfSidebar();
    if (btnPrint) btnPrint.onclick = () => this.printPdf();
    if (btnFullscreen) btnFullscreen.onclick = () => this.togglePdfFullscreen();
    if (btnFallbackDownload) btnFallbackDownload.onclick = () => this.downloadDocumentFile();

    // Global Keyboard Shortcuts for PDF Viewer
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('document-viewer-modal');
      if (!modal || !modal.classList.contains('active') || !this.pdfState.pdfDoc) return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.changePdfPage(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        this.changePdfPage(1);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.zoomPdf(0.25);
      } else if (e.key === '-') {
        e.preventDefault();
        this.zoomPdf(-0.25);
      } else if (e.key === 'Escape') {
        this.closeDocumentViewerModal();
      }
    });
  },

  openDocumentByMsgId(msgId) {
    let msg = this.documentCache[msgId];
    if (!msg && this.activeContact && this.messages[this.activeContact.id]) {
      msg = this.messages[this.activeContact.id].find(m => m.id === msgId);
    }
    if (!msg) {
      // Search all conversation message lists
      for (const catKey in this.messages) {
        const found = (this.messages[catKey] || []).find(m => m.id === msgId);
        if (found) { msg = found; break; }
      }
    }
    if (msg) {
      const url = msg.fileUrl || msg.mediaUrl || msg.url;
      const fileName = msg.fileName || msg.text || 'Document';
      this.openDocumentFile(url, fileName);
    } else {
      if (window.showToast) window.showToast('Document unavailable', 'warning');
    }
  },

  openDocumentFile(dataUrl, fileName = 'Document') {
    if (!dataUrl) {
      if (window.showToast) window.showToast('Document content unavailable', 'warning');
      return;
    }

    this.activeViewingDocName = fileName;
    this.activeViewingDocUrl = dataUrl;

    const modal = document.getElementById('document-viewer-modal');
    const titleEl = document.getElementById('doc-modal-title');

    if (titleEl) titleEl.textContent = fileName;

    const isPdf = fileName.toLowerCase().endsWith('.pdf') || 
                  (dataUrl && dataUrl.startsWith('data:application/pdf')) ||
                  (dataUrl && dataUrl.toLowerCase().includes('application/pdf'));

    const pdfContainer = document.getElementById('pdf-reader-container');
    const nonPdfContainer = document.getElementById('non-pdf-iframe-container');
    const pdfToolbarControls = document.getElementById('pdf-toolbar-controls');

    if (isPdf && window.pdfjsLib) {
      if (pdfContainer) pdfContainer.classList.remove('hidden');
      if (nonPdfContainer) nonPdfContainer.classList.add('hidden');
      if (pdfToolbarControls) pdfToolbarControls.style.display = 'flex';

      // Reset PDF state
      this.pdfState.pdfDoc = null;
      this.pdfState.pageNum = 1;
      this.pdfState.pageRendering = false;
      this.pdfState.pageNumPending = null;
      this.pdfState.scale = 1.0;
      this.pdfState.rotation = 0;
      this.pdfState.sidebarOpen = false;

      const sidebarContainer = document.getElementById('pdf-sidebar-container');
      if (sidebarContainer) sidebarContainer.classList.add('hidden');

      const zoomSelect = document.getElementById('pdf-zoom-select');
      if (zoomSelect) zoomSelect.value = '1.0';

      const loadingSpinner = document.getElementById('pdf-loading-spinner');
      const errorOverlay = document.getElementById('pdf-error-overlay');
      if (loadingSpinner) loadingSpinner.classList.remove('hidden');
      if (errorOverlay) errorOverlay.classList.add('hidden');

      // Clear canvas
      const canvas = document.getElementById('pdf-render-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      const thumbList = document.getElementById('pdf-thumbnails-list');
      if (thumbList) thumbList.innerHTML = '';

      if (modal) modal.classList.add('active');

      let loadingTask;
      try {
        if (dataUrl.startsWith('data:')) {
          const blob = this.dataURLtoBlob(dataUrl);
          if (blob) {
            if (this.pdfState.activeBlobUrl) {
              URL.revokeObjectURL(this.pdfState.activeBlobUrl);
            }
            const blobUrl = URL.createObjectURL(blob);
            this.pdfState.activeBlobUrl = blobUrl;
            loadingTask = pdfjsLib.getDocument(blobUrl);
          } else {
            loadingTask = pdfjsLib.getDocument(dataUrl);
          }
        } else {
          loadingTask = pdfjsLib.getDocument(dataUrl);
        }

        loadingTask.promise.then((pdfDoc_) => {
          this.pdfState.pdfDoc = pdfDoc_;
          const pageCountEl = document.getElementById('pdf-page-count');
          const sidebarCountEl = document.getElementById('pdf-sidebar-count');
          if (pageCountEl) pageCountEl.textContent = pdfDoc_.numPages;
          if (sidebarCountEl) sidebarCountEl.textContent = `${pdfDoc_.numPages} page${pdfDoc_.numPages > 1 ? 's' : ''}`;

          const pageNumInput = document.getElementById('pdf-page-num');
          if (pageNumInput) {
            pageNumInput.max = pdfDoc_.numPages;
            pageNumInput.value = 1;
          }

          if (loadingSpinner) loadingSpinner.classList.add('hidden');
          this.renderPdfPage(1);
          this.generatePdfThumbnails();
        }).catch((err) => {
          console.error('Error loading PDF:', err);
          if (loadingSpinner) loadingSpinner.classList.add('hidden');
          if (errorOverlay) {
            const errEl = document.getElementById('pdf-error-msg');
            if (errEl) errEl.textContent = 'Failed to load PDF preview: ' + (err.message || 'Corrupt or unsupported format');
            errorOverlay.classList.remove('hidden');
          }
        });
      } catch(err) {
        console.error('Exception loading PDF:', err);
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        if (errorOverlay) errorOverlay.classList.remove('hidden');
      }

    } else {
      // Fallback for non-PDF documents
      if (pdfContainer) pdfContainer.classList.add('hidden');
      if (nonPdfContainer) nonPdfContainer.classList.remove('hidden');
      if (pdfToolbarControls) pdfToolbarControls.style.display = 'none';

      let targetSrc = dataUrl;
      const blob = this.dataURLtoBlob(dataUrl);
      if (blob) {
        targetSrc = URL.createObjectURL(blob);
      }
      const iframe = document.getElementById('doc-viewer-iframe');
      if (iframe) iframe.src = targetSrc;

      if (modal) modal.classList.add('active');
    }
  },

  renderPdfPage(num) {
    if (!this.pdfState.pdfDoc) return;
    this.pdfState.pageRendering = true;
    this.pdfState.pageNum = num;

    const pageNumInput = document.getElementById('pdf-page-num');
    if (pageNumInput) pageNumInput.value = num;

    this.updateActiveThumbnail(num);

    this.pdfState.pdfDoc.getPage(num).then((page) => {
      const canvas = document.getElementById('pdf-render-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const viewport = page.getViewport({
        scale: this.pdfState.scale,
        rotation: this.pdfState.rotation
      });

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";

      const transform = outputScale !== 1
        ? [outputScale, 0, 0, outputScale, 0, 0]
        : null;

      const renderContext = {
        canvasContext: ctx,
        transform: transform,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);

      renderTask.promise.then(() => {
        this.pdfState.pageRendering = false;
        if (this.pdfState.pageNumPending !== null) {
          const pending = this.pdfState.pageNumPending;
          this.pdfState.pageNumPending = null;
          this.renderPdfPage(pending);
        }
      });
    }).catch(err => {
      console.error('Error rendering PDF page:', err);
      this.pdfState.pageRendering = false;
    });
  },

  queueRenderPdfPage(num) {
    if (this.pdfState.pageRendering) {
      this.pdfState.pageNumPending = num;
    } else {
      this.renderPdfPage(num);
    }
  },

  changePdfPage(delta) {
    if (!this.pdfState.pdfDoc) return;
    const newPage = this.pdfState.pageNum + delta;
    if (newPage >= 1 && newPage <= this.pdfState.pdfDoc.numPages) {
      this.queueRenderPdfPage(newPage);
    }
  },

  zoomPdf(delta) {
    if (!this.pdfState.pdfDoc) return;
    let newScale = this.pdfState.scale + delta;
    if (newScale < 0.25) newScale = 0.25;
    if (newScale > 3.0) newScale = 3.0;

    this.pdfState.scale = newScale;
    const zoomSelect = document.getElementById('pdf-zoom-select');
    if (zoomSelect) {
      const match = Array.from(zoomSelect.options).find(opt => Math.abs(parseFloat(opt.value) - newScale) < 0.05);
      if (match) zoomSelect.value = match.value;
    }
    this.queueRenderPdfPage(this.pdfState.pageNum);
  },

  setPdfScaleOption(val) {
    if (!this.pdfState.pdfDoc) return;
    if (val === 'fit-width') {
      this.pdfState.pdfDoc.getPage(this.pdfState.pageNum).then(page => {
        const viewportContainer = document.getElementById('pdf-canvas-viewport');
        const containerWidth = (viewportContainer ? viewportContainer.clientWidth : 800) - 48;
        const pageViewport = page.getViewport({ scale: 1.0, rotation: this.pdfState.rotation });
        this.pdfState.scale = Math.max(0.5, containerWidth / pageViewport.width);
        this.queueRenderPdfPage(this.pdfState.pageNum);
      });
    } else if (val === 'fit-page') {
      this.pdfState.pdfDoc.getPage(this.pdfState.pageNum).then(page => {
        const viewportContainer = document.getElementById('pdf-canvas-viewport');
        const containerHeight = (viewportContainer ? viewportContainer.clientHeight : 600) - 48;
        const pageViewport = page.getViewport({ scale: 1.0, rotation: this.pdfState.rotation });
        this.pdfState.scale = Math.max(0.4, containerHeight / pageViewport.height);
        this.queueRenderPdfPage(this.pdfState.pageNum);
      });
    } else {
      this.pdfState.scale = parseFloat(val) || 1.0;
      this.queueRenderPdfPage(this.pdfState.pageNum);
    }
  },

  rotatePdf() {
    if (!this.pdfState.pdfDoc) return;
    this.pdfState.rotation = (this.pdfState.rotation + 90) % 360;
    this.queueRenderPdfPage(this.pdfState.pageNum);
  },

  togglePdfSidebar() {
    const sidebar = document.getElementById('pdf-sidebar-container');
    if (sidebar) {
      sidebar.classList.toggle('hidden');
      this.pdfState.sidebarOpen = !sidebar.classList.contains('hidden');
    }
  },

  generatePdfThumbnails() {
    const thumbList = document.getElementById('pdf-thumbnails-list');
    if (!thumbList || !this.pdfState.pdfDoc) return;
    thumbList.innerHTML = '';

    const numPages = this.pdfState.pdfDoc.numPages;
    for (let i = 1; i <= numPages; i++) {
      const thumbItem = document.createElement('div');
      thumbItem.className = `pdf-thumbnail-item ${i === this.pdfState.pageNum ? 'active' : ''}`;
      thumbItem.dataset.pageNum = i;
      thumbItem.onclick = () => this.queueRenderPdfPage(i);

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.className = 'pdf-thumbnail-canvas';

      const label = document.createElement('span');
      label.className = 'pdf-thumbnail-label';
      label.textContent = `Page ${i}`;

      thumbItem.appendChild(thumbCanvas);
      thumbItem.appendChild(label);
      thumbList.appendChild(thumbItem);

      ((pageNo, canvasEl) => {
        this.pdfState.pdfDoc.getPage(pageNo).then(page => {
          const thumbViewport = page.getViewport({ scale: 0.2 });
          canvasEl.width = thumbViewport.width;
          canvasEl.height = thumbViewport.height;
          const ctx = canvasEl.getContext('2d');
          page.render({
            canvasContext: ctx,
            viewport: thumbViewport
          });
        });
      })(i, thumbCanvas);
    }
  },

  updateActiveThumbnail(pageNum) {
    const thumbItems = document.querySelectorAll('.pdf-thumbnail-item');
    thumbItems.forEach(item => {
      if (parseInt(item.dataset.pageNum) === pageNum) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('active');
      }
    });
  },

  printPdf() {
    if (!this.activeViewingDocUrl) return;
    const url = this.activeViewingDocUrl;
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.focus();
      setTimeout(() => {
        try { printWindow.print(); } catch(e) {}
      }, 500);
    }
  },

  togglePdfFullscreen() {
    const dialog = document.querySelector('.doc-viewer-dialog');
    if (dialog) {
      dialog.classList.toggle('pdf-fullscreen-mode');
    }
  },

  closeDocumentViewerModal() {
    const modal = document.getElementById('document-viewer-modal');
    if (modal) modal.classList.remove('active');

    const dialog = document.querySelector('.doc-viewer-dialog');
    if (dialog) dialog.classList.remove('pdf-fullscreen-mode');

    const iframe = document.getElementById('doc-viewer-iframe');
    if (iframe) iframe.src = '';

    if (this.pdfState.activeBlobUrl) {
      URL.revokeObjectURL(this.pdfState.activeBlobUrl);
      this.pdfState.activeBlobUrl = null;
    }
    this.pdfState.pdfDoc = null;
  },

  openDocumentInNewTab() {
    if (!this.activeViewingDocUrl) return;
    let url = this.activeViewingDocUrl;
    const blob = this.dataURLtoBlob(url);
    if (blob) {
      url = URL.createObjectURL(blob);
    }
    window.open(url, '_blank');
  },

  isEmojiOnly(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 12) return false;
    try {
      const emojiRegex = /^[\p{Extended_Pictographic}\s\u200d\ufe0f]+$/u;
      return emojiRegex.test(trimmed);
    } catch(e) {
      const fallbackRegex = /^[\u00a9\u00ae\u2000-\u3300\ud83c\ud000-\udfff\ud83d\ud000-\udfff\ud83e\ud000-\udfff\u2600-\u27bf\s]+$/;
      return fallbackRegex.test(trimmed);
    }
  },

  downloadDocumentFile() {
    if (!this.activeViewingDocUrl) return;
    const fileName = this.activeViewingDocName || 'download';
    let url = this.activeViewingDocUrl;
    const blob = this.dataURLtoBlob(url);
    if (blob) {
      url = URL.createObjectURL(blob);
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  sendMessage(payload) {
    if (!this.activeContact) return;

    const myUser = window.AppConfig.currentUser || {};
    const myUid = myUser.uid || 'me';
    const myPhone = myUser.phone || '';
    const myAvatar = myUser.avatar || ('https://api.dicebear.com/7.x/bottts/svg?seed=' + myUid);
    const myName = myUser.name || 'TChat User';
    const myPhoneClean = myPhone ? myPhone.replace(/\D/g, '') : myUid;

    const contactPhoneClean = this.activeContact.phone ? this.activeContact.phone.replace(/\D/g, '') : (this.activeContact.uid || this.activeContact.id);

    const msgObj = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sender: myUid,
      senderPhone: myPhone,
      senderName: myName,
      senderAvatar: myAvatar,
      type: payload.type || 'text',
      text: payload.text || '',
      mediaUrl: payload.mediaUrl || null,
      voiceUrl: payload.voiceUrl || null,
      fileName: payload.fileName || null,
      fileSize: payload.fileSize || null,
      fileUrl: payload.fileUrl || null,
      isPdf: payload.isPdf || false,
      quote: this.quotingMessage ? { ...this.quotingMessage } : null,
      reactions: [],
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    const contactId = this.activeContact.id;
    if (!this.messages[contactId]) this.messages[contactId] = [];

    // Optimistically push message to local active list and re-render
    const existingIdx = this.messages[contactId].findIndex(m => m.id === msgObj.id);
    if (existingIdx === -1) {
      this.messages[contactId].push(msgObj);
    }
    this.renderMessages();

    // Play Sound
    if (window.SoundManager) {
      window.SoundManager.playSend();
    }

    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      const chatId = this.getChatRoomId(this.activeContact);
      
      // 1. Save room-level metadata so receiver's device discovers the chat with avatar
      window.AppConfig.db.collection('chats').doc(chatId).set({
        chatId: chatId,
        participants: [myPhoneClean, contactPhoneClean, myUid, this.activeContact.uid || ''].filter(Boolean),
        lastMessage: payload.text || (payload.type === 'image' ? '📷 Photo' : (payload.type === 'voice' ? '🎤 Voice note' : (payload.type === 'document' ? ('📄 ' + (payload.fileName || 'Document')) : 'Message'))),
        lastTimestamp: msgObj.timestamp,
        senderUid: myUid,
        senderPhone: myPhoneClean,
        senderName: myName,
        senderAvatar: myAvatar
      }, { merge: true }).catch(err => console.warn('Chat room set notice:', err));

      // 2. Save message document
      window.AppConfig.db.collection('chats').doc(chatId).collection('messages').doc(msgObj.id).set(msgObj)
        .catch(err => {
          console.error('Error saving message to Firestore:', err);
          if (window.showToast) window.showToast('Could not save photo to server', 'error');
        });
    } else {
      try {
        MockDB.set('messages_' + contactId, this.messages[contactId]);
      } catch(e) {
        console.warn('MockDB storage notice:', e);
      }

      // Simulated Status Transitions for Local Mode: Sent -> Delivered -> Read
      setTimeout(() => {
        msgObj.status = 'delivered';
        try { MockDB.set('messages_' + contactId, this.messages[contactId]); } catch(e){}
        if (this.activeContact && this.activeContact.id === contactId) {
          this.renderMessages();
        }
      }, 1200);

      setTimeout(() => {
        msgObj.status = 'read';
        try { MockDB.set('messages_' + contactId, this.messages[contactId]); } catch(e){}
        if (this.activeContact && this.activeContact.id === contactId) {
          this.renderMessages();
        }
      }, 2600);
    }

    this.clearQuote();
    this.renderChatsList();
  },

  renderMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !this.activeContact) return;

    let msgs = this.messages[this.activeContact.id] || [];
    if (msgs.length === 0) {
      const activeClean = this.activeContact.phone ? this.activeContact.phone.replace(/\D/g, '') : '';
      if (activeClean) {
        for (const cid in this.messages) {
          const c = window.ContactsModule ? window.ContactsModule.contacts.find(x => x.id === cid) : null;
          if (c && c.phone && c.phone.replace(/\D/g, '') === activeClean) {
            msgs = this.messages[cid];
            break;
          }
        }
      }
    }

    const myUser = window.AppConfig.currentUser || {};
    const myUid = myUser.uid || 'me';
    const myPhone = myUser.phone || '';
    const myAvatar = myUser.avatar || ('https://api.dicebear.com/7.x/bottts/svg?seed=' + myUid);
    const myCleanPhone = myPhone ? myPhone.replace(/\D/g, '') : '';

    container.innerHTML = msgs.map(m => {
      const msgSenderClean = m.senderPhone ? m.senderPhone.replace(/\D/g, '') : '';
      const isOut = (m.sender === myUid) || (myPhone && m.senderPhone === myPhone) || (myCleanPhone && msgSenderClean === myCleanPhone);
      const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const avatarSrc = isOut ? (m.senderAvatar || myAvatar) : (m.senderAvatar || (this.activeContact ? this.activeContact.avatar : ''));

      let checkHtml = '';
      if (isOut) {
        if (m.status === 'read' || m.status === 'seen') {
          checkHtml = `<i class="fa-solid fa-check-double check-icon read" title="Seen"></i>`;
        } else if (m.status === 'delivered') {
          checkHtml = `<i class="fa-solid fa-check-double check-icon delivered" title="Delivered"></i>`;
        } else {
          checkHtml = `<i class="fa-solid fa-check check-icon sent" title="Sent"></i>`;
        }
      }

      let quoteHtml = '';
      if (m.quote) {
        const qSenderClean = m.quote.senderPhone ? m.quote.senderPhone.replace(/\D/g, '') : '';
        const isQuoteMine = (m.quote.sender === myUid) || (myPhone && m.quote.senderPhone === myPhone) || (myCleanPhone && qSenderClean === myCleanPhone);
        const quoteAuthor = isQuoteMine ? 'You' : (this.activeContact ? this.activeContact.name : 'Sender');

        quoteHtml = `
          <div class="message-quote" onclick="event.stopPropagation(); ChatModule.scrollToMessage('${m.quote.id}')" title="Click to view original message">
            <span class="quote-author-name">${this.escapeHtml(quoteAuthor)}</span>
            <div class="quote-body-text">${this.escapeHtml(m.quote.text || (m.quote.type === 'image' ? '📷 Photo' : '🎤 Voice note'))}</div>
          </div>
        `;
      }

      let bodyHtml = '';
      if (m.type === 'image') {
        const captionHtml = m.text ? `<p class="image-caption-text">${this.escapeHtml(m.text)}</p>` : '';
        bodyHtml = `<img src="${m.mediaUrl}" class="message-image" alt="Uploaded photo" onclick="event.stopPropagation(); ChatModule.openImageLightbox('${m.mediaUrl}')" title="Click to view full size photo">${captionHtml}`;
      } else if (m.type === 'voice') {
        bodyHtml = `
          <div class="voice-note-player">
            <button class="btn-play-voice" onclick="ChatModule.playAudioVoice('${m.voiceUrl}', this)"><i class="fa-solid fa-play"></i></button>
            <div class="voice-waveform-preview">
              <span class="waveform-bar active" style="height:12px"></span>
              <span class="waveform-bar active" style="height:20px"></span>
              <span class="waveform-bar active" style="height:14px"></span>
              <span class="waveform-bar active" style="height:18px"></span>
              <span class="waveform-bar active" style="height:10px"></span>
            </div>
          </div>
        `;
      } else if (m.type === 'document' || (m.text && m.text.startsWith('📄'))) {
        this.documentCache[m.id] = m;
        const rawText = m.text || '';
        const fileName = m.fileName || rawText.replace(/^📄\s*/, '').replace(/\s*\([\d.]+\s*KB\)$/, '') || 'Document';
        const fileSize = m.fileSize || (rawText.match(/\(([\d.]+\s*KB)\)/) ? rawText.match(/\(([\d.]+\s*KB)\)/)[1] : 'File');
        const isPdf = m.isPdf || fileName.toLowerCase().endsWith('.pdf') || (m.fileUrl && m.fileUrl.startsWith('data:application/pdf'));

        bodyHtml = `
          <div class="document-card" onclick="event.stopPropagation(); ChatModule.openDocumentByMsgId('${m.id}')" title="Click to open ${this.escapeHtml(fileName)}">
            <div class="doc-icon-wrapper ${isPdf ? 'pdf' : ''}">
              <i class="fa-solid ${isPdf ? 'fa-file-pdf' : 'fa-file-lines'}"></i>
            </div>
            <div class="doc-details">
              <span class="doc-title">${this.escapeHtml(fileName)}</span>
              <span class="doc-subtitle">${fileSize} • Click to open</span>
            </div>
            <div class="doc-download-icon">
              <i class="fa-solid fa-circle-down"></i>
            </div>
          </div>
        `;
      } else {
        const isEmojiMsg = this.isEmojiOnly(m.text);
        if (isEmojiMsg) {
          bodyHtml = `<p class="emoji-only-text">${this.escapeHtml(m.text)}</p>`;
        } else {
          bodyHtml = `<p>${this.escapeHtml(m.text)}</p>`;
        }
      }

      const isEmojiOnlyBubble = (m.type === 'text' || !m.type) && this.isEmojiOnly(m.text);

      let senderTagHtml = '';
      if (!isOut && this.activeContact) {
        senderTagHtml = `<span class="sender-name-header">${this.escapeHtml(this.activeContact.name)}</span>`;
      }

      let reactionHtml = '';
      if (m.reactions && m.reactions.length > 0) {
        reactionHtml = `<div class="message-reactions">${m.reactions.join(' ')}</div>`;
      }

      const isSelected = this.selectedMessageIds.has(m.id);

      return `
        <div class="message-row ${isOut ? 'out' : 'in'}">
          <img src="${avatarSrc}" class="message-bubble-avatar" alt="Avatar" title="${isOut ? 'You' : this.escapeHtml(this.activeContact ? this.activeContact.name : '')}">
          <div class="message-bubble ${isOut ? 'out' : 'in'} ${isEmojiOnlyBubble ? 'emoji-bubble' : ''} ${isSelected ? 'selected' : ''}" id="${m.id}" onclick="if(ChatModule.isSelectionMode){ ChatModule.toggleMessageSelection('${m.id}'); }" ondblclick="ChatModule.quoteMessage('${m.id}')" title="Double click to reply / mention message">
            ${isSelected ? '<div class="message-select-checkbox"><i class="fa-solid fa-check"></i></div>' : ''}
            <button class="message-reply-btn" title="Reply / Mention message" onclick="event.stopPropagation(); ChatModule.quoteMessage('${m.id}')">
              <i class="fa-solid fa-reply"></i>
            </button>
            ${senderTagHtml}
            ${quoteHtml}
            ${bodyHtml}
            <div class="message-meta">
              <span>${timeStr}</span>
              ${checkHtml}
            </div>
            ${reactionHtml}
          </div>
        </div>
      `;
    }).join('');

    // Bind touch and drag swipe-to-reply events
    this.bindMessageSwipeEvents(container);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  },

  quoteMessage(msgId) {
    if (!this.activeContact) return;
    const list = this.messages[this.activeContact.id] || [];
    const target = list.find(m => m.id === msgId);
    if (target) {
      this.quotingMessage = target;
      const bar = document.getElementById('quote-preview-bar');
      const myUid = window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : 'me';
      const myPhone = window.AppConfig.currentUser ? window.AppConfig.currentUser.phone : '';
      const isMine = target.sender === myUid || (myPhone && target.senderPhone === myPhone);
      
      document.getElementById('quote-sender-name').textContent = isMine ? 'You' : this.activeContact.name;
      document.getElementById('quote-text-content').textContent = target.text || (target.type === 'image' ? '📷 Photo' : '🎤 Voice message');
      bar.classList.remove('hidden');

      const txtInput = document.getElementById('message-input');
      if (txtInput) txtInput.focus();
    }
  },

  bindMessageSwipeEvents(container) {
    const rows = container.querySelectorAll('.message-row');
    rows.forEach(row => {
      const bubble = row.querySelector('.message-bubble');
      if (!bubble) return;
      const msgId = bubble.id;
      if (!msgId) return;

      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let isSwiping = false;
      let swipeIcon = null;

      // Touch gesture listeners (Mobile)
      row.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = 0;
        isSwiping = false;
      }, { passive: true });

      row.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        const diffX = e.touches[0].clientX - startX;
        const diffY = e.touches[0].clientY - startY;

        // Slide right gesture to mention/quote message
        if (diffX > 10 && Math.abs(diffX) > Math.abs(diffY)) {
          isSwiping = true;
          currentX = Math.min(diffX * 0.5, 75); // Dampened spring resistance

          if (!swipeIcon) {
            swipeIcon = document.createElement('div');
            swipeIcon.className = 'swipe-reply-indicator';
            swipeIcon.innerHTML = '<i class="fa-solid fa-reply"></i>';
            row.insertBefore(swipeIcon, row.firstChild);
          }

          row.style.transform = `translateX(${currentX}px)`;
          row.style.transition = 'none';

          if (currentX > 32) {
            swipeIcon.classList.add('active');
          } else {
            swipeIcon.classList.remove('active');
          }
        }
      }, { passive: true });

      const resetTouchSwipe = () => {
        if (isSwiping) {
          row.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
          row.style.transform = 'translateX(0)';

          if (currentX > 32) {
            this.quoteMessage(msgId);
          }

          setTimeout(() => {
            if (swipeIcon && swipeIcon.parentNode) {
              swipeIcon.parentNode.removeChild(swipeIcon);
            }
            swipeIcon = null;
            row.style.transform = '';
            row.style.transition = '';
          }, 250);
        }
        isSwiping = false;
      };

      row.addEventListener('touchend', resetTouchSwipe);
      row.addEventListener('touchcancel', resetTouchSwipe);

      // Mouse drag gesture listeners (Desktop drag-to-reply)
      let isMouseDown = false;

      row.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isMouseDown = true;
        startX = e.clientX;
        startY = e.clientY;
        currentX = 0;
        isSwiping = false;
      });

      row.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const diffX = e.clientX - startX;
        const diffY = e.clientY - startY;

        if (diffX > 12 && Math.abs(diffX) > Math.abs(diffY)) {
          isSwiping = true;
          currentX = Math.min(diffX * 0.5, 75);

          if (!swipeIcon) {
            swipeIcon = document.createElement('div');
            swipeIcon.className = 'swipe-reply-indicator';
            swipeIcon.innerHTML = '<i class="fa-solid fa-reply"></i>';
            row.insertBefore(swipeIcon, row.firstChild);
          }

          row.style.transform = `translateX(${currentX}px)`;
          row.style.transition = 'none';

          if (currentX > 32) {
            swipeIcon.classList.add('active');
          } else {
            swipeIcon.classList.remove('active');
          }
        }
      });

      const endMouseSwipe = () => {
        if (isMouseDown) {
          isMouseDown = false;
          resetTouchSwipe();
        }
      };

      row.addEventListener('mouseup', endMouseSwipe);
      row.addEventListener('mouseleave', endMouseSwipe);
    });
  },

  scrollToMessage(msgId) {
    if (!msgId) return;
    const el = document.getElementById(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-msg');
      setTimeout(() => el.classList.remove('highlight-msg'), 1800);
    }
  },

  handleMentionInput(text) {
    const popover = document.getElementById('mention-popover');
    if (!popover) return;

    const atIndex = text.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === text.length - 1 || text.substring(atIndex).length < 20)) {
      this.renderMentionSuggestions();
      popover.classList.remove('hidden');
    } else {
      popover.classList.add('hidden');
    }
  },

  renderMentionSuggestions() {
    const listEl = document.getElementById('mention-suggestions-list');
    if (!listEl || !this.activeContact) return;

    const msgs = (this.messages[this.activeContact.id] || []).slice(-5).reverse();
    const myUid = window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : 'me';

    let html = `
      <div class="mention-item" onclick="ChatModule.selectMentionContact('${this.escapeHtml(this.activeContact.name)}')">
        <img src="${this.activeContact.avatar}" class="mention-avatar" alt="Avatar">
        <div class="mention-info">
          <strong>@${this.escapeHtml(this.activeContact.name)}</strong>
          <span>Tag contact in message</span>
        </div>
      </div>
    `;

    msgs.forEach(m => {
      const isMine = m.sender === myUid;
      const author = isMine ? 'You' : this.activeContact.name;
      const preview = m.text || (m.type === 'image' ? 'Photo' : 'Voice Note');

      html += `
        <div class="mention-item" onclick="ChatModule.quoteMessage('${m.id}'); document.getElementById('mention-popover').classList.add('hidden');">
          <i class="fa-solid fa-reply mention-icon"></i>
          <div class="mention-info">
            <strong>Reply to ${this.escapeHtml(author)}</strong>
            <span>"${this.escapeHtml(preview)}"</span>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  },

  selectMentionContact(name) {
    const txtInput = document.getElementById('message-input');
    if (txtInput) {
      const atIndex = txtInput.value.lastIndexOf('@');
      if (atIndex !== -1) {
        txtInput.value = txtInput.value.substring(0, atIndex) + '@' + name + ' ';
      } else {
        txtInput.value += '@' + name + ' ';
      }
      txtInput.focus();
      txtInput.dispatchEvent(new Event('input'));
    }
    const popover = document.getElementById('mention-popover');
    if (popover) popover.classList.add('hidden');
  },

  clearQuote() {
    this.quotingMessage = null;
    document.getElementById('quote-preview-bar').classList.add('hidden');
  },

  playAudioVoice(url, btnEl) {
    if (!url) return;

    if (this.currentPlayingAudio) {
      this.currentPlayingAudio.pause();
      if (this.currentPlayingBtn) {
        this.currentPlayingBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      }
      if (this.currentPlayingAudio.src === url || (url.startsWith('data:') && this.currentPlayingAudio.src.startsWith('data:'))) {
        this.currentPlayingAudio = null;
        this.currentPlayingBtn = null;
        return;
      }
    }

    const audio = new Audio(url);
    this.currentPlayingAudio = audio;
    this.currentPlayingBtn = btnEl;

    if (btnEl) {
      btnEl.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    audio.onended = () => {
      if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-play"></i>';
      this.currentPlayingAudio = null;
      this.currentPlayingBtn = null;
    };

    audio.onerror = () => {
      if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-play"></i>';
      if (window.showToast) window.showToast('Failed to play voice message', 'error');
      this.currentPlayingAudio = null;
      this.currentPlayingBtn = null;
    };

    audio.play().catch(err => {
      console.error('Audio play error:', err);
      if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-play"></i>';
    });
  },

  openImageLightbox(imgSrc) {
    if (!imgSrc) return;
    const modal = document.getElementById('image-lightbox-modal');
    const img = document.getElementById('lightbox-full-img');
    if (modal && img) {
      img.src = imgSrc;
      modal.classList.add('active');
    }
  },

  renderSkeletonChatsList() {
    const container = document.getElementById('chats-list');
    if (!container) return;

    let html = '';
    for (let i = 0; i < 5; i++) {
      html += `
        <div class="skeleton-chat-item">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-info">
            <div class="skeleton-row-top">
              <div class="skeleton-title"></div>
              <div class="skeleton-time"></div>
            </div>
            <div class="skeleton-subtitle"></div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  renderSkeletonMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-messages-wrapper">
        <div class="skeleton-msg-bubble in">
          <div class="skeleton-msg-avatar"></div>
          <div class="skeleton-msg-content">
            <div class="skeleton-line w-3-4"></div>
            <div class="skeleton-line w-1-2"></div>
          </div>
        </div>
        <div class="skeleton-msg-bubble out">
          <div class="skeleton-msg-content">
            <div class="skeleton-line w-full"></div>
            <div class="skeleton-line w-2-3"></div>
          </div>
          <div class="skeleton-msg-avatar"></div>
        </div>
        <div class="skeleton-msg-bubble in">
          <div class="skeleton-msg-avatar"></div>
          <div class="skeleton-msg-content">
            <div class="skeleton-line w-1-2"></div>
          </div>
        </div>
      </div>
    `;
  },

  renderChatsList() {
    const container = document.getElementById('chats-list');
    const emptyState = document.getElementById('chats-empty-state');
    if (!container) return;

    if (!window.ContactsModule) return;

    const contacts = window.ContactsModule.contacts;
    
    // Filter to only non-deleted contacts with active message history, currently open chat, or pinned state
    const activeConversations = contacts.filter(c => {
      if (this.deletedChats[c.id]) return false;
      const msgs = this.messages[c.id] || [];
      const isActive = this.activeContact && this.activeContact.id === c.id;
      const isPinned = !!this.pinnedChats[c.id];
      return msgs.length > 0 || isActive || isPinned;
    });

    // Sort active conversations: Pinned chats first, then by last message timestamp
    activeConversations.sort((a, b) => {
      const aPinned = !!this.pinnedChats[a.id];
      const bPinned = !!this.pinnedChats[b.id];
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      const msgsA = this.messages[a.id] || [];
      const msgsB = this.messages[b.id] || [];
      const lastA = msgsA.length > 0 ? (msgsA[msgsA.length - 1].timestamp || 0) : 0;
      const lastB = msgsB.length > 0 ? (msgsB[msgsB.length - 1].timestamp || 0) : 0;
      return lastB - lastA;
    });

    if (activeConversations.length === 0 && !this.isLoadingChats) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = activeConversations.map(c => {
      const msgs = this.messages[c.id] || [];
      const lastMsg = msgs[msgs.length - 1];
      const snippet = lastMsg ? (lastMsg.type === 'image' ? '📷 Photo' : (lastMsg.type === 'voice' ? '🎤 Voice note' : lastMsg.text)) : c.about;
      const time = lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const isActive = this.activeContact && this.activeContact.id === c.id;
      const isPinned = !!this.pinnedChats[c.id];

      return `
        <div class="chat-item ${isActive ? 'active' : ''} ${isPinned ? 'pinned' : ''}" onclick="ContactsModule.startChatWithContact('${c.id}')">
          <div class="chat-avatar-wrapper">
            <img src="${c.avatar}" alt="${this.escapeHtml(c.name)}">
            ${c.online ? '<span class="online-dot"></span>' : ''}
          </div>
          <div class="chat-details">
            <div class="chat-row-top">
              <span class="chat-name">${this.escapeHtml(c.name)}${c.isGroup ? ' <span class="chat-group-badge"><i class="fa-solid fa-users"></i> Group</span>' : ''}</span>
              <span class="chat-time">${time}</span>
            </div>
            <div class="chat-row-bottom">
              <span class="chat-snippet">${this.escapeHtml(snippet || '')}</span>
              <div class="chat-item-actions">
                ${isPinned ? '<i class="fa-solid fa-thumbtack pin-icon" title="Pinned chat"></i>' : ''}
                <button class="chat-item-menu-btn" title="Chat options" onclick="event.stopPropagation(); ChatModule.toggleChatItemMenu(event, '${c.id}')">
                  <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  loadAllChats() {
    this.isLoadingChats = true;
    this.renderSkeletonChatsList();

    if (window.AppConfig.isLiveFirebase && window.AppConfig.db && window.AppConfig.currentUser) {
      this.listenToAllUserChats();
      if (window.ContactsModule && window.ContactsModule.contacts) {
        window.ContactsModule.contacts.forEach(c => {
          this.loadMessagesForContact(c);
        });
      }
    }

    setTimeout(() => {
      this.isLoadingChats = false;
      this.renderChatsList();
      this.restoreActiveChatOnReload();
    }, 450);
  },

  restoreActiveChatOnReload() {
    const savedChatId = localStorage.getItem('tchat_active_chat_id');
    if (!savedChatId) return;

    if (window.ContactsModule && window.ContactsModule.contacts) {
      const contact = window.ContactsModule.contacts.find(c => c.id === savedChatId || (c.phone && c.phone.replace(/\D/g, '') === savedChatId.replace(/\D/g, '')));
      if (contact) {
        this.openConversation(contact);
      }
    }
  },

  createGroupChat(groupName, avatarUrl, selectedMemberIds, selectedMemberNames = []) {
    const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const currentUser = (window.AuthModule && window.AuthModule.currentUser) || MockDB.get('current_session') || { name: 'You', uid: 'user_me' };
    const creatorName = currentUser.name || 'You';
    const creatorId = currentUser.uid || currentUser.id || 'user_me';

    // Deduplicate IDs and names ensuring creator is always present first
    const finalMemberIds = Array.from(new Set([creatorId, ...selectedMemberIds]));
    let finalMemberNames = Array.from(new Set([creatorName, ...selectedMemberNames]));

    const groupContact = {
      id: groupId,
      name: groupName,
      avatar: avatarUrl || ('https://api.dicebear.com/7.x/shapes/svg?seed=' + encodeURIComponent(groupName)),
      about: `${finalMemberNames.length} members: ${finalMemberNames.join(', ')}`,
      isGroup: true,
      members: finalMemberIds,
      memberNames: finalMemberNames,
      createdBy: creatorName
    };

    if (window.ContactsModule) {
      window.ContactsModule.contacts.unshift(groupContact);
      window.ContactsModule.saveContacts();
    }

    if (!this.messages[groupId]) {
      this.messages[groupId] = [];
    }

    this.messages[groupId].push({
      id: 'sys_' + Date.now(),
      senderId: 'system',
      senderName: 'System',
      text: `${creatorName} created group "${groupName}" (${finalMemberNames.length} members, Admin: ${creatorName})`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read',
      isSystem: true
    });

    if (window.AppConfig && window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      window.AppConfig.db.collection('chats').doc(groupId).set({
        ...groupContact,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    if (window.showToast) {
      window.showToast(`Group "${groupName}" created with you as Admin!`, 'success');
    }

    this.renderChatsList();
    this.openConversation(groupContact);
  },

  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.ChatModule = ChatModule;
