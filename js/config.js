/* ==========================================================================
   CONFIG & FIREBASE BACKEND INITIALIZATION
   ========================================================================== */

// Automatic Global Firebase Credentials
const firebaseConfig = {
  apiKey: "AIzaSyCyQEAKck2WF6IQxl5ErTb_7DXJJ4xB-rc",
  authDomain: "tchat-c4386.firebaseapp.com",
  projectId: "tchat-c4386",
  storageBucket: "tchat-c4386.firebasestorage.app",
  messagingSenderId: "862641852769",
  appId: "1:862641852769:web:598311114b2ee426497520",
  measurementId: "G-VPDLXPT7KB"
};

// Global App State Container
window.AppConfig = {
  isLiveFirebase: false,
  firebaseApp: null,
  auth: null,
  db: null,
  storage: null,
  currentUser: null
};

// Initialize Firebase Automatically
function initBackendServices() {
  if (window.firebase && firebaseConfig.apiKey) {
    try {
      if (!firebase.apps.length) {
        window.AppConfig.firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        window.AppConfig.firebaseApp = firebase.app();
      }
      window.AppConfig.auth = firebase.auth();
      window.AppConfig.db = firebase.firestore();
      window.AppConfig.storage = firebase.storage();
      window.AppConfig.isLiveFirebase = true;
      console.log('⚡ Connected to Live Firebase (tchat-c4386)');
      return;
    } catch (err) {
      console.error('Firebase initialization error:', err);
    }
  }
}

// LocalStorage Persistence Helper
const MockDB = {
  get(key, defaultValue) {
    try {
      const data = localStorage.getItem('tchat_' + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('tchat_' + key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem('tchat_' + key);
    } catch (e) {}
  }
};

window.initBackendServices = initBackendServices;
window.MockDB = MockDB;
