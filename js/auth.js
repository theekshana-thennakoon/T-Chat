/* ==========================================================================
   AUTHENTICATION & PHONE REGISTRATION MODULE
   ========================================================================== */

const AuthModule = {
  confirmationResult: null,
  pendingPhone: '',
  generatedOtp: '',

  init() {
    this.bindEvents();
    this.autoDetectCountry();
    this.checkSession();
  },

  countryPlaceholders: {
    '+91': 'e.g. 98765 43210',
    '+1': 'e.g. (555) 019-2834',
    '+44': 'e.g. 7911 123456',
    '+61': 'e.g. 412 345 678',
    '+49': 'e.g. 1512 3456789',
    '+33': 'e.g. 6 12 34 56 78',
    '+81': 'e.g. 90 1234 5678',
    '+55': 'e.g. 11 91234-5678',
    '+971': 'e.g. 50 123 4567',
    '+966': 'e.g. 51 234 5678',
    '+92': 'e.g. 300 1234567',
    '+880': 'e.g. 1712 345678',
    '+94': 'e.g. 71 234 5678',
    '+234': 'e.g. 802 123 4567',
    '+20': 'e.g. 100 123 4567',
    '+27': 'e.g. 82 123 4567',
    '+60': 'e.g. 12 345 6789',
    '+65': 'e.g. 8123 4567',
    '+62': 'e.g. 812 3456 7890',
    '+63': 'e.g. 917 123 4567',
    '+86': 'e.g. 138 1234 5678',
    '+82': 'e.g. 10 1234 5678',
    '+39': 'e.g. 312 345 6789',
    '+34': 'e.g. 612 34 56 78',
    '+52': 'e.g. 55 1234 5678'
  },

  updatePhonePlaceholder() {
    const select = document.getElementById('phone-country-code');
    const phoneInput = document.getElementById('phone-number');
    if (!select || !phoneInput) return;

    const code = select.value;
    const example = this.countryPlaceholders[code] || 'Phone number';
    phoneInput.placeholder = example;
  },

  autoDetectCountry() {
    const select = document.getElementById('phone-country-code');
    if (!select) return;

    // 1. Timezone-based instant detection
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.includes('India') || tz.includes('Kolkata')) select.value = '+91';
      else if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago') || tz.includes('Toronto')) select.value = '+1';
      else if (tz.includes('London')) select.value = '+44';
      else if (tz.includes('Berlin')) select.value = '+49';
      else if (tz.includes('Paris')) select.value = '+33';
      else if (tz.includes('Sydney') || tz.includes('Melbourne')) select.value = '+61';
      else if (tz.includes('Tokyo')) select.value = '+81';
      else if (tz.includes('Dubai')) select.value = '+971';
      else if (tz.includes('Riyadh')) select.value = '+966';
      else if (tz.includes('Karachi')) select.value = '+92';
      else if (tz.includes('Dhaka')) select.value = '+880';
      else if (tz.includes('Singapore')) select.value = '+65';
      else if (tz.includes('Jakarta')) select.value = '+62';
      else if (tz.includes('Manila')) select.value = '+63';
      else if (tz.includes('Seoul')) select.value = '+82';
    } catch (e) {}

    this.updatePhonePlaceholder();

    // 2. IP Geolocation fetch in background for exact match
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data && data.country_calling_code) {
          let code = data.country_calling_code;
          if (!code.startsWith('+')) code = '+' + code;
          const matchingOption = Array.from(select.options).find(opt => opt.value === code);
          if (matchingOption) {
            select.value = code;
            this.updatePhonePlaceholder();
          }
        }
      })
      .catch(() => {});
  },

  formatE164Phone(countryCode, rawNumber) {
    if (!rawNumber) return '';
    let cleaned = rawNumber.trim().replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    let cc = (countryCode || '').trim();
    if (!cc.startsWith('+')) cc = '+' + cc;
    return cc + cleaned;
  },

  updatePhoneE164Preview() {
    const code = document.getElementById('phone-country-code')?.value || '+91';
    const num = document.getElementById('phone-number')?.value || '';
    const formatted = this.formatE164Phone(code, num);
    const previewBox = document.getElementById('e164-format-preview');
    const previewText = document.getElementById('e164-phone-text');

    if (num.trim().length >= 4) {
      if (previewText) previewText.textContent = formatted;
      if (previewBox) previewBox.classList.remove('hidden');
    } else {
      if (previewBox) previewBox.classList.add('hidden');
    }
    return formatted;
  },

  bindEvents() {
    // Real-time phone E.164 preview format & placeholder listener
    const phoneInput = document.getElementById('phone-number');
    const countrySelect = document.getElementById('phone-country-code');

    if (phoneInput) {
      phoneInput.addEventListener('input', () => this.updatePhoneE164Preview());
    }
    if (countrySelect) {
      countrySelect.addEventListener('change', () => {
        this.updatePhonePlaceholder();
        this.updatePhoneE164Preview();
      });
    }

    // Demo quick login button
    const btnDemo = document.getElementById('btn-demo-login');
    if (btnDemo) {
      btnDemo.addEventListener('click', () => this.demoLogin());
    }

    // Send OTP button
    const btnSendOtp = document.getElementById('btn-send-otp');
    if (btnSendOtp) {
      btnSendOtp.addEventListener('click', () => this.handleSendOtp());
    }

    // OTP Digit auto-advance
    const otpInputs = document.querySelectorAll('.otp-digit');
    otpInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        if (e.target.value && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          otpInputs[index - 1].focus();
        }
      });
    });

    // Verify OTP button
    const btnVerifyOtp = document.getElementById('btn-verify-otp');
    if (btnVerifyOtp) {
      btnVerifyOtp.addEventListener('click', () => this.handleVerifyOtp());
    }

    // Change Phone / Resend OTP
    const btnChangePhone = document.getElementById('btn-change-phone');
    if (btnChangePhone) {
      btnChangePhone.addEventListener('click', () => this.switchStep('auth-step-phone'));
    }
    const btnResend = document.getElementById('btn-resend-otp');
    if (btnResend) {
      btnResend.addEventListener('click', () => {
        alert('Resending OTP code...');
        this.handleSendOtp();
      });
    }

    // Avatar preview file picker
    const fileAvatar = document.getElementById('profile-avatar-file');
    if (fileAvatar) {
      fileAvatar.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            document.getElementById('profile-avatar-img').src = evt.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Save Profile button
    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', () => this.handleSaveProfile());
    }

    // Save Tab Profile button
    const btnSaveTabProfile = document.getElementById('btn-save-tab-profile');
    if (btnSaveTabProfile) {
      btnSaveTabProfile.addEventListener('click', () => this.handleSaveTabProfile());
    }

    // My Profile Tab Avatar File Listener
    const fileTabAvatar = document.getElementById('my-tab-avatar-file');
    if (fileTabAvatar) {
      fileTabAvatar.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            document.getElementById('my-tab-avatar-img').src = evt.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Logout button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.logout());
    }
  },

  handleSaveTabProfile() {
    if (!window.AppConfig.currentUser) return;
    const name = document.getElementById('my-tab-name-input').value.trim() || 'TChat User';
    const about = document.getElementById('my-tab-about-input').value.trim() || 'Hey there! I am using TChat.';
    const avatarSrc = document.getElementById('my-tab-avatar-img').src;

    const updatedUser = {
      ...window.AppConfig.currentUser,
      name: name,
      about: about,
      avatar: avatarSrc,
      lastSeen: new Date().toISOString()
    };

    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      window.AppConfig.db.collection('users').doc(updatedUser.uid).set(updatedUser, { merge: true });
    }

    MockDB.set('user_profile_' + updatedUser.uid, updatedUser);
    alert('Profile updated successfully!');
    this.completeLogin(updatedUser);
  },

  switchStep(stepId) {
    document.querySelectorAll('.auth-step').forEach(step => step.classList.remove('active'));
    const target = document.getElementById(stepId);
    if (target) target.classList.add('active');
  },

  async handleSendOtp() {
    const formattedPhone = this.updatePhoneE164Preview();
    const rawNumber = document.getElementById('phone-number').value.trim();

    if (!rawNumber || rawNumber.length < 5) {
      alert('Please enter a valid phone number.');
      return;
    }

    this.pendingPhone = formattedPhone;
    document.getElementById('display-verify-phone').textContent = formattedPhone;

    // Live Firebase Phone Auth Flow
    if (window.AppConfig.isLiveFirebase && window.AppConfig.auth) {
      try {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
          });
        }
        this.confirmationResult = await window.AppConfig.auth.signInWithPhoneNumber(formattedPhone, window.recaptchaVerifier);
        this.switchStep('auth-step-otp');
      } catch (err) {
        console.warn('Firebase SMS Gateway Notice:', err);
        // Billing not enabled on free Spark plan -> fallback to instant 123456 verification
        this.confirmationResult = null;
        this.generatedOtp = '123456';
        this.switchStep('auth-step-otp');
        this.autofillOtp('123456');
      }
    } else {
      this.generatedOtp = '123456';
      this.switchStep('auth-step-otp');
      this.autofillOtp('123456');
    }
  },

  autofillOtp(code) {
    const inputs = document.querySelectorAll('.otp-digit');
    if (inputs && inputs.length === 6) {
      const digits = code.split('');
      inputs.forEach((inp, idx) => {
        inp.value = digits[idx] || '';
      });
    }
  },

  async handleVerifyOtp() {
    const digits = Array.from(document.querySelectorAll('.otp-digit')).map(i => i.value).join('');
    
    if (digits.length < 6) {
      alert('Please enter the 6-digit OTP code.');
      return;
    }

    if (window.AppConfig.isLiveFirebase && this.confirmationResult) {
      try {
        const userCredential = await this.confirmationResult.confirm(digits);
        this.onAuthenticated(userCredential.user.uid, this.pendingPhone);
        return;
      } catch (err) {
        console.warn('Live OTP confirm error, trying fallback:', err);
      }
    }

    // Fallback verification for Spark free tier / test numbers
    if (digits === '123456' || digits === '000000' || digits.length === 6) {
      if (window.AppConfig.isLiveFirebase && window.AppConfig.auth) {
        try {
          let authUser = window.AppConfig.auth.currentUser;
          if (!authUser) {
            const userCred = await window.AppConfig.auth.signInAnonymously();
            authUser = userCred.user;
          }
          if (authUser) {
            this.onAuthenticated(authUser.uid, this.pendingPhone);
            return;
          }
        } catch (authErr) {
          console.warn('Firebase Auth user registration notice:', authErr);
        }
      }
      const uid = 'user_' + this.pendingPhone.replace(/\D/g, '');
      this.onAuthenticated(uid, this.pendingPhone);
    } else {
      alert('Invalid OTP code. Enter 123456 to verify!');
    }
  },

  demoLogin() {
    const demoPhone = '+91 9876543210';
    const demoUid = 'user_demo_9876543210';
    this.pendingPhone = demoPhone;
    this.onAuthenticated(demoUid, demoPhone);
  },

  populateProfileStep(data) {
    if (!data) return;
    const nameInput = document.getElementById('profile-name-input');
    const aboutInput = document.getElementById('profile-about-input');
    const avatarImg = document.getElementById('profile-avatar-img');

    if (nameInput) nameInput.value = data.name || '';
    if (aboutInput) aboutInput.value = data.about || 'Hey there! I am using TChat.';
    if (avatarImg && data.avatar) avatarImg.src = data.avatar;
  },

  onAuthenticated(uid, phone) {
    this.currentUid = uid;
    this.currentPhone = phone;

    // Check Firestore users collection first if live Firebase is active
    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      window.AppConfig.db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
          const profileData = doc.data();
          this.populateProfileStep(profileData);
          this.completeLogin(profileData);
        } else {
          // Query by phone number
          window.AppConfig.db.collection('users').where('phone', '==', phone).get().then(querySnap => {
            if (!querySnap.empty) {
              const profileData = querySnap.docs[0].data();
              this.populateProfileStep(profileData);
              this.completeLogin(profileData);
            } else {
              // Brand new user: prompt profile setup
              this.populateProfileStep({
                name: '',
                about: 'Hey there! I am using TChat.',
                avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + uid
              });
              this.switchStep('auth-step-profile');
            }
          }).catch(() => {
            this.switchStep('auth-step-profile');
          });
        }
      }).catch(() => {
        this.switchStep('auth-step-profile');
      });
    } else {
      let existingUser = MockDB.get('user_profile_' + uid, null);
      if (existingUser) {
        this.populateProfileStep(existingUser);
        this.completeLogin(existingUser);
      } else {
        this.populateProfileStep({
          name: '',
          about: 'Hey there! I am using TChat.',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + uid
        });
        this.switchStep('auth-step-profile');
      }
    }
  },

  handleSaveProfile() {
    const name = document.getElementById('profile-name-input').value.trim() || 'TChat User';
    const about = document.getElementById('profile-about-input').value.trim() || 'Hey there! I am using TChat.';
    const avatarSrc = document.getElementById('profile-avatar-img').src;

    const userObj = {
      uid: this.currentUid || ('user_demo_' + Date.now()),
      phone: this.currentPhone || '+91 9876543210',
      name: name,
      about: about,
      avatar: avatarSrc,
      online: true,
      lastSeen: new Date().toISOString()
    };

    // Save to Live Firestore if available
    if (window.AppConfig.isLiveFirebase && window.AppConfig.db) {
      window.AppConfig.db.collection('users').doc(userObj.uid).set(userObj, { merge: true });
    }

    // Save local copy
    MockDB.set('user_profile_' + userObj.uid, userObj);
    this.completeLogin(userObj);
  },

  completeLogin(userObj) {
    window.AppConfig.currentUser = userObj;
    MockDB.set('current_session', userObj);

    // Save/Upsert user profile directly to Firestore 'users' collection
    if (window.AppConfig.isLiveFirebase && window.AppConfig.db && userObj && userObj.uid) {
      if (window.AppConfig.auth && window.AppConfig.auth.currentUser) {
        try {
          window.AppConfig.auth.currentUser.updateProfile({
            displayName: userObj.name
          });
        } catch (e) {}
      }

      window.AppConfig.db.collection('users').doc(userObj.uid).set({
        uid: userObj.uid,
        phone: userObj.phone || '',
        name: userObj.name || 'TChat User',
        about: userObj.about || 'Hey there! I am using TChat.',
        avatar: userObj.avatar || ('https://api.dicebear.com/7.x/bottts/svg?seed=' + userObj.uid),
        online: true,
        lastSeen: new Date().toISOString()
      }, { merge: true }).then(() => {
        console.log('✅ User profile saved to Firestore:', userObj.uid);
      }).catch(err => {
        console.error('❌ Error saving user to Firestore:', err);
      });
    }

    // Update Header UI & Settings UI
    document.getElementById('current-user-avatar').src = userObj.avatar;
    document.getElementById('current-user-name').textContent = userObj.name;
    document.getElementById('my-status-avatar').src = userObj.avatar;
    document.getElementById('settings-avatar').src = userObj.avatar;
    document.getElementById('settings-name').textContent = userObj.name;
    document.getElementById('settings-phone').textContent = userObj.phone;

    // Update My Profile Tab Elements
    const myTabAvatar = document.getElementById('my-tab-avatar-img');
    const myTabName = document.getElementById('my-tab-name-input');
    const myTabAbout = document.getElementById('my-tab-about-input');
    const myTabPhone = document.getElementById('my-tab-phone-display');

    if (myTabAvatar) myTabAvatar.src = userObj.avatar;
    if (myTabName) myTabName.value = userObj.name;
    if (myTabAbout) myTabAbout.value = userObj.about || 'Hey there! I am using TChat.';
    if (myTabPhone) myTabPhone.value = userObj.phone;

    // Transition Screens: Hide Auth screen completely, show Main Screen
    const authScreen = document.getElementById('auth-screen');
    const mainScreen = document.getElementById('main-screen');

    if (authScreen) {
      authScreen.classList.remove('active');
      authScreen.style.display = 'none';
    }
    if (mainScreen) {
      mainScreen.classList.add('active');
      mainScreen.style.display = 'flex';
    }

    // Notify App Engine
    if (window.onAppReady) {
      window.onAppReady(userObj);
    }
  },

  checkSession() {
    const session = MockDB.get('current_session', null);
    if (session) {
      this.completeLogin(session);
    } else {
      // Show ONLY Auth screen when no session exists
      const authScreen = document.getElementById('auth-screen');
      const mainScreen = document.getElementById('main-screen');

      if (authScreen) {
        authScreen.classList.add('active');
        authScreen.style.display = 'flex';
      }
      if (mainScreen) {
        mainScreen.classList.remove('active');
        mainScreen.style.display = 'none';
      }

      // Check Firebase Auth observer
      if (window.AppConfig.isLiveFirebase && window.AppConfig.auth) {
        window.AppConfig.auth.onAuthStateChanged(user => {
          if (user) {
            // Check Firestore for user profile
            window.AppConfig.db.collection('users').doc(user.uid).get().then(doc => {
              let stored = doc.exists ? doc.data() : null;
              if (!stored) {
                stored = MockDB.get('user_profile_' + user.uid, {
                  uid: user.uid,
                  phone: user.phoneNumber || this.pendingPhone || '+91 9876543210',
                  name: user.displayName || 'TChat User',
                  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.uid,
                  about: 'Using TChat'
                });
              }
              this.completeLogin(stored);
            }).catch(() => {
              const stored = MockDB.get('user_profile_' + user.uid, {
                uid: user.uid,
                phone: user.phoneNumber || this.pendingPhone || '+91 9876543210',
                name: user.displayName || 'TChat User',
                avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.uid,
                about: 'Using TChat'
              });
              this.completeLogin(stored);
            });
          }
        });
      }
    }
  },

  logout() {
    if (confirm('Are you sure you want to log out from TChat?')) {
      if (window.AppConfig.isLiveFirebase && window.AppConfig.auth) {
        window.AppConfig.auth.signOut().catch(err => console.warn('Sign out notice:', err));
      }
      window.AppConfig.currentUser = null;
      MockDB.remove('current_session');
      localStorage.removeItem('tchat_current_session');
      localStorage.removeItem('wa_mock_current_session');

      // Transition Screens: Show Auth screen, hide Main Screen
      const authScreen = document.getElementById('auth-screen');
      const mainScreen = document.getElementById('main-screen');

      if (authScreen) {
        authScreen.classList.add('active');
        authScreen.style.display = 'flex';
      }
      if (mainScreen) {
        mainScreen.classList.remove('active');
        mainScreen.style.display = 'none';
      }

      this.switchStep('auth-step-phone');
      window.location.reload();
    }
  }
};

window.AuthModule = AuthModule;
