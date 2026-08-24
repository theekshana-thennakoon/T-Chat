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

  openConversation(contact) {
    this.activeContact = contact;
    
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
        lastMessage: payload.text || (payload.type === 'image' ? '📷 Photo' : '🎤 Voice note'),
        lastTimestamp: msgObj.timestamp,
        senderUid: myUid,
        senderPhone: myPhoneClean,
        senderName: myName,
        senderAvatar: myAvatar
      }, { merge: true });

      // 2. Save message document
      window.AppConfig.db.collection('chats').doc(chatId).collection('messages').doc(msgObj.id).set(msgObj);
    } else {
      this.messages[contactId].push(msgObj);
      MockDB.set('messages_' + contactId, this.messages[contactId]);
      this.renderMessages();

      // Simulated Status Transitions for Local Mode: Sent -> Delivered -> Read
      setTimeout(() => {
        msgObj.status = 'delivered';
        MockDB.set('messages_' + contactId, this.messages[contactId]);
        if (this.activeContact && this.activeContact.id === contactId) {
          this.renderMessages();
        }
      }, 1200);

      setTimeout(() => {
        msgObj.status = 'read';
        MockDB.set('messages_' + contactId, this.messages[contactId]);
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
        <div class="message-row ${isOut ? 'out' : 'in'}">
          <img src="${avatarSrc}" class="message-bubble-avatar" alt="Avatar" title="${isOut ? 'You' : this.escapeHtml(this.activeContact ? this.activeContact.name : '')}">
          <div class="message-bubble ${isOut ? 'out' : 'in'}" id="${m.id}" ondblclick="ChatModule.quoteMessage('${m.id}')" title="Double click to reply / mention message">
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
    
    // Filter to only contacts with active message history or currently open chat
    const activeConversations = contacts.filter(c => {
      const msgs = this.messages[c.id] || [];
      const isActive = this.activeContact && this.activeContact.id === c.id;
      return msgs.length > 0 || isActive;
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
    }, 450);
  },

  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.ChatModule = ChatModule;
