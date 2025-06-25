// services/migration-service.js
import { visitService, medicationService, userService } from './firebase-service.js';

// Migration service to move data from localStorage to Firebase
export const migrationService = {
  // Migrate all localStorage data to Firebase
  async migrateToFirebase(userId) {
    try {
      console.log('Starting migration to Firebase...');
      
      // Migrate visits
      const visitsMigrated = await this.migrateVisits(userId);
      
      // Migrate medications
      const medicationsMigrated = await this.migrateMedications(userId);
      
      console.log(`Migration complete: ${visitsMigrated} visits, ${medicationsMigrated} medications`);
      
      return {
        success: true,
        visitsMigrated,
        medicationsMigrated
      };
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Migrate visits from localStorage
  async migrateVisits(userId) {
    const visits = JSON.parse(localStorage.getItem('opencare_visits')) || [];
    let migratedCount = 0;

    for (const visit of visits) {
      try {
        const visitData = {
          userId,
          date: new Date(visit.date),
          specialty: visit.specialty || 'Uncategorized',
          summary: visit.summary || '',
          tldr: visit.tldr || '',
          transcript: visit.transcript || '',
          originalId: visit.id // Keep reference to original ID
        };

        await visitService.createVisit(visitData);
        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate visit ${visit.id}:`, error);
      }
    }

    return migratedCount;
  },

  // Migrate medications from localStorage
  async migrateMedications(userId) {
    const medications = JSON.parse(localStorage.getItem('opencare_medications')) || [];
    let migratedCount = 0;

    for (const med of medications) {
      try {
        const medicationData = {
          userId,
          name: med.name.toLowerCase(), // Normalize to lowercase
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          timing: med.timing || '',
          route: med.route || '',
          laterality: med.laterality || '',
          duration: med.duration || '',
          instructions: med.instructions || '',
          fullInstructions: med.fullInstructions || '',
          isActive: true,
          prescribedDate: new Date() // Set to current date since we don't have original date
        };

        await medicationService.createMedication(medicationData);
        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate medication ${med.name}:`, error);
      }
    }

    return migratedCount;
  },

  // Check if migration is needed
  hasLocalStorageData() {
    const visits = localStorage.getItem('opencare_visits');
    const medications = localStorage.getItem('opencare_medications');
    
    return !!(visits || medications);
  },

  // Clear localStorage after successful migration
  clearLocalStorage() {
    localStorage.removeItem('opencare_visits');
    localStorage.removeItem('opencare_medications');
    console.log('LocalStorage cleared after migration');
  }
};
