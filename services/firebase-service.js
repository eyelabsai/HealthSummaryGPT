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
import { db, storage } from '../firebase-config.js';

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
  },

  // Create document
  async createDocument(documentData) {
    const { buffer, ...metadata } = documentData;
    
    // Upload file to Firebase Storage using Admin SDK
    const fileName = `${Date.now()}_${documentData.name}`;
    const bucket = storage.bucket();
    const file = bucket.file(`documents/${documentData.userId}/${fileName}`);
    
    // Upload the file
    await file.save(buffer, {
      metadata: {
        contentType: documentData.type
      }
    });
    
    // Generate a signed URL for secure access (valid for 1 year)
    const [downloadURL] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year from now
    });
    
    // Store metadata in Firestore
    const document = {
      ...metadata,
      storageRef: file.name,
      downloadURL: downloadURL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    return await addDoc(collection(db, 'documents'), document);
  },

  // Get user documents
  async getUserDocuments(userId) {
    try {
      // Try with createdAt first
      const q = query(
        collection(db, 'documents'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.log('createdAt index not ready for documents, trying uploadDate ordering');
      try {
        // Fallback to uploadDate ordering
        const q = query(
          collection(db, 'documents'),
          where('userId', '==', userId),
          orderBy('uploadDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (fallbackError) {
        console.log('uploadDate index also not ready, fetching all user documents without ordering');
        // Final fallback: just filter by userId without ordering
        const q = query(
          collection(db, 'documents'),
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort manually by uploadDate or createdAt if available
        return docs.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.uploadDate) || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.uploadDate) || new Date(0);
          return dateB - dateA; // Descending order
        });
      }
    }
  },

  // Get document by ID
  async getDocumentById(documentId, userId) {
    const docRef = doc(db, 'documents', documentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const document = { id: docSnap.id, ...docSnap.data() };
      
      // Verify the document belongs to the user
      if (document.userId !== userId) {
        throw new Error('Unauthorized access to document');
      }
      
      return document;
    }
    
    return null;
  },

  // Delete document
  async deleteDocument(documentId, userId) {
    const docRef = doc(db, 'documents', documentId);
    
    // First verify the document belongs to the user
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const document = docSnap.data();
      if (document.userId !== userId) {
        throw new Error('Unauthorized access to document');
      }
      
      // Delete file from Firebase Storage using Admin SDK
      if (document.storageRef) {
        try {
          const bucket = storage.bucket();
          const file = bucket.file(document.storageRef);
          await file.delete();
        } catch (error) {
          console.error('Error deleting file from storage:', error);
          // Continue with Firestore deletion even if storage deletion fails
        }
      }
    } else {
      throw new Error('Document not found');
    }
    
    return await deleteDoc(docRef);
  }
};
