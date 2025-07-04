// Medication Scheduler - Handles tapering regimens and timeline calculations
class MedicationScheduler {
  constructor() {
    this.currentDate = new Date();
  }

  // Parse tapering instructions and create timeline
  parseTaperingRegimen(medication) {
    const { fullInstructions, startDate, visitDate } = medication;
    
    if (!fullInstructions) return null;
    
    // Smart start date detection
    let actualStartDate = this.determineStartDate(fullInstructions, startDate, visitDate);
    
    const timeline = [];
    
    // Common tapering patterns
    const patterns = [
      // Pattern 1: "4x daily for 1 week, then 3x daily for 1 week"
      /(\d+)x?\s*(?:times?\s*)?(?:daily|per\s*day|a\s*day)\s*for\s*(\d+)\s*(?:week|wk)s?/gi,
      
      // Pattern 2: "1 drop 4 times daily for 1 week, then 3 times daily for 1 week"
      /(\d+)\s*drops?\s*(\d+)\s*times?\s*daily\s*for\s*(\d+)\s*(?:week|wk)s?/gi,
      
      // Pattern 3: "Apply 4x daily x 1 week, then 3x daily x 1 week"
      /(?:apply\s*)?(\d+)x\s*daily\s*x\s*(\d+)\s*(?:week|wk)s?/gi,
      
      // Pattern 4: "Use 4 times per day for 7 days, then 3 times per day for 7 days"
      /(\d+)\s*times?\s*per\s*day\s*for\s*(\d+)\s*days?/gi
    ];

    let currentDate = new Date(actualStartDate);
    let matches = [];
    
    // Try each pattern
    for (const pattern of patterns) {
      pattern.lastIndex = 0; // Reset regex
      const patternMatches = [...fullInstructions.matchAll(pattern)];
      if (patternMatches.length > 0) {
        matches = patternMatches;
        break;
      }
    }

    if (matches.length === 0) {
      // If no tapering pattern found, create a simple schedule
      return this.createSimpleSchedule(medication, actualStartDate);
    }

    // Process matches to create timeline
    matches.forEach((match, index) => {
      let frequency, duration, dosage = 1;
      
      if (match.length === 3) {
        // Pattern: frequency, duration
        frequency = parseInt(match[1]);
        duration = parseInt(match[2]);
      } else if (match.length === 4) {
        // Pattern: dosage, frequency, duration
        dosage = parseInt(match[1]);
        frequency = parseInt(match[2]);
        duration = parseInt(match[3]);
      }

      const phaseEndDate = new Date(currentDate.getTime() + (duration * 7 * 24 * 60 * 60 * 1000));
      
      const phase = {
        phase: index + 1,
        startDate: new Date(currentDate),
        endDate: phaseEndDate,
        frequency: frequency,
        dosage: dosage,
        instruction: `${dosage > 1 ? dosage + ' drops ' : ''}${frequency} times daily`,
        daysRemaining: this.calculateDaysRemaining(new Date(currentDate), duration * 7),
        isActive: this.isPhaseActive(new Date(currentDate), duration * 7),
        isCompleted: this.isPhaseCompleted(new Date(currentDate), duration * 7)
      };

      timeline.push(phase);
      
      // Move to next phase
      currentDate = new Date(phaseEndDate);
    });

    return {
      medicationName: medication.name,
      startDate: actualStartDate,
      timeline: timeline,
      totalDuration: this.calculateTotalDuration(timeline),
      currentPhase: this.getCurrentPhase(timeline),
      overallProgress: this.calculateOverallProgress(timeline),
      hasSchedule: true
    };
  }

