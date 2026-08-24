/* ==========================================================================
   WHATSAPP STATUS / STORIES MODULE (24-HOUR EXPIRATION & STORY PLAYER)
   ========================================================================== */

const StatusModule = {
  statuses: [],
  activeStoryGroup: null,
  activeStoryIndex: 0,
  storyTimer: null,
  isPaused: false,

  init() {
    this.bindEvents();
    this.loadStatuses();
  },

  bindEvents() {
    // Open Create Text Status modal
    const btnTextStatus = document.getElementById('btn-create-text-status');
    if (btnTextStatus) {
      btnTextStatus.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('create-text-status-modal').classList.add('active');
      });
    }

    // Canvas background color switcher
    const colorCircles = document.querySelectorAll('.color-circle');
    colorCircles.forEach(circle => {
      circle.addEventListener('click', () => {
        colorCircles.forEach(c => c.classList.remove('active'));
        circle.classList.add('active');
        const bgClass = circle.dataset.bg;
        const canvas = document.getElementById('text-status-canvas');
        canvas.className = `status-canvas ${bgClass}`;
      });
    });

    // Publish Text Status
    const btnPublish = document.getElementById('btn-publish-text-status');
    if (btnPublish) {
      btnPublish.addEventListener('click', () => this.handlePublishTextStatus());
    }

    // Close Modals
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.remove('active');
      });
    });

    // Story Player Controls
    const btnCloseStory = document.getElementById('btn-close-story');
    if (btnCloseStory) {
      btnCloseStory.addEventListener('click', () => this.closeStoryViewer());
    }

    const btnPauseStory = document.getElementById('btn-pause-story');
    if (btnPauseStory) {
      btnPauseStory.addEventListener('click', () => this.togglePauseStory());
    }

    // Story Navigation tap zones
    const navPrev = document.getElementById('story-nav-prev');
    const navNext = document.getElementById('story-nav-next');
    if (navPrev) navPrev.addEventListener('click', () => this.prevStory());
    if (navNext) navNext.addEventListener('click', () => this.nextStory());

    // Story reply button
    const btnSendReply = document.getElementById('btn-send-status-reply');
    if (btnSendReply) {
      btnSendReply.addEventListener('click', () => this.handleStatusReply());
    }
  },

  handlePublishTextStatus() {
    const txtInput = document.getElementById('text-status-input');
    const text = txtInput.value.trim();
    if (!text) {
      alert('Status text cannot be empty.');
      return;
    }

    const canvas = document.getElementById('text-status-canvas');
    const bgClass = canvas.className.replace('status-canvas ', '');
    const user = window.AppConfig.currentUser || { uid: 'me', name: 'Alex Morgan', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=user1' };

    const statusObj = {
      id: 'status_' + Date.now(),
      userId: user.uid,
      userName: user.name,
      userAvatar: user.avatar,
      type: 'text',
      text: text,
      bgClass: bgClass,
      timestamp: new Date().toISOString(),
      views: []
    };

    this.statuses.unshift(statusObj);
    this.saveStatuses();
    
    txtInput.value = '';
    document.getElementById('create-text-status-modal').classList.remove('active');
    alert('Status published!');
    this.renderStatusTab();
  },

  loadStatuses() {
    const saved = MockDB.get('app_statuses', null);
    if (saved && Array.isArray(saved)) {
      this.statuses = saved;
    } else {
      this.statuses = [];
      this.saveStatuses();
    }

    this.filterExpiredStatuses();
    this.renderStatusTab();
  },

  // WhatsApp 24-hour expiration filter rule
  filterExpiredStatuses() {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    this.statuses = this.statuses.filter(s => {
      const created = new Date(s.timestamp).getTime();
      return (now - created) < TWENTY_FOUR_HOURS;
    });
    this.saveStatuses();
  },

  saveStatuses() {
    MockDB.set('app_statuses', this.statuses);
  },

  renderStatusTab() {
    this.filterExpiredStatuses();

    const myUid = window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : 'me';
    const myStatuses = this.statuses.filter(s => s.userId === myUid);
    
    // Update My Status card subtext
    const subtext = document.getElementById('my-status-subtext');
    if (subtext) {
      if (myStatuses.length > 0) {
        const last = myStatuses[0];
        const time = new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        subtext.textContent = `Today at ${time}`;
      } else {
        subtext.textContent = 'Tap to add status update';
      }
    }

    const containerRecent = document.getElementById('recent-statuses-list');
    const containerViewed = document.getElementById('viewed-statuses-list');

    if (!containerRecent) return;

    const contactStatuses = this.statuses.filter(s => s.userId !== myUid);

    // Group by User
    const grouped = {};
    contactStatuses.forEach(s => {
      if (!grouped[s.userId]) {
        grouped[s.userId] = {
          userId: s.userId,
          userName: s.userName,
          userAvatar: s.userAvatar,
          items: []
        };
      }
      grouped[s.userId].items.push(s);
    });

    const groupsList = Object.values(grouped);

    if (groupsList.length === 0) {
      containerRecent.innerHTML = `<p class="empty-state">No recent status updates.</p>`;
    } else {
      containerRecent.innerHTML = groupsList.map(g => {
        const lastItem = g.items[0];
        const timeStr = new Date(lastItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="chat-item" onclick="StatusModule.openStoryViewer('${g.userId}')">
            <div class="status-ring-avatar">
              <img src="${g.userAvatar}" alt="${g.userName}">
            </div>
            <div class="chat-details">
              <div class="chat-row-top">
                <span class="chat-name">${g.userName}</span>
              </div>
              <div class="chat-row-bottom">
                <span class="chat-snippet">Today at ${timeStr}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  openStoryViewer(userId) {
    const userItems = this.statuses.filter(s => s.userId === userId);
    if (userItems.length === 0) return;

    this.activeStoryGroup = userItems;
    this.activeStoryIndex = 0;
    this.isPaused = false;

    document.getElementById('status-viewer-modal').classList.add('active');
    this.renderCurrentStoryItem();
  },

  renderCurrentStoryItem() {
    if (!this.activeStoryGroup || this.activeStoryIndex >= this.activeStoryGroup.length) {
      this.closeStoryViewer();
      return;
    }

    const item = this.activeStoryGroup[this.activeStoryIndex];

    // Top Meta
    document.getElementById('story-author-avatar').src = item.userAvatar;
    document.getElementById('story-author-name').textContent = item.userName;
    document.getElementById('story-time-ago').textContent = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Display Area
    const textView = document.getElementById('story-text-view');
    const imageView = document.getElementById('story-image-view');

    if (item.type === 'text') {
      imageView.classList.add('hidden');
      textView.className = `story-text-wrapper ${item.bgClass}`;
      document.getElementById('story-text-content').textContent = item.text;
    } else {
      textView.className = 'story-text-wrapper hidden';
      imageView.src = item.mediaUrl;
      imageView.classList.remove('hidden');
    }

    // Render Progress Bar Segments
    const barContainer = document.getElementById('story-progress-bar-container');
    barContainer.innerHTML = this.activeStoryGroup.map((_, idx) => `
      <div class="progress-bar-segment">
        <div class="progress-fill" id="pfill_${idx}" style="width: ${idx < this.activeStoryIndex ? '100%' : '0%'}"></div>
      </div>
    `).join('');

    this.startStoryTimer();
  },

  startStoryTimer() {
    if (this.storyTimer) clearInterval(this.storyTimer);
    
    let progress = 0;
    const fillEl = document.getElementById(`pfill_${this.activeStoryIndex}`);

    this.storyTimer = setInterval(() => {
      if (this.isPaused) return;

      progress += 2;
      if (fillEl) fillEl.style.width = progress + '%';

      if (progress >= 100) {
        clearInterval(this.storyTimer);
        this.nextStory();
      }
    }, 100);
  },

  nextStory() {
    this.activeStoryIndex++;
    this.renderCurrentStoryItem();
  },

  prevStory() {
    if (this.activeStoryIndex > 0) {
      this.activeStoryIndex--;
      this.renderCurrentStoryItem();
    }
  },

  togglePauseStory() {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('btn-pause-story');
    if (btn) {
      btn.innerHTML = this.isPaused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
    }
  },

  closeStoryViewer() {
    if (this.storyTimer) clearInterval(this.storyTimer);
    document.getElementById('status-viewer-modal').classList.remove('active');
  },

  handleStatusReply() {
    const input = document.getElementById('story-reply-text');
    const text = input.value.trim();
    if (!text || !this.activeStoryGroup) return;

    const currentStory = this.activeStoryGroup[this.activeStoryIndex];
    this.closeStoryViewer();

    // Open chat with story creator & send reply
    if (window.ContactsModule && window.ChatModule) {
      let contact = window.ContactsModule.contacts.find(c => c.id === currentStory.userId);
      if (!contact) {
        contact = {
          id: currentStory.userId,
          name: currentStory.userName,
          avatar: currentStory.userAvatar,
          phone: '+91 9876543210'
        };
      }
      window.ChatModule.openConversation(contact);
      window.ChatModule.sendMessage({
        type: 'text',
        text: `Replied to status "${currentStory.text || 'Photo'}": ${text}`
      });
    }

    input.value = '';
  }
};

window.StatusModule = StatusModule;
