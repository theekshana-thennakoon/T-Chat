/* ==========================================================================
   CONFIG & FIREBASE / DEMO MOCK BACKEND ENGINE
   ========================================================================== */

// ⬇️ OPTION 1: Paste your Firebase Web Config here directly ⬇️
const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
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

// Check for stored custom Firebase credentials in localStorage or default object
function getStoredFirebaseConfig() {
  try {
    const stored = localStorage.getItem('whatsapp_firebase_config');
    if (stored) return JSON.parse(stored);
  } catch (e) {}

  // Fallback to direct defaultFirebaseConfig if apiKey is provided
  if (defaultFirebaseConfig.apiKey && defaultFirebaseConfig.apiKey.trim() !== "") {
    return defaultFirebaseConfig;
  }
  return null;
}

// Initialize Firebase or Fallback to Demo Engine
function initBackendServices() {
  const customConfig = getStoredFirebaseConfig();
  
  if (customConfig && customConfig.apiKey && window.firebase) {
    try {
      if (!firebase.apps.length) {
        window.AppConfig.firebaseApp = firebase.initializeApp(customConfig);
      } else {
        window.AppConfig.firebaseApp = firebase.app();
      }
      window.AppConfig.auth = firebase.auth();
      window.AppConfig.db = firebase.firestore();
      window.AppConfig.storage = firebase.storage();
      window.AppConfig.isLiveFirebase = true;
      console.log('⚡ Connected to Live Firebase');
      updateFirebaseStatusUI(true);
      return;
    } catch (err) {
      console.warn('Firebase initialization error, falling back to Demo Mode:', err);
    }
  }
  
  // Default Demo Mode setup
  window.AppConfig.isLiveFirebase = false;
  console.log('⚡ Running in Quick Demo Mode');
  updateFirebaseStatusUI(false);
}

function updateFirebaseStatusUI(isLive) {
  const badge = document.getElementById('firebase-status-text');
  if (badge) {
    if (isLive) {
      badge.textContent = 'Live Firebase Active';
      badge.className = 'status-badge live';
    } else {
      badge.textContent = 'Demo Mode (Offline/Local)';
      badge.className = 'status-badge demo';
    }
  }
}

// Save Custom Firebase Credentials
function saveCustomFirebaseConfig(configObj) {
  localStorage.setItem('whatsapp_firebase_config', JSON.stringify(configObj));
  alert('Firebase configuration saved! Reloading application...');
  window.location.reload();
}

// Reset to Demo Mode
function resetToDemoMode() {
  localStorage.removeItem('whatsapp_firebase_config');
  alert('Switched to Demo Mode! Reloading...');
  window.location.reload();
}

// LocalStorage Persistence Helper for Demo Mode
const MockDB = {
  get(key, defaultValue) {
    try {
      const data = localStorage.getItem('wa_mock_' + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('wa_mock_' + key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  }
};

window.initBackendServices = initBackendServices;
window.saveCustomFirebaseConfig = saveCustomFirebaseConfig;
window.resetToDemoMode = resetToDemoMode;
window.MockDB = MockDB;