  // Smart start date detection
  determineStartDate(fullInstructions, startDate, visitDate) {
    // Check if instructions mention "tomorrow", "starting tomorrow", etc.
    const tomorrowPattern = /(?:start(?:ing)?\s+)?tomorrow|next\s+day|beginning\s+tomorrow/i;
    const todayPattern = /(?:start(?:ing)?\s+)?today|right\s+now|immediately/i;
    
    if (tomorrowPattern.test(fullInstructions)) {
      // If doctor said "starting tomorrow", add 1 day to visit date
      const tomorrow = new Date(visitDate || new Date());
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    } else if (todayPattern.test(fullInstructions)) {
      // If doctor said "starting today", use visit date
      return new Date(visitDate || new Date());
    } else if (startDate) {
      // Use provided start date
      return new Date(startDate);
    } else {
      // Default to visit date
      return new Date(visitDate || new Date());
    }
  }

  // Create simple schedule for non-tapering medications
  createSimpleSchedule(medication, startDate) {
    const { frequency, duration, fullInstructions } = medication;
    
    if (!frequency && !fullInstructions) return null;

    // Extract frequency from instructions if not provided
    let timesPerDay = frequency || this.extractFrequency(fullInstructions) || 1;
    let durationDays = duration || this.extractDuration(fullInstructions) || 7; // Default 7 days for eye drops

    // Convert duration string to days if needed
    if (typeof duration === 'string') {
      if (duration.includes('week')) {
        durationDays = parseInt(duration) * 7 || 7;
      } else if (duration.includes('day')) {
        durationDays = parseInt(duration) || 7;
      } else {
        durationDays = 7; // Default for eye drops
      }
    }

    const endDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
    
    return {
      medicationName: medication.name,
      startDate: new Date(startDate),
      timeline: [{
        phase: 1,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        frequency: timesPerDay,
        dosage: 1,
        instruction: fullInstructions || `${timesPerDay} times daily`,
        daysRemaining: this.calculateDaysRemaining(new Date(startDate), durationDays),
        isActive: this.isPhaseActive(new Date(startDate), durationDays),
        isCompleted: this.isPhaseCompleted(new Date(startDate), durationDays)
      }],
      totalDuration: durationDays,
      currentPhase: 1,
      overallProgress: this.calculateProgress(new Date(startDate), new Date(endDate)),
      hasSchedule: true
    };
  }

  // Helper functions
  extractFrequency(instructions) {
    const frequencyMatch = instructions.match(/(\d+)\s*(?:times?|x)/i);
    return frequencyMatch ? parseInt(frequencyMatch[1]) : 1;
  }

  extractDuration(instructions) {
    const weekMatch = instructions.match(/(\d+)\s*(?:week|wk)s?/i);
    if (weekMatch) return parseInt(weekMatch[1]) * 7;
    
    const dayMatch = instructions.match(/(\d+)\s*days?/i);
    if (dayMatch) return parseInt(dayMatch[1]);
    
    return null;
  }

