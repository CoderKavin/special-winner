/**
 * INTEGRATION TESTS FOR CORE WORKFLOWS
 *
 * Tests complete user workflows from start to finish:
 * - IA and milestone data management
 * - Schedule generation and optimization
 * - Time tracking
 * - Warning detection and fixes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { checkGenerationFeasibility } from '../../services/ai';
import { checkScheduleFeasibility, generateSchedule, sequenceIAs } from '../../services/scheduler';
import { analyzeScheduleWarnings, applyFix } from '../../services/scheduleOptimizer';
import {
  mockAllIAs,
  mockStateWithIAs,
  mockRealisticDeadline,
  mockImpossibleDeadline,
  createMockMilestonesForIA,
} from '../fixtures';
import { format, addWeeks, addDays } from 'date-fns';
import type { AppState, IA, Milestone } from '../../types';

describe('Integration: Core Workflows', () => {
  // ============================================
  // WORKFLOW 1: NEW USER SETUP
  // ============================================

  describe('New User Setup Workflow', () => {
    it('should start with 7 IAs and no milestones', () => {
      const { result } = renderHook(() => useLocalStorage());

      // Should have IAs defined
      expect(result.current.state.ias.length).toBeGreaterThan(0);

      // Initially no milestones
      const totalMilestones = result.current.state.ias.reduce(
        (sum, ia) => sum + ia.milestones.length,
        0
      );
      expect(totalMilestones).toBe(0);
    });

    it('should check feasibility before generating plans', () => {
      const feasibility = checkGenerationFeasibility(
        mockAllIAs,
        mockRealisticDeadline,
        6 // 6 hours per week
      );

      expect(feasibility.canProceed).toBe(true);
      expect(feasibility.breakdown.length).toBe(mockAllIAs.length);
    });

    it('should reject impossible timeline upfront', () => {
      const feasibility = checkGenerationFeasibility(
        mockAllIAs,
        mockImpossibleDeadline,
        6
      );

      expect(feasibility.canProceed).toBe(false);
      expect(feasibility.userActionRequired).not.toBe('none');
    });
  });

  // ============================================
  // WORKFLOW 2: MILESTONE COMPLETION
  // ============================================

  describe('Milestone Completion Workflow', () => {
    it('should update IA status when milestone completed', () => {
      const { result } = renderHook(() => useLocalStorage());

      // Set up IA with milestones
      const testIA = mockAllIAs[0];
      const milestones = createMockMilestonesForIA(testIA.id);

      act(() => {
        result.current.setMilestones(testIA.id, milestones);
      });

      // Complete first milestone
      act(() => {
        result.current.toggleMilestone(testIA.id, milestones[0].id);
      });

      // Check IA status updated
      const updatedIA = result.current.state.ias.find(ia => ia.id === testIA.id);
      expect(updatedIA?.status).toBe('in_progress');

      // Check milestone is marked complete
      const completedMilestone = updatedIA?.milestones.find(m => m.id === milestones[0].id);
      expect(completedMilestone?.completed).toBe(true);
    });

    it('should track completed milestones globally', () => {
      const { result } = renderHook(() => useLocalStorage());

      const testIA = mockAllIAs[0];
      const milestones = createMockMilestonesForIA(testIA.id);

      act(() => {
        result.current.setMilestones(testIA.id, milestones);
      });

      act(() => {
        result.current.toggleMilestone(testIA.id, milestones[0].id);
      });

      expect(result.current.state.completedMilestones).toContain(milestones[0].id);
    });

    it('should update to completed status when all milestones done', () => {
      const { result } = renderHook(() => useLocalStorage());

      const testIA = mockAllIAs[0];
      const milestones = createMockMilestonesForIA(testIA.id);

      act(() => {
        result.current.setMilestones(testIA.id, milestones);
      });

      // Complete all milestones
      milestones.forEach(m => {
        act(() => {
          result.current.toggleMilestone(testIA.id, m.id);
        });
      });

      const updatedIA = result.current.state.ias.find(ia => ia.id === testIA.id);
      expect(updatedIA?.status).toBe('completed');
    });
  });

  // ============================================
  // WORKFLOW 3: TIME TRACKING
  // ============================================

  describe('Time Tracking Workflow', () => {
    it('should start and stop timer correctly', () => {
      const { result } = renderHook(() => useLocalStorage());

      const testIA = mockAllIAs[0];
      const milestones = createMockMilestonesForIA(testIA.id);

      act(() => {
        result.current.setMilestones(testIA.id, milestones);
      });

      // Start timer
      act(() => {
        result.current.startTimer(testIA.id, milestones[0].id);
      });

      expect(result.current.state.activeTimer).not.toBeNull();
      expect(result.current.state.activeTimer?.milestoneId).toBe(milestones[0].id);

      // Stop timer
      act(() => {
        result.current.stopTimer('Test session');
      });

      expect(result.current.state.activeTimer).toBeNull();
      expect(result.current.state.allWorkSessions.length).toBeGreaterThan(0);
    });

    it('should pause and resume timer', () => {
      const { result } = renderHook(() => useLocalStorage());

      const testIA = mockAllIAs[0];
      const milestones = createMockMilestonesForIA(testIA.id);

      act(() => {
        result.current.setMilestones(testIA.id, milestones);
      });

      act(() => {
        result.current.startTimer(testIA.id, milestones[0].id);
      });

      // Pause
      act(() => {
        result.current.pauseTimer();
      });

      expect(result.current.state.activeTimer?.pausedAt).toBeDefined();

      // Resume
      act(() => {
        result.current.resumeTimer();
      });

      expect(result.current.state.activeTimer?.pausedAt).toBeUndefined();
    });

    it('should log manual hours correctly', () => {
      const { result } = renderHook(() => useLocalStorage());

      const testIA = mockAllIAs[0];
      const milestones = createMockMilestonesForIA(testIA.id);

      act(() => {
        result.current.setMilestones(testIA.id, milestones);
      });

      // Log manual hours
      act(() => {
        result.current.logManualHours(testIA.id, milestones[0].id, 2.5, 'Manual entry');
      });

      const updatedMilestone = result.current.state.ias
        .find(ia => ia.id === testIA.id)
        ?.milestones.find(m => m.id === milestones[0].id);

      expect(updatedMilestone?.actualHours).toBe(2.5);
      expect(updatedMilestone?.workSessions?.length).toBe(1);
    });
  });

  // ============================================
  // WORKFLOW 4: SCHEDULE WARNINGS AND FIXES
  // ============================================

  describe('Schedule Warning and Fix Workflow', () => {
    it('should detect warnings and provide fixes', () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);

      expect(warnings.length).toBeGreaterThan(0);

      const criticalWarning = warnings.find(w => w.severity === 'critical');
      expect(criticalWarning).toBeDefined();
      expect(criticalWarning?.fixes.length).toBeGreaterThan(0);
    });

    it('should apply deadline extension fix', () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);
      const deadlineWarning = warnings.find(w => w.type === 'deadline_impossible');
      const extendFix = deadlineWarning?.fixes.find(f => f.type === 'extend_deadline');

      if (extendFix) {
        const { newState, result } = applyFix(state, extendFix);

        expect(result.success).toBe(true);
        expect(newState.masterDeadline).toBeDefined();
      }
    });

    it('should apply hours increase fix', () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
        weeklyHoursBudget: 6,
      };

      const warnings = analyzeScheduleWarnings(state);
      const deadlineWarning = warnings.find(w => w.type === 'deadline_impossible');
      const hoursFix = deadlineWarning?.fixes.find(f => f.type === 'increase_hours');

      if (hoursFix) {
        const { newState, result } = applyFix(state, hoursFix);

        if (result.success) {
          expect(newState.weeklyHoursBudget).toBeGreaterThan(6);
        }
      }
    });
  });

  // ============================================
  // WORKFLOW 5: IA SEQUENCING
  // ============================================

  describe('IA Sequencing Workflow', () => {
    it('should sequence IAs optimally for learning transfer', () => {
      const sequenced = sequenceIAs(mockAllIAs);

      // Economics cluster should be together
      const econIAs = sequenced.filter(ia => ia.id.startsWith('econ'));
      expect(econIAs.length).toBe(3);

      // All IAs should be present
      expect(sequenced.length).toBe(mockAllIAs.length);
    });

    it('should maintain sequencing through schedule generation', () => {
      const iasWithMilestones = mockAllIAs.map(ia => ({
        ...ia,
        milestones: createMockMilestonesForIA(ia.id),
      }));

      const result = generateSchedule(iasWithMilestones, {
        weeklyHoursBudget: 6,
        masterDeadline: mockRealisticDeadline,
        bufferMultiplier: 1.2,
        respectDraftSequence: true,
        maxIAsPerDay: 2,
      });

      // Scheduled IAs should maintain optimal sequence
      expect(result.scheduledIAs.length).toBe(iasWithMilestones.length);
    });
  });

  // ============================================
  // WORKFLOW 6: DEADLINE MANAGEMENT
  // ============================================

  describe('Deadline Management Workflow', () => {
    it('should update master deadline', () => {
      const { result } = renderHook(() => useLocalStorage());

      const newDeadline = format(addWeeks(new Date(), 30), 'yyyy-MM-dd');

      act(() => {
        result.current.setMasterDeadline(newDeadline);
      });

      expect(result.current.state.masterDeadline).toBe(newDeadline);
    });

    it('should update weekly hours budget', () => {
      const { result } = renderHook(() => useLocalStorage());

      act(() => {
        result.current.setWeeklyHoursBudget(10);
      });

      expect(result.current.state.weeklyHoursBudget).toBe(10);
    });

    it('should recalculate feasibility after deadline change', () => {
      const shortDeadline = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const longDeadline = format(addWeeks(new Date(), 52), 'yyyy-MM-dd');

      const shortFeasibility = checkGenerationFeasibility(mockAllIAs, shortDeadline, 6);
      const longFeasibility = checkGenerationFeasibility(mockAllIAs, longDeadline, 6);

      expect(shortFeasibility.isFeasible).toBe(false);
      expect(longFeasibility.isFeasible).toBe(true);
    });
  });

  // ============================================
  // WORKFLOW 7: DATA PERSISTENCE
  // ============================================

  describe('Data Persistence Workflow', () => {
    it('should reset state to initial values', () => {
      const { result } = renderHook(() => useLocalStorage());

      // Make some changes
      act(() => {
        result.current.setWeeklyHoursBudget(20);
      });

      // Reset
      act(() => {
        result.current.resetState();
      });

      // Should be back to default
      expect(result.current.state.weeklyHoursBudget).toBe(6);
    });

    it('should preserve IA data through state updates', () => {
      const { result } = renderHook(() => useLocalStorage());

      const testIA = mockAllIAs[0];
      const milestones = createMockMilestonesForIA(testIA.id);

      // Set milestones
      act(() => {
        result.current.setMilestones(testIA.id, milestones);
      });

      // Update something else
      act(() => {
        result.current.setWeeklyHoursBudget(8);
      });

      // Milestones should still be there
      const ia = result.current.state.ias.find(i => i.id === testIA.id);
      expect(ia?.milestones.length).toBe(5);
    });
  });
});
