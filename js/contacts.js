/* ==========================================================================
   CONTACTS & MOBILE PHONEBOOK MATCHING MODULE
   ========================================================================== */

const ContactsModule = {
  contacts: [],

  init() {
    this.bindEvents();
    this.loadContacts();
  },

  bindEvents() {
    // Import Web Contacts button
    const btnImport = document.getElementById('btn-import-web-contacts');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.requestWebContacts());
    }

    // Add manual contact button
    const btnAdd = document.getElementById('btn-add-manual-contact');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        document.getElementById('add-contact-modal').classList.add('active');
      });
    }

    // Save manual contact button
    const btnSave = document.getElementById('btn-save-new-contact');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.handleSaveManualContact());
    }
  },

  // HTML5 Web Contacts Picker API (Mobile browsers)
  async requestWebContacts() {
    if ('contacts' in navigator && 'select' in navigator.contacts) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const selected = await navigator.contacts.select(props, opts);
        
        if (selected && selected.length > 0) {
          selected.forEach(c => {
            const name = c.name ? c.name[0] : 'Phonebook Contact';
            const tel = c.tel ? c.tel[0] : '';
            if (tel) {
              this.addContact(name, tel);
            }
          });
          alert(`Successfully synced ${selected.length} contacts from your device!`);
          this.renderContactsList();
        }
      } catch (err) {
        console.warn('Web Contacts API Error:', err);
        alert('Could not access mobile contacts. You can manually add contacts by phone number.');
      }
    } else {
      alert('Web Contacts API is supported on mobile browsers (Chrome/Safari on Android & iOS). You can also add contacts manually!');
    }
  },

  handleSaveManualContact() {
    const name = document.getElementById('new-contact-name').value.trim();
    const phone = document.getElementById('new-contact-phone').value.trim();

    if (!name || !phone) {
      alert('Please enter both name and phone number.');
      return;
    }

    this.addContact(name, phone);
    document.getElementById('new-contact-modal').classList.remove('active');
    document.getElementById('new-contact-name').value = '';
    document.getElementById('new-contact-phone').value = '';
    alert(`Contact ${name} added successfully!`);
    this.renderContactsList();
  },

  addContact(name, phone) {
    const normalizedPhone = this.normalizePhone(phone);
    const newContact = {
      id: 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name,
      phone: normalizedPhone,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(normalizedPhone),
      about: 'Available on TChat'
    };

    // Check if duplicate
    const exists = this.contacts.find(c => c.phone === normalizedPhone);
    if (!exists) {
      this.contacts.push(newContact);
      this.saveContacts();
    }
  },

  normalizePhone(phone) {
    const digits = phone.replace(/[^\d+]/g, '');
    if (!digits.startsWith('+')) {
      return '+91 ' + digits; // Default country prefix fallback
    }
    return digits;
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
      container.innerHTML = `<p class="empty-state">No contacts found. Use the buttons above to sync or add contacts.</p>`;
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
  },

  startChatWithContact(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Delegate chat opening to ChatModule
    if (window.ChatModule) {
      window.ChatModule.openConversation(contact);
    }
  }
};

window.ContactsModule = ContactsModule;
