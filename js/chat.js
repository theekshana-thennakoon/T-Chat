/* ==========================================================================
   REAL-TIME CHAT MESSAGING ENGINE
   ========================================================================== */

const ChatModule = {
  activeContact: null,
  messages: {},
  quotingMessage: null,
  firestoreListener: null,

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
        const text = e.target.value.trim();
        const iconMic = document.getElementById('icon-mic');
        const iconSend = document.getElementById('icon-send');
        
        if (text.length > 0) {
          iconMic.classList.add('hidden');
          iconSend.classList.remove('hidden');
        } else {
          iconMic.classList.remove('hidden');
          iconSend.classList.add('hidden');
        }

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

    // Attachment input listeners
    const fileImg = document.getElementById('attach-image-input');
    if (fileImg) {
      fileImg.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            this.sendMessage({
              type: 'image',
              mediaUrl: evt.target.result
            });
          };
          reader.readAsDataURL(file);
          document.getElementById('attach-dropdown').classList.add('hidden');
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

    // Search bar filtering
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        this.filterChatsList(term);
      });
    }
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

  openConversation(contact) {
    this.activeContact = contact;
    
    // UI layout active state
    document.getElementById('no-chat-selected').classList.remove('active');
    document.getElementById('active-chat-screen').classList.add('active');
    document.querySelector('.app-container').classList.add('chat-active');

    // Header Meta
    document.getElementById('chat-contact-avatar').src = contact.avatar;
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

    this.loadMessagesForContact(contact.id);
    this.renderChatsList();
  },

  loadMessagesForContact(contactId) {
    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      // Live Firestore Snapshot listener
      if (this.firestoreListener) this.firestoreListener();
      
      const chatId = this.getChatRoomId(window.AppConfig.currentUser.uid, contactId);
      this.firestoreListener = window.AppConfig.db.collection('chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
          const list = [];
          snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          this.messages[contactId] = list;
          this.renderMessages();
        });
    } else {
      // Mock DB local storage
      const saved = MockDB.get('messages_' + contactId, null);
      if (saved && Array.isArray(saved)) {
        this.messages[contactId] = saved;
      } else {
        this.messages[contactId] = [];
        MockDB.set('messages_' + contactId, this.messages[contactId]);
      }
      this.renderMessages();
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

  sendMessage(payload) {
    if (!this.activeContact) return;

    const myUid = window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : 'me';
    const msgObj = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sender: myUid,
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
    this.messages[contactId].push(msgObj);

    // Play Sound
    if (window.SoundManager) {
      window.SoundManager.playSend();
    }

    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      const chatId = this.getChatRoomId(myUid, contactId);
      window.AppConfig.db.collection('chats').doc(chatId).collection('messages').doc(msgObj.id).set(msgObj);
    } else {
      MockDB.set('messages_' + contactId, this.messages[contactId]);
      this.renderMessages();
    }

    this.clearQuote();
    this.renderChatsList();
  },

  renderMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !this.activeContact) return;

    const list = this.messages[this.activeContact.id] || [];
    const myUid = window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : 'me';

    container.innerHTML = list.map(m => {
      const isOut = m.sender === myUid;
      const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      let checkHtml = '';
      if (isOut) {
        if (m.status === 'read') {
          checkHtml = `<i class="fa-solid fa-check-double check-icon read"></i>`;
        } else if (m.status === 'delivered') {
          checkHtml = `<i class="fa-solid fa-check-double check-icon"></i>`;
        } else {
          checkHtml = `<i class="fa-solid fa-check check-icon"></i>`;
        }
      }

      let quoteHtml = '';
      if (m.quote) {
        quoteHtml = `
          <div class="message-quote">
            <span class="quote-author-name">${m.quote.sender === myUid ? 'You' : this.activeContact.name}</span>
            <div class="quote-body-text">${m.quote.text || 'Media message'}</div>
          </div>
        `;
      }

      let bodyHtml = '';
      if (m.type === 'image') {
        bodyHtml = `<img src="${m.mediaUrl}" class="message-image" alt="Uploaded photo">`;
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

      return `
        <div class="message-bubble ${isOut ? 'out' : 'in'}" id="${m.id}">
          ${senderTagHtml}
          ${quoteHtml}
          ${bodyHtml}
          <div class="message-meta">
            <span>${timeStr}</span>
            ${checkHtml}
          </div>
          ${reactionHtml}
        </div>
      `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  },

  quoteMessage(msgId) {
    const list = this.messages[this.activeContact.id] || [];
    const target = list.find(m => m.id === msgId);
    if (target) {
      this.quotingMessage = target;
      const bar = document.getElementById('quote-preview-bar');
      document.getElementById('quote-sender-name').textContent = target.sender === (window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : 'me') ? 'You' : this.activeContact.name;
      document.getElementById('quote-text-content').textContent = target.text || 'Attachment';
      bar.classList.remove('hidden');
    }
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

  renderChatsList() {
    const container = document.getElementById('chats-list');
    const emptyState = document.getElementById('chats-empty-state');
    if (!container) return;

    if (!window.ContactsModule) return;

    const contacts = window.ContactsModule.contacts;
    
    // Filter to only contacts with active message history or currently open chat
    const activeConversations = contacts.filter(c => {
      const msgs = this.messages[c.id] || [];
      const isActive = this.activeContact && this.activeContact.id === c.id;
      return msgs.length > 0 || isActive;
    });

    if (activeConversations.length === 0) {
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

      return `
        <div class="chat-item ${isActive ? 'active' : ''}" onclick="ContactsModule.startChatWithContact('${c.id}')">
          <div class="chat-avatar-wrapper">
            <img src="${c.avatar}" alt="${c.name}">
            ${c.online ? '<span class="online-dot"></span>' : ''}
          </div>
          <div class="chat-details">
            <div class="chat-row-top">
              <span class="chat-name">${c.name}</span>
              <span class="chat-time">${time}</span>
            </div>
            <div class="chat-row-bottom">
              <span class="chat-snippet">${snippet}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  loadAllChats() {
    if (window.AppConfig.isLiveFirebase && window.AppConfig.db && window.AppConfig.currentUser) {
      if (window.ContactsModule && window.ContactsModule.contacts) {
        window.ContactsModule.contacts.forEach(c => {
          this.loadMessagesForContact(c.id);
        });
      }
    }
    this.renderChatsList();
  },

  getChatRoomId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
  },

  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.ChatModule = ChatModule;
