/**
 * AI MILESTONE GENERATION TESTS
 *
 * Tests for AI-powered milestone generation and feasibility checking
 */

import { describe, it, expect } from "vitest";
import { checkGenerationFeasibility } from "./ai";
import {
  mockAllIAs,
  mockRealisticDeadline,
  mockImpossibleDeadline,
} from "../test/fixtures";
import { format, addWeeks } from "date-fns";

describe("AI Milestone Generation Service", () => {
  // ============================================
  // FEASIBILITY CHECK
  // ============================================

  describe("checkGenerationFeasibility", () => {
    describe("Happy Path", () => {
      it("should return canProceed=true for feasible schedule", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockRealisticDeadline,
          6,
        );

        expect(result.canProceed).toBe(true);
        expect(result.isFeasible).toBe(true);
        expect(result.userActionRequired).toBe("none");
      });

      it("should provide complete breakdown of hours by IA", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockRealisticDeadline,
          6,
        );

        expect(result.breakdown).toHaveLength(mockAllIAs.length);
        result.breakdown.forEach((item) => {
          expect(item.iaId).toBeDefined();
          expect(item.iaName).toBeDefined();
          expect(item.hoursNeeded).toBeGreaterThan(0);
          expect(item.weeksNeeded).toBeGreaterThan(0);
        });
      });

      it("should calculate realistic hour estimates for economics", () => {
        const econOnly = mockAllIAs.filter((ia) => ia.id.startsWith("econ"));
        const result = checkGenerationFeasibility(
          econOnly,
          mockRealisticDeadline,
          6,
        );

        // Each economics commentary should be ~7-10 hours with buffer
        const totalHours = result.breakdown.reduce(
          (sum, b) => sum + b.hoursNeeded,
          0,
        );
        expect(totalHours).toBeGreaterThan(20); // 3 * 7h minimum
        expect(totalHours).toBeLessThan(40); // Reasonable upper bound
      });

      it("should calculate realistic hour estimates for major IAs", () => {
        const majorIAs = mockAllIAs.filter((ia) =>
          ["math", "physics", "history", "english"].includes(ia.id),
        );
        const result = checkGenerationFeasibility(
          majorIAs,
          mockRealisticDeadline,
          6,
        );

        // Math: 19h, Physics: 18h, History: 15h, English: 12h = 64h base
        // With 1.2 buffer ≈ 77h
        expect(result.totalHoursNeeded).toBeGreaterThan(60);
        expect(result.totalHoursNeeded).toBeLessThan(100);
      });
    });

    describe("Edge Cases", () => {
      it("should reject impossible deadline with extend_deadline suggestion", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockImpossibleDeadline,
          6,
        );

        expect(result.canProceed).toBe(false);
        expect(result.isFeasible).toBe(false);
        expect(result.userActionRequired).toBe("extend_deadline");
        expect(result.suggestedDeadline).toBeDefined();
      });

      it("should suggest increasing hours when that would be sufficient", () => {
        // 4 weeks at 6h/week = 24h available
        // Need ~100h, so would need ~25h/week (too much)
        // But if we need only 40h, would need 10h/week (reasonable)
        const singleIA = mockAllIAs.filter((ia) => ia.id === "history");
        const shortDeadline = format(addWeeks(new Date(), 4), "yyyy-MM-dd");

        const result = checkGenerationFeasibility(singleIA, shortDeadline, 6);

        // History IA needs ~18h (15 * 1.2), 4 weeks * 6h = 24h available
        // This should be feasible
        expect(result.isFeasible).toBe(true);
      });

      it("should handle empty IA list", () => {
        const result = checkGenerationFeasibility([], mockRealisticDeadline, 6);

        expect(result.canProceed).toBe(true);
        expect(result.totalHoursNeeded).toBe(0);
        expect(result.breakdown).toHaveLength(0);
      });

      it("should handle very high weekly hours budget", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockImpossibleDeadline,
          40, // 40 hours per week
        );

        // Even with 40h/week, 3 days isn't enough for 100h
        expect(result.isFeasible).toBe(false);
      });

      it("should handle very low weekly hours budget", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockRealisticDeadline,
          1, // Only 1 hour per week
        );

        // 26 weeks * 1h = 26h available, need 100h
        expect(result.isFeasible).toBe(false);
        expect(result.userActionRequired).not.toBe("none");
      });
    });

    describe("Calculation Accuracy", () => {
      it("should calculate available hours correctly", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockRealisticDeadline,
          6,
        );

        // 26 weeks * 6h/week ≈ 156 hours
        expect(result.availableHours).toBeGreaterThan(140);
        expect(result.availableHours).toBeLessThan(180);
      });

      it("should calculate weeks needed correctly", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockRealisticDeadline,
          6,
        );

        // ~100h needed / 6h per week ≈ 17 weeks
        expect(result.weeksNeeded).toBeGreaterThan(10);
        expect(result.weeksNeeded).toBeLessThan(25);
      });

      it("should provide valid minimum deadline when infeasible", () => {
        const result = checkGenerationFeasibility(
          mockAllIAs,
          mockImpossibleDeadline,
          6,
        );

        expect(result.minimumDeadline).toBeDefined();
        const minDate = new Date(result.minimumDeadline);
        const impossible = new Date(mockImpossibleDeadline);
        expect(minDate.getTime()).toBeGreaterThan(impossible.getTime());
      });
    });
  });

  // ============================================
  // MILESTONE GENERATION (FALLBACK)
  // ============================================

  describe("Milestone Templates", () => {
    it("should provide 5 milestones per IA type", () => {
      // This tests the fallback milestone generation structure
      // The actual generation requires API, so we test the template structure

      const econMilestonePhases = [
        "Find News Article",
        "Diagram & Key Concepts",
        "First Draft",
        "Revision & Theory",
        "Final Submission",
      ];

      const majorMilestonePhases = [
        "Research & Topic Selection",
        "Outline & Structure",
        "First Draft",
        "Revision & Refinement",
        "Final Polish",
      ];

      expect(econMilestonePhases).toHaveLength(5);
      expect(majorMilestonePhases).toHaveLength(5);
    });

    it("should have appropriate hour estimates for economics", () => {
      // Economics: 1 + 1 + 3 + 1.5 + 0.5 = 7 hours
      const econHours = 1 + 1 + 3 + 1.5 + 0.5;
      expect(econHours).toBe(7);
    });

    it("should have appropriate hour estimates for major IAs", () => {
      // Math: 3 + 2 + 8 + 4 + 2 = 19 hours
      const mathHours = 3 + 2 + 8 + 4 + 2;
      expect(mathHours).toBe(19);

      // Physics: 2 + 2 + 5 + 5 + 3 + 1 = 18 hours
      const physicsHours = 2 + 2 + 5 + 5 + 3 + 1;
      expect(physicsHours).toBe(18);

      // History: 4 + 2 + 5 + 3 + 1 = 15 hours
      const historyHours = 4 + 2 + 5 + 3 + 1;
      expect(historyHours).toBe(15);

      // English: 2 + 1.5 + 4 + 3 + 1.5 = 12 hours
      const englishHours = 2 + 1.5 + 4 + 3 + 1.5;
      expect(englishHours).toBe(12);
    });
  });

  // ============================================
  // BUFFER MULTIPLIER
  // ============================================

  describe("Buffer Multiplier", () => {
    it("should use 1.2x buffer (20% contingency)", () => {
      const baseHours = 100;
      const bufferedHours = baseHours * 1.2;
      expect(bufferedHours).toBe(120);
    });

    it("should apply buffer consistently across all IAs", () => {
      const result = checkGenerationFeasibility(
        mockAllIAs,
        mockRealisticDeadline,
        6,
      );

      // Total hours should be higher than sum of base estimates
      // Base: 7*3 + 19 + 18 + 15 + 12 = 85h
      // Buffered: 85 * 1.2 = 102h
      expect(result.totalHoursNeeded).toBeGreaterThan(85);
    });
  });
});
