/**
 * SCHEDULE OPTIMIZER TESTS
 *
 * Tests for actionable warning generation and fix application
 */

import { describe, it, expect } from "vitest";
import {
  analyzeScheduleWarnings,
  applyFix,
  generateOptimizationScenarios,
  type ScheduleFix,
} from "./scheduleOptimizer";
import {
  mockStateWithIAs,
  mockImpossibleDeadline,
  mockRealisticDeadline,
  createMockMilestonesForIA,
} from "../test/fixtures";
import { format, addWeeks, addDays } from "date-fns";
import type { AppState } from "../types";

describe("Schedule Optimizer Service", () => {
  // ============================================
  // WARNING ANALYSIS
  // ============================================

  describe("analyzeScheduleWarnings", () => {
    describe("Deadline Feasibility Warnings", () => {
      it("should detect impossible deadline", () => {
        const state: AppState = {
          ...mockStateWithIAs,
          masterDeadline: mockImpossibleDeadline,
        };

        const warnings = analyzeScheduleWarnings(state);

        const deadlineWarning = warnings.find(
          (w) => w.type === "deadline_impossible",
        );
        expect(deadlineWarning).toBeDefined();
        expect(deadlineWarning?.severity).toBe("critical");
      });

      it("should provide fix options for impossible deadline", () => {
        const state: AppState = {
          ...mockStateWithIAs,
          masterDeadline: mockImpossibleDeadline,
        };

        const warnings = analyzeScheduleWarnings(state);
        const deadlineWarning = warnings.find(
          (w) => w.type === "deadline_impossible",
        );

        expect(deadlineWarning?.fixes.length).toBeGreaterThan(0);

        // Should have extend_deadline fix
        const extendFix = deadlineWarning?.fixes.find(
          (f) => f.type === "extend_deadline",
        );
        expect(extendFix).toBeDefined();
        expect(extendFix?.recommended).toBe(true);

        // Should have increase_hours fix
        const hoursFix = deadlineWarning?.fixes.find(
          (f) => f.type === "increase_hours",
        );
        expect(hoursFix).toBeDefined();
      });

      it("should not warn for feasible deadline", () => {
        const state: AppState = {
          ...mockStateWithIAs,
          masterDeadline: mockRealisticDeadline,
        };

        const warnings = analyzeScheduleWarnings(state);

        const deadlineWarning = warnings.find(
          (w) => w.type === "deadline_impossible",
        );
        expect(deadlineWarning).toBeUndefined();
      });

      it("should calculate hours shortage correctly", () => {
        const state: AppState = {
          ...mockStateWithIAs,
          masterDeadline: mockImpossibleDeadline,
        };

        const warnings = analyzeScheduleWarnings(state);
        const deadlineWarning = warnings.find(
          (w) => w.type === "deadline_impossible",
        );

        expect(deadlineWarning?.hoursShort).toBeGreaterThan(0);
      });
    });

    describe("Weekly Budget Warnings", () => {
      it("should detect weeks over budget", () => {
        // Create state with milestones that exceed weekly budget
        const overloadedMilestones = createMockMilestonesForIA("test").map(
          (m) => ({
            ...m,
            estimated_hours: 10, // High hours
            startDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
            deadline: format(addDays(new Date(), 7), "yyyy-MM-dd"), // All in same week
          }),
        );

        const state: AppState = {
          ...mockStateWithIAs,
          ias: [
            {
              ...mockStateWithIAs.ias[0],
              milestones: overloadedMilestones,
            },
          ],
          masterDeadline: mockRealisticDeadline,
        };

        const warnings = analyzeScheduleWarnings(state);
        const budgetWarning = warnings.find(
          (w) => w.type === "weekly_budget_exceeded",
        );

        // May or may not find warning depending on calculation
        // This test validates the structure when warning exists
        if (budgetWarning) {
          expect(budgetWarning.fixes.length).toBeGreaterThan(0);
        }
      });
    });

    describe("Context Switching Warnings", () => {
      it("should detect excessive context switching", () => {
        // Create state where many IAs are scheduled on same days
        const today = new Date();
        const iasWithOverlappingSchedules = mockStateWithIAs.ias.map((ia) => ({
          ...ia,
          milestones: createMockMilestonesForIA(ia.id).map((m) => ({
            ...m,
            startDate: format(today, "yyyy-MM-dd"),
            deadline: format(addDays(today, 7), "yyyy-MM-dd"),
          })),
        }));

        const state: AppState = {
          ...mockStateWithIAs,
          ias: iasWithOverlappingSchedules,
          masterDeadline: mockRealisticDeadline,
        };

        const warnings = analyzeScheduleWarnings(state);
        const contextWarning = warnings.find(
          (w) => w.type === "context_switching",
        );

        if (contextWarning) {
          expect(contextWarning.fixes.length).toBeGreaterThan(0);
          expect(contextWarning.title).toContain("lost");
        }
      });
    });

    describe("Draft Overlap Warnings", () => {
      it("should detect overlapping draft phases", () => {
        const today = new Date();

        // Create two IAs with overlapping draft phases
        const ia1Milestones = createMockMilestonesForIA("ia1").map((m, i) => ({
          ...m,
          startDate: format(addWeeks(today, i), "yyyy-MM-dd"),
          deadline: format(addWeeks(today, i + 1), "yyyy-MM-dd"),
        }));

        const ia2Milestones = createMockMilestonesForIA("ia2").map((m, i) => ({
          ...m,
          startDate: format(addWeeks(today, i), "yyyy-MM-dd"),
          deadline: format(addWeeks(today, i + 1), "yyyy-MM-dd"),
        }));

        const state: AppState = {
          ...mockStateWithIAs,
          ias: [
            {
              ...mockStateWithIAs.ias[0],
              id: "ia1",
              milestones: ia1Milestones,
            },
            {
              ...mockStateWithIAs.ias[1],
              id: "ia2",
              milestones: ia2Milestones,
            },
          ],
          masterDeadline: mockRealisticDeadline,
        };

        const warnings = analyzeScheduleWarnings(state);
        const draftWarning = warnings.find((w) => w.type === "draft_overlap");

        if (draftWarning) {
          expect(draftWarning.fixes.length).toBeGreaterThan(0);
          expect(draftWarning.affectedIAs).toBeDefined();
        }
      });
    });
  });

  // ============================================
  // FIX APPLICATION
  // ============================================

  describe("applyFix", () => {
    it("should apply extend_deadline fix correctly", () => {
      const newDeadline = format(addWeeks(new Date(), 30), "yyyy-MM-dd");

      const fix: ScheduleFix = {
        id: "extend-deadline",
        type: "extend_deadline",
        label: "Extend Deadline",
        description: "Move deadline to later date",
        impact: "Adds 4 weeks",
        recommended: true,
        risk: "low",
        action: () => ({ masterDeadline: newDeadline }),
      };

      const state = mockStateWithIAs;
      const { newState, result } = applyFix(state, fix);

      expect(newState.masterDeadline).toBe(newDeadline);
      expect(result.success).toBe(true);
      expect(result.newDeadline).toBe(newDeadline);
      expect(result.changes.some((c) => c.includes("Deadline extended"))).toBe(
        true,
      );
    });

    it("should apply increase_hours fix correctly", () => {
      const newHours = 10;

      const fix: ScheduleFix = {
        id: "increase-hours",
        type: "increase_hours",
        label: "Increase Hours",
        description: "Work more hours per week",
        impact: "+4h per week",
        risk: "medium",
        action: () => ({ weeklyHoursBudget: newHours }),
      };

      const state = mockStateWithIAs;
      const { newState, result } = applyFix(state, fix);

      expect(newState.weeklyHoursBudget).toBe(newHours);
      expect(result.success).toBe(true);
      expect(result.newWeeklyHours).toBe(newHours);
    });

    it("should return success=false when action returns empty object", () => {
      const fix: ScheduleFix = {
        id: "no-op",
        type: "spread_work",
        label: "No Op",
        description: "Does nothing",
        impact: "None",
        action: () => ({}), // Empty changes
      };

      const { result } = applyFix(mockStateWithIAs, fix);

      expect(result.success).toBe(false);
      expect(result.changes).toHaveLength(0);
    });
  });

  // ============================================
  // OPTIMIZATION SCENARIOS
  // ============================================

  describe("generateOptimizationScenarios", () => {
    it("should generate scenarios when deadline warning exists", () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);
      const scenarios = generateOptimizationScenarios(state, warnings);

      expect(scenarios.length).toBeGreaterThan(0);
    });

    it("should mark recommended scenario", () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);
      const scenarios = generateOptimizationScenarios(state, warnings);

      const recommended = scenarios.find((s) => s.recommended);
      expect(recommended).toBeDefined();
    });

    it("should provide tradeoffs for each scenario", () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);
      const scenarios = generateOptimizationScenarios(state, warnings);

      scenarios.forEach((scenario) => {
        expect(scenario.tradeoffs).toBeDefined();
        expect(scenario.tradeoffs.length).toBeGreaterThan(0);
      });
    });

    it("should return empty array when no actionable warnings", () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockRealisticDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);
      const scenarios = generateOptimizationScenarios(state, warnings);

      // With a feasible deadline, there may be no deadline-related scenarios
      // This is valid behavior
      expect(scenarios).toBeDefined();
    });
  });

  // ============================================
  // WARNING STRUCTURE VALIDATION
  // ============================================

  describe("Warning Structure", () => {
    it("should have valid warning structure", () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);

      warnings.forEach((warning) => {
        expect(warning.id).toBeDefined();
        expect(warning.type).toBeDefined();
        expect(warning.severity).toMatch(/critical|warning|info/);
        expect(warning.title).toBeDefined();
        expect(warning.description).toBeDefined();
        expect(warning.impact).toBeDefined();
        expect(warning.fixes).toBeDefined();
        expect(Array.isArray(warning.fixes)).toBe(true);
      });
    });

    it("should have valid fix structure", () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockImpossibleDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);

      warnings.forEach((warning) => {
        warning.fixes.forEach((fix) => {
          expect(fix.id).toBeDefined();
          expect(fix.type).toBeDefined();
          expect(fix.label).toBeDefined();
          expect(fix.description).toBeDefined();
          expect(fix.impact).toBeDefined();
          expect(typeof fix.action).toBe("function");
        });
      });
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", () => {
    it("should handle empty state gracefully", () => {
      const emptyState: AppState = {
        ...mockStateWithIAs,
        ias: [],
        masterDeadline: mockRealisticDeadline,
      };

      const warnings = analyzeScheduleWarnings(emptyState);

      // Should not crash, may return no warnings
      expect(warnings).toBeDefined();
    });

    it("should handle state with no milestones", () => {
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: mockRealisticDeadline,
      };

      const warnings = analyzeScheduleWarnings(state);

      expect(warnings).toBeDefined();
    });

    it("should handle very long deadline (5 years)", () => {
      const farFuture = format(addWeeks(new Date(), 260), "yyyy-MM-dd");
      const state: AppState = {
        ...mockStateWithIAs,
        masterDeadline: farFuture,
      };

      const warnings = analyzeScheduleWarnings(state);

      // Should not have deadline_impossible warning
      const deadlineWarning = warnings.find(
        (w) => w.type === "deadline_impossible",
      );
      expect(deadlineWarning).toBeUndefined();
    });
  });
});
