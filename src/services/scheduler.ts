/**
 * SCHEDULING SERVICE
 *
 * This service handles the core scheduling logic with HARD CONSTRAINTS:
 * 1. Weekly hours budget - NEVER exceeded
 * 2. No simultaneous drafts - only ONE IA in draft phase at a time
 * 3. Maximum 2 IAs per day - prevents context switching overhead
 * 4. Minimum session lengths - no fragmentation
 * 5. Feasibility check BEFORE scheduling
 */

import type { IA, Milestone, MilestonePhase } from "../types";
import {
  differenceInDays,
  addDays,
  format,
  parseISO,
  startOfWeek,
  addWeeks,
} from "date-fns";

// ============================================
// TYPES
// ============================================

export interface ScheduleFeasibility {
  isFeasible: boolean;
  totalHoursNeeded: number;
  availableHours: number;
  weeksNeeded: number;
  weeksAvailable: number;
  minimumDeadline: string; // ISO date
  message: string;
  breakdown: {
    iaId: string;
    iaName: string;
    hoursNeeded: number;
    weeksNeeded: number;
  }[];
}

export interface ScheduleOptions {
  weeklyHoursBudget: number;
  masterDeadline: string;
  bufferMultiplier: number;
  respectDraftSequence: boolean;
  maxIAsPerDay: number;
}

export interface ScheduledMilestone extends Milestone {
  weekNumber: number;
  scheduledHoursPerWeek: Map<number, number>; // week number -> hours
}

export interface WeekAllocation {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  allocatedHours: number;
  remainingHours: number;
  milestones: { milestoneId: string; iaId: string; hours: number }[];
  iasActiveThisWeek: Set<string>;
}

export interface ScheduleResult {
  success: boolean;
  feasibility: ScheduleFeasibility;
  scheduledIAs: IA[];
  weekAllocations: WeekAllocation[];
  warnings: string[];
  errors: string[];
}

// ============================================
// CONSTANTS
// ============================================

// Minimum session hours by phase (HARD CONSTRAINT)
const MINIMUM_SESSION_HOURS: Record<MilestonePhase, number> = {
  research: 2,
  outline: 1.5,
  draft: 3,
  revision: 2,
  polish: 1,
};

// IA sequencing clusters (for optimal learning transfer)
const IA_SEQUENCE_ORDER: string[][] = [
  // Economics cluster - do all 3 together
  ["econ-micro", "econ-macro", "econ-intl"],
  // History then English (thesis skills transfer)
  ["history", "english"],
  // Physics then Math (methodology transfer)
  ["physics", "math"],
];

// ============================================
// FEASIBILITY CHECK
// ============================================

/**
 * Check if a schedule is feasible BEFORE attempting to generate it.
 * This is the FIRST step - if this fails, we don't even try to schedule.
 */