  calculateDaysRemaining(startDate, durationDays) {
    const endDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
    const today = new Date();
    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  isPhaseActive(startDate, durationDays) {
    const today = new Date();
    const endDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
    return today >= startDate && today <= endDate;
  }

  isPhaseCompleted(startDate, durationDays) {
    const today = new Date();
    const endDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
    return today > endDate;
  }

  calculateTotalDuration(timeline) {
    return timeline.reduce((total, phase) => {
      const phaseDuration = (phase.endDate - phase.startDate) / (1000 * 60 * 60 * 24);
      return total + phaseDuration;
    }, 0);
  }

  getCurrentPhase(timeline) {
    const today = new Date();
    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].isActive) {
        return i + 1;
      }
    }
    return timeline.length; // All phases completed or not started
  }

  calculateOverallProgress(timeline) {
    const totalDays = this.calculateTotalDuration(timeline);
    if (totalDays === 0) return 0;
    
    const completedDays = timeline.reduce((completed, phase) => {
      if (phase.isCompleted) {
        return completed + ((phase.endDate - phase.startDate) / (1000 * 60 * 60 * 24));
      } else if (phase.isActive) {
        const today = new Date();
        return completed + ((today - phase.startDate) / (1000 * 60 * 60 * 24));
      }
      return completed;
    }, 0);
    
    const progress = (completedDays / totalDays) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  calculateProgress(startDate, endDate) {
    const today = new Date();
    const totalDuration = endDate - startDate;
    if (totalDuration === 0) return 0;
    
    const elapsed = today - startDate;
    const progress = (elapsed / totalDuration) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  // Generate daily schedule for a specific date
  generateDailySchedule(medicationSchedule, date) {
    const targetDate = new Date(date);
    const currentPhase = medicationSchedule.timeline.find(phase => 
      targetDate >= phase.startDate && targetDate <= phase.endDate
    );

    if (!currentPhase) return null;

    const schedule = [];
    const timesPerDay = currentPhase.frequency;
    
    // Generate suggested times based on frequency
    const suggestedTimes = this.generateSuggestedTimes(timesPerDay);
    
    suggestedTimes.forEach((time, index) => {
      schedule.push({
        time: time,
        dosage: currentPhase.dosage,
        instruction: currentPhase.instruction,
        taken: false, // This would be tracked in the database
        scheduledDateTime: new Date(targetDate.setHours(time.hour, time.minute, 0, 0))
      });
    });

    return {
      date: targetDate,
      phase: currentPhase,
      schedule: schedule,
      totalDoses: timesPerDay
    };
  }

  generateSuggestedTimes(frequency) {
    const times = [];
    
    switch (frequency) {
      case 1:
        times.push({ hour: 8, minute: 0, label: '8:00 AM' });
        break;
      case 2:
        times.push({ hour: 8, minute: 0, label: '8:00 AM' });
        times.push({ hour: 20, minute: 0, label: '8:00 PM' });
        break;
      case 3:
        times.push({ hour: 8, minute: 0, label: '8:00 AM' });
        times.push({ hour: 14, minute: 0, label: '2:00 PM' });
        times.push({ hour: 20, minute: 0, label: '8:00 PM' });
        break;
      case 4:
        times.push({ hour: 8, minute: 0, label: '8:00 AM' });
        times.push({ hour: 12, minute: 0, label: '12:00 PM' });
        times.push({ hour: 18, minute: 0, label: '6:00 PM' });
        times.push({ hour: 22, minute: 0, label: '10:00 PM' });
        break;
      default:
        // For higher frequencies, distribute evenly
        const interval = 24 / frequency;
        for (let i = 0; i < frequency; i++) {
          const hour = Math.round(8 + (i * interval)) % 24;
          times.push({ 
            hour: hour, 
            minute: 0, 
            label: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}` 
          });
        }
    }
    
    return times;
  }

  // Format date for display
  formatDate(date) {
    if (!date || isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateLong(date) {
    if (!date || isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Get medication status
  getMedicationStatus(medicationSchedule) {
    const today = new Date();
    const currentPhase = medicationSchedule.timeline.find(phase => phase.isActive);
    
    if (!currentPhase) {
      const isCompleted = medicationSchedule.timeline.every(phase => phase.isCompleted);
      const hasStarted = medicationSchedule.timeline.some(phase => phase.isCompleted || phase.isActive);
      
      if (isCompleted) {
        return {
          status: 'completed',
          message: 'Treatment completed',
          currentPhase: null
        };
      } else if (!hasStarted) {
        const nextPhase = medicationSchedule.timeline[0];
        return {
          status: 'not-started',
          message: `Starts ${this.formatDate(nextPhase.startDate)}`,
          currentPhase: null,
          nextPhase: nextPhase
        };
      }
    }

    if (currentPhase) {
      return {
        status: 'active',
        message: `Phase ${currentPhase.phase}: ${currentPhase.instruction}`,
        currentPhase: currentPhase,
        daysRemaining: currentPhase.daysRemaining
      };
    }

    // Fallback for edge cases
    return {
      status: 'unknown',
      message: 'Status unavailable',
      currentPhase: null
    };
  }
}

// Export for global use
window.MedicationScheduler = MedicationScheduler;
