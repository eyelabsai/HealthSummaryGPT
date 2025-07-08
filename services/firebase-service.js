// services/firebase-service.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase-config.js';

// Visit Services
export const visitService = {
  // Create new visit
  async createVisit(visitData) {
    const visit = {
      ...visitData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    return await addDoc(collection(db, 'visits'), visit);
  },

  // Get all visits for a user
  async getUserVisits(userId) {
    try {
      // Try to order by createdAt (requires index)
      const q = query(
        collection(db, 'visits'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      // Fallback to date ordering if createdAt index isn't ready
      console.log('createdAt index not ready, falling back to date ordering');
      const q = query(
        collection(db, 'visits'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },

  // Get visit by ID
  async getVisitById(visitId) {
    const docRef = doc(db, 'visits', visitId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  },

  // Update visit
  async updateVisit(visitId, updates) {
    const docRef = doc(db, 'visits', visitId);
    return await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  // Delete visit
  async deleteVisit(visitId) {
    const docRef = doc(db, 'visits', visitId);
    return await deleteDoc(docRef);
  }
};

// Medication Services
export const medicationService = {
  // Create new medication
  async createMedication(medicationData) {
    const medication = {
      ...medicationData,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    return await addDoc(collection(db, 'medications'), medication);
  },

  // Get all active medications for a user
  async getUserMedications(userId) {
    const q = query(
      collection(db, 'medications'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Get all medications (including inactive) for a user
  async getAllUserMedications(userId) {
    const q = query(
      collection(db, 'medications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Check if medication exists (for duplicate detection)
  async checkMedicationExists(userId, medicationName) {
    const q = query(
      collection(db, 'medications'),
      where('userId', '==', userId),
      where('name', '==', medicationName.toLowerCase()),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },

  // Get existing medication by name
  async getMedicationByName(userId, medicationName) {
    const q = query(
      collection(db, 'medications'),
      where('userId', '==', userId),
      where('name', '==', medicationName.toLowerCase()),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  // Update medication
  async updateMedication(medicationId, updates) {
    const docRef = doc(db, 'medications', medicationId);
    return await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  // Discontinue medication
  async discontinueMedication(medicationId, reason = null) {
    const docRef = doc(db, 'medications', medicationId);
    const updateData = {
      isActive: false,
      discontinuedDate: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    if (reason) {
      updateData.discontinuationReason = reason;
    }
    
    return await updateDoc(docRef, updateData);
  },

  // Delete medication
  async deleteMedication(medicationId) {
    const docRef = doc(db, 'medications', medicationId);
    return await deleteDoc(docRef);
  }
};

// Visit-Medication Relationship Services
export const visitMedicationService = {
  // Record medication action during visit
  async recordMedicationAction(actionData) {
    const action = {
      ...actionData,
      createdAt: serverTimestamp()
    };
    return await addDoc(collection(db, 'visit_medications'), action);
  },

  // Get medication history
  async getMedicationHistory(medicationId) {
    const q = query(
      collection(db, 'visit_medications'),
      where('medicationId', '==', medicationId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Get all medication actions for a visit
  async getVisitMedicationActions(visitId) {
    const q = query(
      collection(db, 'visit_medications'),
      where('visitId', '==', visitId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// User Services
export const userService = {
  // Create or update user
  async createUser(userData) {
    const user = {
      ...userData,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };
    return await addDoc(collection(db, 'users'), user);
  },

  // Get user by ID
  async getUserById(userId) {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  },

  // Update user
  async updateUser(userId, updates) {
    const docRef = doc(db, 'users', userId);
    return await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }
};