export function checkScheduleFeasibility(
  ias: IA[],
  options: ScheduleOptions,
): ScheduleFeasibility {
  const now = new Date();
  const deadline = parseISO(options.masterDeadline);
  const daysUntilDeadline = differenceInDays(deadline, now);
  const weeksAvailable = Math.max(0, daysUntilDeadline / 7);
  const availableHours = weeksAvailable * options.weeklyHoursBudget;

  // Calculate total hours needed for all IAs
  const breakdown: ScheduleFeasibility["breakdown"] = [];
  let totalHoursNeeded = 0;

  for (const ia of ias) {
    // If IA already has milestones, use those estimates
    if (ia.milestones.length > 0) {
      const iaHours = ia.milestones.reduce((sum, m) => {
        if (m.completed) return sum;
        return sum + m.estimated_hours * m.buffer_multiplier;
      }, 0);

      const weeksForIA = Math.ceil(iaHours / options.weeklyHoursBudget);

      breakdown.push({
        iaId: ia.id,
        iaName: ia.name,
        hoursNeeded: iaHours,
        weeksNeeded: weeksForIA,
      });

      totalHoursNeeded += iaHours;
    } else {
      // Estimate based on IA type
      const estimatedHours = estimateIAHours(ia) * options.bufferMultiplier;
      const weeksForIA = Math.ceil(estimatedHours / options.weeklyHoursBudget);

      breakdown.push({
        iaId: ia.id,
        iaName: ia.name,
        hoursNeeded: estimatedHours,
        weeksNeeded: weeksForIA,
      });

      totalHoursNeeded += estimatedHours;
    }
  }

  const weeksNeeded = Math.ceil(totalHoursNeeded / options.weeklyHoursBudget);
  const isFeasible = totalHoursNeeded <= availableHours;

  // Calculate minimum realistic deadline
  const minimumDeadline = format(
    addWeeks(now, weeksNeeded + 2), // +2 weeks buffer
    "yyyy-MM-dd",
  );

  let message: string;
  if (isFeasible) {
    message = `Schedule is feasible. You have ${availableHours.toFixed(1)} hours available and need ${totalHoursNeeded.toFixed(1)} hours.`;
  } else {
    const shortage = totalHoursNeeded - availableHours;
    const multiplier = (totalHoursNeeded / availableHours).toFixed(1);
    message = `IMPOSSIBLE SCHEDULE: You need ${totalHoursNeeded.toFixed(1)} hours but only have ${availableHours.toFixed(1)} hours available (${daysUntilDeadline} days × ${options.weeklyHoursBudget}h/week ÷ 7). You would need to work ${multiplier}x faster than your weekly budget allows. Shortage: ${shortage.toFixed(1)} hours.`;
  }

  return {
    isFeasible,
    totalHoursNeeded,
    availableHours,
    weeksNeeded,
    weeksAvailable,
    minimumDeadline,
    message,
    breakdown,
  };
}

/**
 * Estimate hours needed for an IA based on its type (before milestones are generated)
 *
 * REALISTIC IB IA ESTIMATES:
 * - Economics Commentary: 800 words, ~6-8 hours total
 * - Math IA: 12-20 pages, ~15-20 hours total
 * - Physics IA: ~15-20 hours total
 * - History IA: 2200 words, ~15-20 hours total
 * - English IA: ~10-15 hours total (oral + written)
 */
function estimateIAHours(ia: IA): number {
  const isEconomics = ia.id.startsWith("econ");

  if (isEconomics) {
    // Economics commentaries: 800 words each, relatively quick
    // Research: 1h, Diagram: 1h, Draft: 3h, Revision: 1.5h, Polish: 0.5h = ~7h
    return 7;
  }

  // Subject-specific estimates for full IAs
  switch (ia.id) {
    case "math":
      // Math AA HL: Complex exploration, ~15-20h
      // Research: 3h, Outline: 2h, Draft: 8h, Revision: 4h, Polish: 2h
      return 19;
    case "physics":
      // Physics HL: Lab work + writeup, ~15-18h
      // Research: 2h, Planning: 2h, Experiment: 5h, Draft: 5h, Revision: 3h, Polish: 1h
      return 18;
    case "history":
      // History SL: 2200 words, ~12-15h
      // Research: 4h, Outline: 2h, Draft: 5h, Revision: 3h, Polish: 1h
      return 15;
    case "english":
      // English Lang & Lit SL: ~10-12h
      // Research: 2h, Outline: 1.5h, Draft: 4h, Revision: 3h, Polish: 1.5h
      return 12;
    default:
      // Default for unknown IAs
      return 15;
  }
}

// ============================================
// IA SEQUENCING
// ============================================

/**
 * Order IAs based on optimal learning transfer and dependencies
 */
