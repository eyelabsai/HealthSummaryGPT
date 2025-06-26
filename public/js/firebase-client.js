// public/js/firebase-client.js
// Client-side Firebase service for frontend

// Check if firebase.firestore is available
if (typeof firebase.firestore !== 'function') {
  throw new Error('Firestore compat script is not loaded! Please ensure you have included https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js BEFORE this script.');
}

// Firebase configuration for client-side
const firebaseConfig = {
  apiKey: "AIzaSyCS1uCc61ocGY4PwDqK1Ky0FPIWnTBcAAs",
  authDomain: "opencare-f76c3.firebaseapp.com",
  projectId: "opencare-f76c3",
  storageBucket: "opencare-f76c3.appspot.com",
  messagingSenderId: "558558826935",
  appId: "1:558558826935:web:d3373c94fb2c20e81f5832",
  measurementId: "G-SQW3Q4L3HK"
};

// Initialize Firebase for client-side
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Client-side Firebase service
const firebaseClient = {
  // Get current user ID (for now, using a default user)
  getCurrentUserId() {
    const user = firebase.auth().currentUser;
    return user ? user.uid : null;
  },

  // Visit operations
  async createVisit(visitData) {
    const userId = this.getCurrentUserId();
    const visit = {
      ...visitData,
      userId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('visits').add(visit);
    return { id: docRef.id, ...visit };
  },

  async getUserVisits() {
    const userId = this.getCurrentUserId();
    const snapshot = await db.collection('visits')
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getVisitById(visitId) {
    const doc = await db.collection('visits').doc(visitId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async deleteVisit(visitId) {
    const docRef = db.collection('visits').doc(visitId);
    await docRef.delete();
    return { success: true };
  },

  // Medication operations
  async createMedication(medicationData) {
    const userId = this.getCurrentUserId();
    const medication = {
      ...medicationData,
      userId,
      name: medicationData.name.toLowerCase(), // Normalize to lowercase
      isActive: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('medications').add(medication);
    return { id: docRef.id, ...medication };
  },

  async getUserMedications() {
    const userId = this.getCurrentUserId();
    const snapshot = await db.collection('medications')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async checkMedicationExists(medicationName) {
    const userId = this.getCurrentUserId();
    const snapshot = await db.collection('medications')
      .where('userId', '==', userId)
      .where('name', '==', medicationName.toLowerCase())
      .where('isActive', '==', true)
      .get();
    
    return !snapshot.empty;
  },

  async getMedicationByName(medicationName) {
    const userId = this.getCurrentUserId();
    const snapshot = await db.collection('medications')
      .where('userId', '==', userId)
      .where('name', '==', medicationName.toLowerCase())
      .where('isActive', '==', true)
      .get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async updateMedication(medicationId, updates) {
    const docRef = db.collection('medications').doc(medicationId);
    return await docRef.update({
      ...updates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async discontinueMedication(medicationId) {
    const docRef = db.collection('medications').doc(medicationId);
    return await docRef.update({
      isActive: false,
      discontinuedDate: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async deleteMedication(medicationId) {
    const docRef = db.collection('medications').doc(medicationId);
    await docRef.delete();
    return { success: true };
  },

  // Visit-Medication relationship operations
  async recordMedicationAction(actionData) {
    const userId = this.getCurrentUserId();
    const action = {
      ...actionData,
      userId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('visit_medications').add(action);
    return { id: docRef.id, ...action };
  },

  // Migration helper
  async migrateFromLocalStorage() {
    const visits = JSON.parse(localStorage.getItem('opencare_visits')) || [];
    const medications = JSON.parse(localStorage.getItem('opencare_medications')) || [];
    
    let migratedVisits = 0;
    let migratedMedications = 0;

    // Migrate visits
    for (const visit of visits) {
      try {
        await this.createVisit({
          date: new Date(visit.date),
          specialty: visit.specialty || 'Uncategorized',
          summary: visit.summary || '',
          tldr: visit.tldr || ''
        });
        migratedVisits++;
      } catch (error) {
        console.error('Failed to migrate visit:', error);
      }
    }

    // Migrate medications
    for (const med of medications) {
      try {
        await this.createMedication({
          name: med.name,
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          timing: med.timing || '',
          route: med.route || '',
          laterality: med.laterality || '',
          duration: med.duration || '',
          instructions: med.instructions || '',
          fullInstructions: med.fullInstructions || ''
        });
        migratedMedications++;
      } catch (error) {
        console.error('Failed to migrate medication:', error);
      }
    }

    // Clear localStorage after successful migration
    if (migratedVisits > 0 || migratedMedications > 0) {
      localStorage.removeItem('opencare_visits');
      localStorage.removeItem('opencare_medications');
    }

    return { migratedVisits, migratedMedications };
  },

  // User profile operations
  async setUserProfile(profileData) {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Not logged in');
    const docRef = db.collection('users').doc(userId);
    await docRef.set({ ...profileData, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { success: true };
  },

  async getUserProfile() {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Not logged in');
    const doc = await db.collection('users').doc(userId).get();
    if (doc.exists) return doc.data();
    return null;
  },

  // Health Assistant
  async askHealthAssistant(query) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch('/api/health-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.uid,
        query: query
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },

  // Transcription (for Vercel deployment)
  async transcribeAudio(audioFile) {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },

  // Summarization (for Vercel deployment)
  async summarizeTranscript(transcript) {
    const response = await fetch('/api/summarise', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }
};

// Make it available globally
window.firebaseClient = firebaseClient;
