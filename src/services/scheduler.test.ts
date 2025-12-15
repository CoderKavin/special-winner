/**
 * SCHEDULER SERVICE TESTS
 *
 * Tests for the core scheduling algorithm with hard constraints:
 * - Weekly hours budget never exceeded
 * - No simultaneous draft phases
 * - Feasibility checks before scheduling
 * - IA sequencing for optimal learning transfer
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkScheduleFeasibility,
  sequenceIAs,
  generateSchedule,
  detectPhase,
} from "./scheduler";
import {
  mockAllIAs,
  mockStateWithMilestones,
  mockImpossibleDeadline,
  mockRealisticDeadline,
  mockFarFutureDeadline,
  createMockMilestonesForIA,
} from "../test/fixtures";
import {
  format,
  addWeeks,
  addDays,
  parseISO,
  differenceInDays,
} from "date-fns";
import type { IA } from "../types";

describe("Scheduler Service", () => {
  // ============================================
  // FEASIBILITY CHECKS
  // ============================================

  describe("checkScheduleFeasibility", () => {
    describe("Happy Path", () => {
      it("should return feasible for realistic deadline with 6h/week budget", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 6,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.isFeasible).toBe(true);
        expect(result.availableHours).toBeGreaterThan(result.totalHoursNeeded);
        expect(result.message).toContain("feasible");
      });

      it("should calculate correct total hours needed for all IAs", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 6,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        // 3 economics (7h each) + math (19h) + physics (18h) + history (15h) + english (12h)
        // = 21 + 19 + 18 + 15 + 12 = 85h base, * 1.2 buffer = 102h
        expect(result.totalHoursNeeded).toBeGreaterThan(80);
        expect(result.totalHoursNeeded).toBeLessThan(130);
      });

      it("should provide breakdown by IA", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 6,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.breakdown).toHaveLength(mockAllIAs.length);
        expect(result.breakdown[0]).toHaveProperty("iaId");
        expect(result.breakdown[0]).toHaveProperty("iaName");
        expect(result.breakdown[0]).toHaveProperty("hoursNeeded");
        expect(result.breakdown[0]).toHaveProperty("weeksNeeded");
      });
    });

    describe("Edge Cases", () => {
      it("should reject impossible deadline (3 days for 100+ hours)", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 6,
          masterDeadline: mockImpossibleDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.isFeasible).toBe(false);
        expect(result.availableHours).toBeLessThan(result.totalHoursNeeded);
        expect(result.message).toContain("IMPOSSIBLE");
      });

      it("should handle far future deadline (5 years)", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 6,
          masterDeadline: mockFarFutureDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.isFeasible).toBe(true);
        expect(result.weeksAvailable).toBeGreaterThan(200);
      });

      it("should handle 1 hour/week budget (very slow)", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 1,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        // With only 1h/week for 26 weeks = 26h available
        // Need ~100h, so should be infeasible
        expect(result.isFeasible).toBe(false);
      });

      it("should handle very high hours budget (60h/week)", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 60,
          masterDeadline: mockImpossibleDeadline, // Even 3 days
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        // 60h/week for 3 days ≈ 25h available, still not enough for 100h
        expect(result.isFeasible).toBe(false);
      });

      it("should handle single IA correctly", () => {
        const singleIA = [mockAllIAs[0]]; // Just economics micro
        const result = checkScheduleFeasibility(singleIA, {
          weeklyHoursBudget: 6,
          masterDeadline: format(addWeeks(new Date(), 4), "yyyy-MM-dd"),
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.isFeasible).toBe(true);
        expect(result.breakdown).toHaveLength(1);
      });

      it("should handle IAs with existing milestones", () => {
        const iasWithMilestones = mockAllIAs.map((ia) => ({
          ...ia,
          milestones: createMockMilestonesForIA(ia.id),
        }));

        const result = checkScheduleFeasibility(iasWithMilestones, {
          weeklyHoursBudget: 6,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.breakdown.length).toBe(iasWithMilestones.length);
      });

      it("should handle IAs with some completed milestones", () => {
        const iaWithProgress: IA = {
          ...mockAllIAs[0],
          milestones: createMockMilestonesForIA(mockAllIAs[0].id).map(
            (m, i) => ({
              ...m,
              completed: i < 2, // First 2 completed
            }),
          ),
        };

        const result = checkScheduleFeasibility([iaWithProgress], {
          weeklyHoursBudget: 6,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        // Should only count incomplete milestones
        expect(result.totalHoursNeeded).toBeLessThan(20);
      });
    });

    describe("Error Cases", () => {
      it("should handle empty IA list gracefully", () => {
        const result = checkScheduleFeasibility([], {
          weeklyHoursBudget: 6,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.isFeasible).toBe(true);
        expect(result.totalHoursNeeded).toBe(0);
      });

      it("should provide minimum deadline when infeasible", () => {
        const result = checkScheduleFeasibility(mockAllIAs, {
          weeklyHoursBudget: 6,
          masterDeadline: mockImpossibleDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.minimumDeadline).toBeDefined();
        const minDeadline = parseISO(result.minimumDeadline);
        expect(minDeadline.getTime()).toBeGreaterThan(new Date().getTime());
      });
    });
  });

  // ============================================
  // IA SEQUENCING
  // ============================================

  describe("sequenceIAs", () => {
    it("should sequence IAs for optimal learning transfer", () => {
      const sequenced = sequenceIAs(mockAllIAs);

      // Economics cluster should come first
      const econIndices = sequenced
        .map((ia, i) => (ia.id.startsWith("econ") ? i : -1))
        .filter((i) => i >= 0);

      // All economics should be grouped together
      expect(econIndices[econIndices.length - 1] - econIndices[0]).toBe(
        econIndices.length - 1,
      );
    });

    it("should maintain all IAs (no duplicates, no missing)", () => {
      const sequenced = sequenceIAs(mockAllIAs);

      expect(sequenced).toHaveLength(mockAllIAs.length);

      const ids = sequenced.map((ia) => ia.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(mockAllIAs.length);
    });

    it("should handle single IA", () => {
      const single = [mockAllIAs[3]]; // Math
      const sequenced = sequenceIAs(single);

      expect(sequenced).toHaveLength(1);
      expect(sequenced[0].id).toBe("math");
    });

    it("should handle IAs not in predefined clusters", () => {
      const customIA: IA = {
        id: "custom-ia",
        name: "Custom Subject IA",
        type: "investigation",
        wordCount: 2000,
        status: "not_started",
        milestones: [],
      };

      const sequenced = sequenceIAs([...mockAllIAs, customIA]);

      // Custom IA should be included
      expect(sequenced.some((ia) => ia.id === "custom-ia")).toBe(true);
      expect(sequenced).toHaveLength(mockAllIAs.length + 1);
    });
  });

  // ============================================
  // PHASE DETECTION
  // ============================================

  describe("detectPhase", () => {
    it("should detect research phase", () => {
      expect(detectPhase("Research & Topic Selection")).toBe("research");
      expect(detectPhase("Find News Article")).toBe("research");
      expect(detectPhase("Topic exploration")).toBe("research");
    });

    it("should detect outline phase", () => {
      expect(detectPhase("Outline & Structure")).toBe("outline");
      expect(detectPhase("Diagram & Key Concepts")).toBe("outline");
      expect(detectPhase("Create structure")).toBe("outline");
    });

    it("should detect draft phase", () => {
      expect(detectPhase("First Draft")).toBe("draft");
      expect(detectPhase("Write the document")).toBe("draft");
      expect(detectPhase("Complete draft")).toBe("draft");
    });

    it("should detect revision phase", () => {
      expect(detectPhase("Revision & Refinement")).toBe("revision");
      expect(detectPhase("Revise and improve")).toBe("revision");
      expect(detectPhase("Refine arguments")).toBe("revision");
    });

    it("should detect polish phase", () => {
      expect(detectPhase("Final Polish")).toBe("polish");
      expect(detectPhase("Final Submission")).toBe("polish");
      expect(detectPhase("Submission preparation")).toBe("polish");
    });

    it("should default to research for unknown phases", () => {
      expect(detectPhase("Unknown milestone name")).toBe("research");
      expect(detectPhase("")).toBe("research");
    });
  });

  // ============================================
  // SCHEDULE GENERATION
  // ============================================

  describe("generateSchedule", () => {
    describe("Happy Path", () => {
      it("should generate schedule structure for realistic deadline", () => {
        const iasWithMilestones = mockAllIAs.map((ia) => ({
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

        // Should produce valid schedule structure
        expect(result.scheduledIAs).toBeDefined();
        expect(result.weekAllocations).toBeDefined();
        expect(result.feasibility).toBeDefined();
        expect(result.feasibility.isFeasible).toBe(true);
      });

      it("should never exceed weekly hours budget", () => {
        const iasWithMilestones = mockAllIAs.map((ia) => ({
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

        result.weekAllocations.forEach((week) => {
          expect(week.allocatedHours).toBeLessThanOrEqual(6.1); // Small tolerance for floating point
        });
      });

      it("should return sequenced IAs in result", () => {
        const iasWithMilestones = mockAllIAs.map((ia) => ({
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

        expect(result.scheduledIAs).toHaveLength(iasWithMilestones.length);
      });
    });

    describe("Edge Cases", () => {
      it("should fail gracefully for impossible schedule", () => {
        const iasWithMilestones = mockAllIAs.map((ia) => ({
          ...ia,
          milestones: createMockMilestonesForIA(ia.id),
        }));

        const result = generateSchedule(iasWithMilestones, {
          weeklyHoursBudget: 6,
          masterDeadline: mockImpossibleDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should handle IAs without milestones", () => {
        const result = generateSchedule(mockAllIAs, {
          weeklyHoursBudget: 6,
          masterDeadline: mockRealisticDeadline,
          bufferMultiplier: 1.2,
          respectDraftSequence: true,
          maxIAsPerDay: 2,
        });

        // Should still complete (IAs without milestones are skipped)
        expect(result.scheduledIAs).toHaveLength(mockAllIAs.length);
      });

      it("should respect max IAs per day constraint", () => {
        const iasWithMilestones = mockAllIAs.map((ia) => ({
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

        result.weekAllocations.forEach((week) => {
          expect(week.iasActiveThisWeek.size).toBeLessThanOrEqual(2);
        });
      });
    });
  });
});