export function sequenceIAs(ias: IA[]): IA[] {
  const orderedIAs: IA[] = [];
  const remainingIAs = new Set(ias.map((ia) => ia.id));

  // First, add IAs in cluster order
  for (const cluster of IA_SEQUENCE_ORDER) {
    for (const iaId of cluster) {
      if (remainingIAs.has(iaId)) {
        const ia = ias.find((i) => i.id === iaId);
        if (ia) {
          orderedIAs.push(ia);
          remainingIAs.delete(iaId);
        }
      }
    }
  }

  // Add any remaining IAs not in clusters
  for (const iaId of remainingIAs) {
    const ia = ias.find((i) => i.id === iaId);
    if (ia) {
      orderedIAs.push(ia);
    }
  }

  return orderedIAs;
}

// ============================================
// MAIN SCHEDULING ALGORITHM
// ============================================

/**
 * Generate a valid schedule that respects ALL hard constraints.
 * Returns null if schedule is impossible.
 */
export function generateSchedule(
  ias: IA[],
  options: ScheduleOptions,
): ScheduleResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Step 1: Feasibility check
  const feasibility = checkScheduleFeasibility(ias, options);

  if (!feasibility.isFeasible) {
    return {
      success: false,
      feasibility,
      scheduledIAs: ias,
      weekAllocations: [],
      warnings,
      errors: [feasibility.message],
    };
  }

  // Step 2: Sequence IAs optimally
  const sequencedIAs = sequenceIAs(ias);

  // Step 3: Create week allocations
  const now = new Date();
  const deadline = parseISO(options.masterDeadline);
  const totalWeeks = Math.ceil(differenceInDays(deadline, now) / 7);

  const weekAllocations: WeekAllocation[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), i);
    weekAllocations.push({
      weekNumber: i + 1,
      weekStart: format(weekStart, "yyyy-MM-dd"),
      weekEnd: format(addDays(weekStart, 6), "yyyy-MM-dd"),
      allocatedHours: 0,
      remainingHours: options.weeklyHoursBudget,
      milestones: [],
      iasActiveThisWeek: new Set(),
    });
  }

  // Step 4: Allocate milestones to weeks
  const scheduledIAs: IA[] = [];
  let currentWeekIndex = 0;
  let currentDraftIA: string | null = null;

  for (const ia of sequencedIAs) {
    if (ia.milestones.length === 0) {
      // No milestones to schedule
      scheduledIAs.push(ia);
      continue;
    }

    const updatedMilestones: Milestone[] = [];

    for (const milestone of ia.milestones) {
      if (milestone.completed) {
        updatedMilestones.push(milestone);
        continue;
      }

      const phase = detectPhase(milestone.milestone_name);
      const hoursNeeded =
        milestone.estimated_hours * milestone.buffer_multiplier;
      const minSessionHours = MINIMUM_SESSION_HOURS[phase];

      // Check draft constraint
      if (phase === "draft") {
        if (currentDraftIA && currentDraftIA !== ia.id) {
          // Find when the current draft IA finishes
          const draftEndWeek = findDraftEndWeek(
            scheduledIAs,
            currentDraftIA,
            weekAllocations,
          );
          if (draftEndWeek > currentWeekIndex) {
            currentWeekIndex = draftEndWeek + 1;
            warnings.push(
              `Delayed ${ia.name} draft to avoid overlap with ${currentDraftIA}`,
            );
          }
        }
        currentDraftIA = ia.id;
      }

      // Allocate hours across weeks
      let remainingHours = hoursNeeded;
      let startWeek = currentWeekIndex;
      const milestoneWeeks: number[] = [];

      while (remainingHours > 0 && currentWeekIndex < weekAllocations.length) {
        const week = weekAllocations[currentWeekIndex];

        // Check max IAs per day constraint (simplified to per week)
        if (
          week.iasActiveThisWeek.size >= options.maxIAsPerDay &&
          !week.iasActiveThisWeek.has(ia.id)
        ) {
          // Can't add another IA to this week
          currentWeekIndex++;
          continue;
        }

        // Calculate hours we can allocate this week
        const hoursThisWeek = Math.min(remainingHours, week.remainingHours);

        // Check minimum session length
        if (
          hoursThisWeek < minSessionHours &&
          remainingHours >= minSessionHours
        ) {
          // Not enough room for a valid session, move to next week
          currentWeekIndex++;
          continue;
        }

        if (hoursThisWeek > 0) {
          week.allocatedHours += hoursThisWeek;
          week.remainingHours -= hoursThisWeek;
          week.milestones.push({
            milestoneId: milestone.id,
            iaId: ia.id,
            hours: hoursThisWeek,
          });
          week.iasActiveThisWeek.add(ia.id);
          milestoneWeeks.push(currentWeekIndex);
          remainingHours -= hoursThisWeek;
        }

        if (week.remainingHours <= 0) {
          currentWeekIndex++;
        }
      }

      if (remainingHours > 0) {
        errors.push(
          `Could not fully schedule ${milestone.milestone_name} for ${ia.name} - ${remainingHours.toFixed(1)} hours remaining`,
        );
      }

      // Calculate milestone dates based on allocated weeks
      const endWeek =
        milestoneWeeks.length > 0
          ? milestoneWeeks[milestoneWeeks.length - 1]
          : startWeek;
      const startDate =
        weekAllocations[startWeek]?.weekStart || format(now, "yyyy-MM-dd");
      const endDate =
        weekAllocations[endWeek]?.weekEnd || format(deadline, "yyyy-MM-dd");

      updatedMilestones.push({
        ...milestone,
        startDate,
        deadline: endDate,
        phase,
      });

      // Move to next position for next milestone
      if (phase === "draft" || phase === "revision") {
        // Draft and revision phases should not overlap with next milestone start
        currentWeekIndex = endWeek;
      }
    }

    // Reset draft tracking when IA is complete
    if (currentDraftIA === ia.id) {
      const lastPhase = detectPhase(
        updatedMilestones[updatedMilestones.length - 1]?.milestone_name || "",
      );
      if (lastPhase === "polish") {
        currentDraftIA = null;
      }
    }

    scheduledIAs.push({
      ...ia,
      milestones: updatedMilestones,
    });
  }

  // Validate final schedule
  const validationErrors = validateSchedule(
    scheduledIAs,
    weekAllocations,
    options,
  );
  errors.push(...validationErrors);

  return {
    success: errors.length === 0,
    feasibility,
    scheduledIAs,
    weekAllocations,
    warnings,
    errors,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Detect the phase of a milestone based on its name
 */
export function detectPhase(milestoneName: string): MilestonePhase {
  const name = milestoneName.toLowerCase();

  if (
    name.includes("research") ||
    name.includes("topic") ||
    name.includes("find") ||
    name.includes("article")
  ) {
    return "research";
  }
  if (
    name.includes("outline") ||
    name.includes("structure") ||
    name.includes("diagram") ||
    name.includes("key concept")
  ) {
    return "outline";
  }
  if (
    name.includes("draft") ||
    name.includes("first draft") ||
    name.includes("write")
  ) {
    return "draft";
  }
  if (
    name.includes("revis") ||
    name.includes("refine") ||
    name.includes("theory")
  ) {
    return "revision";
  }
  if (
    name.includes("polish") ||
    name.includes("final") ||
    name.includes("submission")
  ) {
    return "polish";
  }

  // Default to research if unclear
  return "research";
}

/**
 * Find when a specific IA's draft phase ends
 */
function findDraftEndWeek(
  scheduledIAs: IA[],
  iaId: string,
  weekAllocations: WeekAllocation[],
): number {
  const ia = scheduledIAs.find((i) => i.id === iaId);
  if (!ia) return 0;

  const draftMilestone = ia.milestones.find(
    (m) => detectPhase(m.milestone_name) === "draft" && !m.completed,
  );

  if (!draftMilestone) return 0;

  // Find which week this milestone ends in
  for (let i = weekAllocations.length - 1; i >= 0; i--) {
    const week = weekAllocations[i];
    if (week.milestones.some((m) => m.milestoneId === draftMilestone.id)) {
      return i;
    }
  }

  return 0;
}

/**
 * Validate the final schedule against all constraints
 */
function validateSchedule(
  ias: IA[],
  weekAllocations: WeekAllocation[],
  options: ScheduleOptions,
): string[] {
  const errors: string[] = [];

  // Check 1: No week exceeds budget
  for (const week of weekAllocations) {
    if (week.allocatedHours > options.weeklyHoursBudget + 0.1) {
      // Small tolerance for floating point
      errors.push(
        `Week ${week.weekNumber} exceeds budget: ${week.allocatedHours.toFixed(1)}h > ${options.weeklyHoursBudget}h`,
      );
    }
  }

  // Check 2: No draft overlaps
  const draftPeriods: { iaId: string; startWeek: number; endWeek: number }[] =
    [];

  for (const ia of ias) {
    const draftMilestone = ia.milestones.find(
      (m) => detectPhase(m.milestone_name) === "draft",
    );
    if (draftMilestone && !draftMilestone.completed) {
      // Find week range for this draft
      let startWeek = -1;
      let endWeek = -1;

      for (let i = 0; i < weekAllocations.length; i++) {
        const week = weekAllocations[i];
        if (week.milestones.some((m) => m.milestoneId === draftMilestone.id)) {
          if (startWeek === -1) startWeek = i;
          endWeek = i;
        }
      }

      if (startWeek !== -1) {
        draftPeriods.push({ iaId: ia.id, startWeek, endWeek });
      }
    }
  }

  // Check for overlaps
  for (let i = 0; i < draftPeriods.length; i++) {
    for (let j = i + 1; j < draftPeriods.length; j++) {
      const a = draftPeriods[i];
      const b = draftPeriods[j];

      if (a.startWeek <= b.endWeek && b.startWeek <= a.endWeek) {
        errors.push(
          `Draft phases overlap: ${a.iaId} (weeks ${a.startWeek + 1}-${a.endWeek + 1}) and ${b.iaId} (weeks ${b.startWeek + 1}-${b.endWeek + 1})`,
        );
      }
    }
  }

  // Check 3: Max IAs per week
  for (const week of weekAllocations) {
    if (week.iasActiveThisWeek.size > options.maxIAsPerDay) {
      errors.push(
        `Week ${week.weekNumber} has ${week.iasActiveThisWeek.size} IAs (max: ${options.maxIAsPerDay})`,
      );
    }
  }

  return errors;
}

// ============================================
// SCHEDULE SUMMARY FOR UI
// ============================================

export interface ScheduleSummary {
  totalWeeks: number;
  totalHours: number;
  iaOrder: { iaId: string; iaName: string; weeks: string }[];
  weeklyBreakdown: { week: number; hours: number; ias: string[] }[];
}

export function generateScheduleSummary(
  result: ScheduleResult,
): ScheduleSummary {
  const iaOrder: ScheduleSummary["iaOrder"] = [];

  for (const ia of result.scheduledIAs) {
    if (ia.milestones.length === 0) continue;

    const firstMilestone = ia.milestones.find((m) => !m.completed);
    const lastMilestone = [...ia.milestones]
      .reverse()
      .find((m) => !m.completed);

    if (firstMilestone && lastMilestone) {
      iaOrder.push({
        iaId: ia.id,
        iaName: ia.name,
        weeks: `${firstMilestone.startDate} to ${lastMilestone.deadline}`,
      });
    }
  }

  const weeklyBreakdown = result.weekAllocations
    .filter((w) => w.allocatedHours > 0)
    .map((w) => ({
      week: w.weekNumber,
      hours: w.allocatedHours,
      ias: Array.from(w.iasActiveThisWeek),
    }));

  return {
    totalWeeks: result.weekAllocations.filter((w) => w.allocatedHours > 0)
      .length,
    totalHours: result.weekAllocations.reduce(
      (sum, w) => sum + w.allocatedHours,
      0,
    ),
    iaOrder,
    weeklyBreakdown,
  };
}
