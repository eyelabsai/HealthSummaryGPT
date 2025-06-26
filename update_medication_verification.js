import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the current new-visit.html file
const filePath = path.join(__dirname, 'public', 'new-visit.html');
let content = fs.readFileSync(filePath, 'utf8');

// Update the confirm button handler
content = content.replace(
  /confirmMedsBtn\.addEventListener\('click', \(\) => \{[\s\S]*?medicationVerification\.style\.display = 'none';\s*finishVisitBtn\.style\.display = 'inline-block';\s*\}\);/,
  `confirmMedsBtn.addEventListener('click', () => {
      // Remove empty medications
      const medsToSave = currentMedications.filter(med => med.name && med.name.trim() !== '');
      saveVisitAndMedications(medsToSave);
      medicationVerification.style.display = 'none';
      finishVisitBtn.style.display = 'inline-block';
    });`
);

// Update the displayMedicationVerification function
const newDisplayFunction = `    // Function to display medication verification interface
    function displayMedicationVerification(medications) {
      if (!medications || medications.length === 0) {
        // No medications to verify, proceed directly
        finishVisitBtn.style.display = 'inline-block';
        saveVisitAndMedications(medications || []);
        return;
      }
      
      currentMedications = medications.map(med => ({ ...med })); // Deep copy
      
      function renderMedList() {
        const existingCount = currentMedications.filter(med => med.isExisting).length;
        const newCount = currentMedications.filter(med => !med.isExisting).length;
        
        let summaryText = '';
        if (existingCount > 0 && newCount > 0) {
          summaryText = \`<p style="margin-bottom: 1rem; color: #856404; font-weight: 500;">Found \${newCount} new medication(s) and \${existingCount} already prescribed medication(s).</p>\`;
        } else if (existingCount > 0) {
          summaryText = \`<p style="margin-bottom: 1rem; color: #856404; font-weight: 500;">All \${existingCount} medication(s) are already prescribed.</p>\`;
        } else {
          summaryText = \`<p style="margin-bottom: 1rem; color: #155724; font-weight: 500;">Found \${newCount} new medication(s) to add.</p>\`;
        }
        
        medicationList.innerHTML = summaryText + currentMedications.map((med, idx) => \`
          <div class="medication-item-verify" data-idx="\${idx}">
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <input type="text" class="med-input" data-field="name" value="\${med.name || ''}" placeholder="Medication name" style="flex:2; min-width: 120px; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px;" />
              <input type="text" class="med-input" data-field="dosage" value="\${med.dosage || ''}" placeholder="Dosage" style="flex:1; min-width: 80px; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px;" />
              <input type="text" class="med-input" data-field="frequency" value="\${med.frequency || ''}" placeholder="Frequency" style="flex:1; min-width: 80px; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px;" />
              <input type="text" class="med-input" data-field="timing" value="\${med.timing || ''}" placeholder="Timing" style="flex:1; min-width: 80px; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px;" />
              <input type="text" class="med-input" data-field="route" value="\${med.route || ''}" placeholder="Route" style="flex:1; min-width: 80px; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px;" />
              <input type="text" class="med-input" data-field="laterality" value="\${med.laterality || ''}" placeholder="Eye/Side" style="flex:1; min-width: 80px; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px;" />
              <input type="text" class="med-input" data-field="duration" value="\${med.duration || ''}" placeholder="Duration" style="flex:1; min-width: 80px; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px;" />
              <button type="button" class="remove-med-btn" data-idx="\${idx}" style="margin-left:0.5rem; padding: 0.5rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑</button>
            </div>
            <textarea class="med-input" data-field="fullInstructions" placeholder="Full instructions" style="width:100%; margin-top:0.5rem; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 4px; min-height: 60px; resize: vertical;">\${med.fullInstructions || ''}</textarea>
          </div>
        \`).join('') + \`
          <button type="button" id="addMedicationBtn" class="btn btn-secondary" style="margin-top:1rem;">+ Add Medication</button>
        \`;
        
        // Add event listeners for input changes
        medicationList.querySelectorAll('.med-input').forEach(input => {
          input.addEventListener('input', e => {
            const idx = +input.closest('.medication-item-verify').dataset.idx;
            const field = input.dataset.field;
            currentMedications[idx][field] = input.value;
          });
        });
        
        // Remove medication
        medicationList.querySelectorAll('.remove-med-btn').forEach(btn => {
          btn.addEventListener('click', e => {
            const idx = +btn.dataset.idx;
            currentMedications.splice(idx, 1);
            renderMedList();
          });
        });
        
        // Add medication
        const addBtn = document.getElementById('addMedicationBtn');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            currentMedications.push({
              name: '', dosage: '', frequency: '', timing: '', route: '', laterality: '', duration: '', fullInstructions: ''
            });
            renderMedList();
          });
        }
      }
      
      renderMedList();
      medicationVerification.style.display = 'block';
      finishVisitBtn.style.display = 'none';
    }`;

// Find and replace the displayMedicationVerification function
const functionRegex = /\/\/ Function to display medication verification interface[\s\S]*?medicationVerification\.style\.display = 'block';\s*finishVisitBtn\.style\.display = 'none';\s*\}/;
content = content.replace(functionRegex, newDisplayFunction);

// Update the saveVisitAndMedications function to use the correct specialty field
content = content.replace(
  /specialty: specialtyEl\.value \|\| 'Uncategorized',/g,
  `specialty: document.getElementById('specialty').value || 'Uncategorized',`
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Successfully updated new-visit.html with editable medication verification interface!'); 