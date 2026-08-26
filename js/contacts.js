/* ==========================================================================
   CONTACTS & MOBILE PHONEBOOK MATCHING MODULE
   ========================================================================== */

const ContactsModule = {
  contacts: [],

  init() {
    this.bindEvents();
    this.loadContacts();
    this.syncFirebaseUsers();
  },

  bindEvents() {
    // Import Web Contacts button (Mobile Chrome / Safari API)
    const btnImport = document.getElementById('btn-import-web-contacts');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.requestWebContacts());
    }

    // Import .VCF file listener
    const fileVcf = document.getElementById('input-vcf-file');
    if (fileVcf) {
      fileVcf.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => this.parseAndImportVCF(evt.target.result);
          reader.readAsText(file);
        }
      });
    }

    // Add manual contact button
    const btnAdd = document.getElementById('btn-add-manual-contact');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const modal = document.getElementById('add-contact-modal');
        if (modal) modal.classList.add('active');
      });
    }

    // Save manual contact button
    const btnSave = document.getElementById('btn-save-new-contact');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.handleSaveManualContact());
    }

    // Group creation button in Contacts tab
    const btnCreateGroup = document.getElementById('btn-open-create-group-contacts');
    if (btnCreateGroup) {
      btnCreateGroup.addEventListener('click', () => this.openCreateGroupModal());
    }

    const btnCloseGroup = document.getElementById('btn-close-group-modal');
    const btnCancelGroup = document.getElementById('btn-cancel-create-group');
    if (btnCloseGroup) btnCloseGroup.onclick = () => this.closeCreateGroupModal();
    if (btnCancelGroup) btnCancelGroup.onclick = () => this.closeCreateGroupModal();

    const btnConfirmGroup = document.getElementById('btn-confirm-create-group');
    if (btnConfirmGroup) {
      btnConfirmGroup.onclick = () => this.handleCreateGroupSubmit();
    }

    const fileGroupAvatar = document.getElementById('group-avatar-file');
    if (fileGroupAvatar) {
      fileGroupAvatar.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const img = document.getElementById('group-avatar-img');
            if (img) img.src = evt.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
    }
  },

  // HTML5 Web Contacts Picker API (Mobile Browsers)
  async requestWebContacts() {
    if ('contacts' in navigator && 'select' in navigator.contacts) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const selected = await navigator.contacts.select(props, opts);
        
        if (selected && selected.length > 0) {
          let addedCount = 0;
          selected.forEach(c => {
            const name = c.name && c.name.length > 0 ? c.name[0] : 'Phone Contact';
            const tel = c.tel && c.tel.length > 0 ? c.tel[0] : '';
            if (tel) {
              if (this.addContact(name, tel)) addedCount++;
            }
          });
          alert(`Successfully synced ${addedCount} contacts from your device!`);
          this.renderContactsList();
        }
      } catch (err) {
        console.warn('Web Contacts API Error:', err);
        alert('Could not access device contacts. Use the "Import .VCF File" button or add contacts manually.');
      }
    } else {
      alert('Web Contacts API is supported on mobile Chrome & Safari. On Desktop, use "Import .VCF File" to import exported contacts!');
    }
  },

  // VCF / vCard File Parser (.vcf)
  parseAndImportVCF(vcfContent) {
    if (!vcfContent) return;

    const cards = vcfContent.split('BEGIN:VCARD');
    let imported = 0;

    cards.forEach(card => {
      let name = '';
      let tel = '';

      const lines = card.split(/\r?\n/);
      lines.forEach(line => {
        if (line.startsWith('FN:') || line.startsWith('N:')) {
          const val = line.substring(line.indexOf(':') + 1).replace(/;/g, ' ').trim();
          if (val && !name) name = val;
        } else if (line.includes('TEL') && line.includes(':')) {
          const val = line.substring(line.indexOf(':') + 1).trim();
          if (val && !tel) tel = val;
        }
      });

      if (name && tel) {
        if (this.addContact(name, tel)) imported++;
      }
    });

    alert(`Imported ${imported} contacts from .VCF file!`);
    this.renderContactsList();
  },

  // Manual Contact Creation
  handleSaveManualContact() {
    const name = document.getElementById('new-contact-name').value.trim();
    const phone = document.getElementById('new-contact-phone').value.trim();

    if (!name || !phone) {
      alert('Please enter both contact name and phone number.');
      return;
    }

    const added = this.addContact(name, phone);
    
    // Close modal cleanly
    const modal = document.getElementById('add-contact-modal');
    if (modal) modal.classList.remove('active');

    document.getElementById('new-contact-name').value = '';
    document.getElementById('new-contact-phone').value = '';

    if (added) {
      alert(`Contact "${name}" added successfully!`);
    } else {
      alert(`Contact "${name}" (${phone}) is already in your contact list.`);
    }

    this.renderContactsList();
  },

  addContact(name, phone, customAvatar) {
    const normalizedPhone = this.normalizePhone(phone);
    const exists = this.contacts.find(c => c.phone === normalizedPhone);
    
    if (!exists) {
      const newContact = {
        id: 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: name,
        phone: normalizedPhone,
        avatar: customAvatar || ('https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(normalizedPhone)),
        about: 'Available on TChat'
      };
      this.contacts.push(newContact);
      this.saveContacts();
      return true;
    } else if (customAvatar && exists.avatar !== customAvatar) {
      exists.avatar = customAvatar;
      this.saveContacts();
    }
    return false;
  },

  normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
      return '+91 ' + cleaned; // Default country prefix fallback
    }
    return cleaned;
  },

  syncFirebaseUsers() {
    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      window.AppConfig.db.collection('users').onSnapshot(snapshot => {
        snapshot.forEach(doc => {
          const u = doc.data();
          const myUid = window.AppConfig.currentUser ? window.AppConfig.currentUser.uid : '';
          if (u && u.phone && u.uid !== myUid) {
            this.addContact(u.name || u.phone, u.phone, u.avatar);
            const c = this.contacts.find(x => x.phone === this.normalizePhone(u.phone));
            if (c) {
              if (u.avatar) c.avatar = u.avatar;
              if (u.name) c.name = u.name;
              if (u.about) c.about = u.about;
            }
          }
        });
        this.saveContacts();
        this.renderContactsList();

        // Dynamically update active chat contact avatar, header, profile modal & messages
        if (window.ChatModule && window.ChatModule.activeContact) {
          const activeClean = window.ChatModule.activeContact.phone ? window.ChatModule.activeContact.phone.replace(/\D/g, '') : '';
          const updatedActive = this.contacts.find(x => x.phone && x.phone.replace(/\D/g, '') === activeClean);
          if (updatedActive) {
            window.ChatModule.activeContact.avatar = updatedActive.avatar;
            window.ChatModule.activeContact.name = updatedActive.name;
            window.ChatModule.activeContact.about = updatedActive.about;
            
            const chatHeaderAvatar = document.getElementById('chat-contact-avatar');
            if (chatHeaderAvatar) chatHeaderAvatar.src = updatedActive.avatar;

            const modalAvatar = document.getElementById('view-contact-avatar');
            if (modalAvatar) modalAvatar.src = updatedActive.avatar;

            window.ChatModule.renderMessages();
            window.ChatModule.renderChatsList();
          }
        }
      }, err => console.warn('Firestore users live sync notice:', err));
    }
  },

  loadContacts() {
    const saved = MockDB.get('user_contacts', null);
    if (saved && Array.isArray(saved)) {
      this.contacts = saved;
    } else {
      this.contacts = [];
      this.saveContacts();
    }

    this.renderContactsList();
  },

  saveContacts() {
    MockDB.set('user_contacts', this.contacts);
  },

  renderContactsList() {
    const container = document.getElementById('app-contacts-list');
    if (!container) return;

    if (this.contacts.length === 0) {
      container.innerHTML = `<p class="empty-state"><i class="fa-solid fa-address-book"></i><br>No contacts found.<br>Use "Sync Phonebook" or "Import .VCF File" above to add your contacts.</p>`;
      return;
    }

    container.innerHTML = this.contacts.map(c => `
      <div class="chat-item" onclick="ContactsModule.startChatWithContact('${c.id}')">
        <div class="chat-avatar-wrapper">
          <img src="${c.avatar}" alt="${c.name}">
        </div>
        <div class="chat-details">
          <div class="chat-row-top">
            <span class="chat-name">${c.name}</span>
          </div>
          <div class="chat-row-bottom">
            <span class="chat-snippet">${c.phone} | ${c.about}</span>
          </div>
        </div>
      </div>
    `).join('');

    if (window.ChatModule) {
      window.ChatModule.renderChatsList();
    }
  },

  startChatWithContact(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Delegate chat opening to ChatModule
    if (window.ChatModule) {
      window.ChatModule.openConversation(contact);
    }
  },

  openCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    if (modal) {
      const input = document.getElementById('group-name-input');
      if (input) input.value = '';
      this.populateGroupMembersList();
      modal.classList.add('active');
    }
  },

  closeCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    if (modal) modal.classList.remove('active');
  },

  populateGroupMembersList() {
    const container = document.getElementById('group-members-list');
    const countEl = document.getElementById('selected-members-count');
    if (!container) return;

    if (countEl) countEl.textContent = '0';

    if (!this.contacts || this.contacts.length === 0) {
      container.innerHTML = '<p style="padding:12px; font-size:0.85rem; color:var(--text-muted); text-align:center;">No contacts available to add to group.</p>';
      return;
    }

    container.innerHTML = this.contacts.map(c => `
      <label class="group-member-item">
        <input type="checkbox" class="group-member-checkbox" value="${c.id}" onchange="ContactsModule.updateSelectedGroupMembersCount()">
        <img class="group-member-avatar" src="${c.avatar}" alt="${c.name}">
        <div class="group-member-info">
          <span class="group-member-name">${c.name}</span>
          <span class="group-member-phone">${c.phone || c.about}</span>
        </div>
      </label>
    `).join('');
  },

  updateSelectedGroupMembersCount() {
    const checked = document.querySelectorAll('.group-member-checkbox:checked');
    const countEl = document.getElementById('selected-members-count');
    if (countEl) countEl.textContent = checked.length;
  },

  handleCreateGroupSubmit() {
    const nameInput = document.getElementById('group-name-input');
    const groupName = nameInput ? nameInput.value.trim() : '';

    if (!groupName) {
      if (window.showToast) window.showToast('Please enter a group subject / name', 'warning');
      else alert('Please enter a group subject / name');
      return;
    }

    const checkedBoxes = document.querySelectorAll('.group-member-checkbox:checked');
    if (checkedBoxes.length === 0) {
      if (window.showToast) window.showToast('Please select at least one contact for the group', 'warning');
      else alert('Please select at least one contact for the group');
      return;
    }

    const selectedMemberIds = Array.from(checkedBoxes).map(cb => cb.value);
    const selectedMemberNames = selectedMemberIds.map(id => {
      const c = this.contacts.find(x => x.id === id);
      return c ? c.name : 'Member';
    });

    const avatarImg = document.getElementById('group-avatar-img');
    const avatarUrl = avatarImg ? avatarImg.src : '';

    if (window.ChatModule) {
      window.ChatModule.createGroupChat(groupName, avatarUrl, selectedMemberIds, selectedMemberNames);
    }

    this.closeCreateGroupModal();
  }
};

window.ContactsModule = ContactsModule;
