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

  init() {
    this.bindEvents();
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

    // Attachment input listeners & Paste listener for multiple images
    const fileImg = document.getElementById('attach-image-input');
    if (fileImg) {
      fileImg.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          if (window.showToast) {
            window.showToast(`Sending ${files.length} photo${files.length > 1 ? 's' : ''}...`, 'info');
          }
          files.forEach(file => this.handleImageFileUpload(file));
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
            if (window.showToast) {
              window.showToast(`Sending ${imageFiles.length} pasted photo${imageFiles.length > 1 ? 's' : ''}...`, 'info');
            }
            imageFiles.forEach(file => this.handleImageFileUpload(file));
          }
        }
      });
    }

    const fileDoc = document.getElementById('attach-file-input');
    if (fileDoc) {
      fileDoc.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.handleDocumentFileUpload(file);
          fileDoc.value = '';
          const drop = document.getElementById('attach-dropdown');
          if (drop) drop.classList.add('hidden');
        }
      });
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

  handleImageFileUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      if (window.showToast) window.showToast('Please select a valid image file', 'error');
      return;
    }

    this.compressAndResizeImage(file, (compressedDataUrl) => {
      this.sendMessage({
        type: 'image',
        mediaUrl: compressedDataUrl
      });
    });
  },

  handleDocumentFileUpload(file) {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      if (window.showToast) window.showToast('File size must be under 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.sendMessage({
        type: 'text',
        text: `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
      });
    };
    reader.readAsDataURL(file);
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
        lastMessage: payload.text || (payload.type === 'image' ? '📷 Photo' : (payload.type === 'voice' ? '🎤 Voice note' : 'Message')),
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
        bodyHtml = `<img src="${m.mediaUrl}" class="message-image" alt="Uploaded photo" onclick="event.stopPropagation(); ChatModule.openImageLightbox('${m.mediaUrl}')" title="Click to view full size photo">`;
      } else if (m.type === 'voice') {
        bodyHtml = `
          <div class="voice-note-player">
            <button class="btn-play-voice" onclick="ChatModule.playAudioVoice('${m.voiceUrl}')"><i class="fa-solid fa-play"></i></button>
            <div class="voice-waveform-preview">
              <span class="waveform-bar active" style="height:12px"></span>
              <span class="waveform-bar active" style="height:20px"></span>
              <span class="waveform-bar active" style="height:14px"></span>
              <span class="waveform-bar active" style="height:18px"></span>
              <span class="waveform-bar active" style="height:10px"></span>
            </div>
          </div>
        `;
      } else {
        bodyHtml = `<p>${this.escapeHtml(m.text)}</p>`;
      }

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
          <div class="message-bubble ${isOut ? 'out' : 'in'} ${isSelected ? 'selected' : ''}" id="${m.id}" onclick="if(ChatModule.isSelectionMode){ ChatModule.toggleMessageSelection('${m.id}'); }" ondblclick="ChatModule.quoteMessage('${m.id}')" title="Double click to reply / mention message">
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

  playAudioVoice(url) {
    if (url) {
      const audio = new Audio(url);
      audio.play();
    }
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
              <span class="chat-name">${this.escapeHtml(c.name)}</span>
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

  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.ChatModule = ChatModule;
