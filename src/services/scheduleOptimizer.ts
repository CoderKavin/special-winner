/**
 * SCHEDULE OPTIMIZER SERVICE
 *
 * Provides actionable fixes for schedule warnings.
 * Each warning type has specific fix options that can be applied.
 */

import type { AppState, IA } from "../types";
import {
  addWeeks,
  addDays,
  format,
  parseISO,
  differenceInDays,
} from "date-fns";

// ============================================
// TYPES
// ============================================

export type WarningType =
  | "deadline_impossible"
  | "weekly_budget_exceeded"
  | "context_switching"
  | "draft_overlap"
  | "schedule_late";

export type FixType =
  | "extend_deadline"
  | "increase_hours"
  | "spread_work"
  | "consolidate_ias"
  | "sequence_drafts"
  | "reduce_scope"
  | "compress_schedule";

export interface ScheduleWarning {
  id: string;
  type: WarningType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  impact: string;
  fixes: ScheduleFix[];
  affectedWeeks?: number[];
  affectedIAs?: string[];
  hoursShort?: number;
  daysLate?: number;
}

export interface ScheduleFix {
  id: string;
  type: FixType;
  label: string;
  description: string;
  impact: string;
  recommended?: boolean;
  risk?: "low" | "medium" | "high";
  action: () => Partial<AppState>;
}

export interface OptimizationResult {
  success: boolean;
  changes: string[];
  newDeadline?: string;
  newWeeklyHours?: number;
  hoursSaved?: number;
}

// ============================================
// ANALYZE SCHEDULE FOR WARNINGS
// ============================================

export function analyzeScheduleWarnings(state: AppState): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  // Check deadline feasibility
  const deadlineWarning = checkDeadlineFeasibility(state);
  if (deadlineWarning) warnings.push(deadlineWarning);

  // Check weekly budget violations
  const budgetWarnings = checkWeeklyBudget(state);
  warnings.push(...budgetWarnings);

  // Check context switching
  const contextWarning = checkContextSwitching(state);
  if (contextWarning) warnings.push(contextWarning);

  // Check draft overlaps
  const draftWarning = checkDraftOverlaps(state);
  if (draftWarning) warnings.push(draftWarning);

  return warnings;
}

// ============================================
// DEADLINE FEASIBILITY CHECK
// ============================================

function checkDeadlineFeasibility(state: AppState): ScheduleWarning | null {
  const now = new Date();
  const deadline = parseISO(state.masterDeadline);
  const daysUntilDeadline = differenceInDays(deadline, now);
  const weeksAvailable = Math.max(0, daysUntilDeadline / 7);
  const availableHours = weeksAvailable * state.weeklyHoursBudget;

  // Calculate total hours needed
  let totalHoursNeeded = 0;
  for (const ia of state.ias) {
    if (ia.milestones.length > 0) {
      for (const m of ia.milestones) {
        if (!m.completed) {
          totalHoursNeeded += m.estimated_hours * m.buffer_multiplier;
        }
      }
    } else {
      // Estimate for IAs without milestones
      totalHoursNeeded += estimateIAHours(ia) * 1.2;
    }
  }

  if (totalHoursNeeded <= availableHours) {
    return null;
  }

  const hoursShort = totalHoursNeeded - availableHours;
  const weeksNeeded = Math.ceil(totalHoursNeeded / state.weeklyHoursBudget);
  const suggestedDeadline = format(
    addWeeks(now, weeksNeeded + 1),
    "yyyy-MM-dd",
  );
  const suggestedHours = Math.ceil(totalHoursNeeded / weeksAvailable);

  return {
    id: "deadline-feasibility",
    type: "deadline_impossible",
    severity: "critical",
    title: "Schedule exceeds available time",
    description: `You need ${totalHoursNeeded.toFixed(0)} hours but only have ${availableHours.toFixed(0)} hours available.`,
    impact: `${hoursShort.toFixed(0)} hours short`,
    hoursShort,
    fixes: [
      {
        id: "extend-deadline",
        type: "extend_deadline",
        label: `Extend to ${format(parseISO(suggestedDeadline), "MMM d, yyyy")}`,
        description: `Move deadline to allow ${weeksNeeded} weeks of work`,
        impact: `Adds ${weeksNeeded - Math.floor(weeksAvailable)} weeks`,
        recommended: true,
        risk: "low",
        action: () => ({ masterDeadline: suggestedDeadline }),
      },
      {
        id: "increase-hours",
        type: "increase_hours",
        label: `Increase to ${suggestedHours}h/week`,
        description: `Work more hours each week to meet current deadline`,
        impact: `+${suggestedHours - state.weeklyHoursBudget}h per week`,
        risk: suggestedHours <= 12 ? "medium" : "high",
        action: () => ({ weeklyHoursBudget: suggestedHours }),
      },
    ],
  };
}

// ============================================
// WEEKLY BUDGET CHECK
// ============================================

interface WeekData {
  weekStart: string;
  hours: number;
  milestones: { iaId: string; milestoneId: string; hours: number }[];
}

function checkWeeklyBudget(state: AppState): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const weeklyAllocations = calculateWeeklyAllocations(state);

  const overBudgetWeeks = weeklyAllocations.filter(
    (w) => w.hours > state.weeklyHoursBudget,
  );

  if (overBudgetWeeks.length === 0) return [];

  // Group consecutive weeks
  const totalOverage = overBudgetWeeks.reduce(
    (sum, w) => sum + (w.hours - state.weeklyHoursBudget),
    0,
  );

  const fixes: ScheduleFix[] = [
    {
      id: "spread-work",
      type: "spread_work",
      label: "Auto-balance weeks",
      description: "Spread overloaded work across adjacent weeks",
      impact: `Balances ${overBudgetWeeks.length} weeks`,
      recommended: true,
      risk: "low",
      action: () => spreadWorkAcrossWeeks(state, overBudgetWeeks),
    },
    {
      id: "increase-budget",
      type: "increase_hours",
      label: `Increase to ${Math.ceil(Math.max(...weeklyAllocations.map((w) => w.hours)))}h/week`,
      description: "Increase weekly budget to accommodate peak weeks",
      impact: "No schedule changes needed",
      risk: "medium",
      action: () => ({
        weeklyHoursBudget: Math.ceil(
          Math.max(...weeklyAllocations.map((w) => w.hours)),
        ),
      }),
    },
  ];

  warnings.push({
    id: "weekly-budget",
    type: "weekly_budget_exceeded",
    severity: overBudgetWeeks.length > 2 ? "critical" : "warning",
    title: `${overBudgetWeeks.length} week${overBudgetWeeks.length > 1 ? "s" : ""} over budget`,
    description: `Some weeks have more work scheduled than your ${state.weeklyHoursBudget}h/week budget`,
    impact: `${totalOverage.toFixed(1)}h over budget total`,
    affectedWeeks: overBudgetWeeks.map((w) =>
      Math.floor(differenceInDays(parseISO(w.weekStart), new Date()) / 7),
    ),
    fixes,
  });

  return warnings;
}

function calculateWeeklyAllocations(state: AppState): WeekData[] {
  const weekMap = new Map<string, WeekData>();

  for (const ia of state.ias) {
    for (const milestone of ia.milestones) {
      if (milestone.completed || !milestone.startDate || !milestone.deadline)
        continue;

      const start = parseISO(milestone.startDate);
      const end = parseISO(milestone.deadline);
      const totalDays = Math.max(1, differenceInDays(end, start));
      const totalHours =
        milestone.estimated_hours * milestone.buffer_multiplier;
      const hoursPerDay = totalHours / totalDays;

      // Distribute hours across weeks
      for (let d = 0; d <= totalDays; d++) {
        const currentDate = addDays(start, d);
        const weekKey = format(currentDate, "yyyy-'W'ww");

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {
            weekStart: format(currentDate, "yyyy-MM-dd"),
            hours: 0,
            milestones: [],
          });
        }

        const week = weekMap.get(weekKey)!;
        week.hours += hoursPerDay;

        const existing = week.milestones.find(
          (m) => m.milestoneId === milestone.id,
        );
        if (existing) {
          existing.hours += hoursPerDay;
        } else {
          week.milestones.push({
            iaId: ia.id,
            milestoneId: milestone.id,
            hours: hoursPerDay,
          });
        }
      }
    }
  }

  return Array.from(weekMap.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
}

function spreadWorkAcrossWeeks(
  _state: AppState,
  _overBudgetWeeks: WeekData[],
): Partial<AppState> {
  // This would need to modify milestone dates
  // For now, return unchanged - the UI will handle manual adjustments
  // TODO: Implement actual date spreading logic
  return {};
}

// ============================================
// CONTEXT SWITCHING CHECK
// ============================================

function checkContextSwitching(state: AppState): ScheduleWarning | null {
  const dailyIAs = new Map<string, Set<string>>();

  for (const ia of state.ias) {
    for (const milestone of ia.milestones) {
      if (milestone.completed || !milestone.startDate || !milestone.deadline)
        continue;

      const start = parseISO(milestone.startDate);
      const end = parseISO(milestone.deadline);
      const days = differenceInDays(end, start);

      for (let d = 0; d <= days; d++) {
        const dateKey = format(addDays(start, d), "yyyy-MM-dd");
        if (!dailyIAs.has(dateKey)) {
          dailyIAs.set(dateKey, new Set());
        }
        dailyIAs.get(dateKey)!.add(ia.id);
      }
    }
  }

  // Count days with more than 2 IAs
  let problematicDays = 0;
  let totalSwitches = 0;

  for (const [, ias] of dailyIAs) {
    if (ias.size > 2) {
      problematicDays++;
      totalSwitches += ias.size - 2; // Each extra IA is a context switch
    }
  }

  if (problematicDays === 0) return null;

  // Estimate hours lost (roughly 30 min per switch)
  const hoursLost = totalSwitches * 0.5;

  return {
    id: "context-switching",
    type: "context_switching",
    severity: hoursLost > 10 ? "critical" : "warning",
    title: `${hoursLost.toFixed(0)}h lost to context switching`,
    description: `${problematicDays} days have more than 2 IAs scheduled`,
    impact: `~${hoursLost.toFixed(1)} hours of productivity lost`,
    fixes: [
      {
        id: "consolidate",
        type: "consolidate_ias",
        label: "Consolidate work",
        description: "Limit each day to max 2 IAs",
        impact: `Saves ~${hoursLost.toFixed(0)}h`,
        recommended: true,
        risk: "low",
        action: () => consolidateIAs(state),
      },
      {
        id: "sequential",
        type: "sequence_drafts",
        label: "Sequential scheduling",
        description: "Work on one IA at a time",
        impact: "Maximum focus, longer timeline",
        risk: "medium",
        action: () => sequentialSchedule(state),
      },
    ],
  };
}

function consolidateIAs(_state: AppState): Partial<AppState> {
  // TODO: Implement consolidation logic
  return {};
}

function sequentialSchedule(_state: AppState): Partial<AppState> {
  // TODO: Implement sequential scheduling
  return {};
}

// ============================================
// DRAFT OVERLAP CHECK
// ============================================

function checkDraftOverlaps(state: AppState): ScheduleWarning | null {
  const drafts: { iaId: string; iaName: string; start: Date; end: Date }[] = [];

  for (const ia of state.ias) {
    for (const milestone of ia.milestones) {
      if (milestone.completed) continue;

      const name = milestone.milestone_name.toLowerCase();
      if (name.includes("draft") || name.includes("write")) {
        if (milestone.startDate && milestone.deadline) {
          drafts.push({
            iaId: ia.id,
            iaName: ia.name,
            start: parseISO(milestone.startDate),
            end: parseISO(milestone.deadline),
          });
        }
      }
    }
  }

  // Find overlaps
  const overlaps: { ia1: string; ia2: string }[] = [];
  for (let i = 0; i < drafts.length; i++) {
    for (let j = i + 1; j < drafts.length; j++) {
      const a = drafts[i];
      const b = drafts[j];

      if (a.start <= b.end && b.start <= a.end) {
        overlaps.push({ ia1: a.iaName, ia2: b.iaName });
      }
    }
  }

  if (overlaps.length === 0) return null;

  return {
    id: "draft-overlap",
    type: "draft_overlap",
    severity: overlaps.length > 2 ? "critical" : "warning",
    title: `${overlaps.length} draft phase${overlaps.length > 1 ? "s" : ""} overlap`,
    description:
      "Writing multiple drafts simultaneously reduces quality and focus",
    impact: "Reduced draft quality, mental fatigue",
    affectedIAs: [...new Set(overlaps.flatMap((o) => [o.ia1, o.ia2]))],
    fixes: [
      {
        id: "sequence-drafts",
        type: "sequence_drafts",
        label: "Sequence drafts",
        description: "Schedule one draft at a time",
        impact: "Better focus, may extend timeline",
        recommended: true,
        risk: "low",
        action: () => sequenceDrafts(state),
      },
    ],
  };
}

function sequenceDrafts(_state: AppState): Partial<AppState> {
  // TODO: Implement draft sequencing
  return {};
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function estimateIAHours(ia: IA): number {
  const isEconomics = ia.id.startsWith("econ");
  if (isEconomics) return 7;

  switch (ia.id) {
    case "math":
      return 19;
    case "physics":
      return 18;
    case "history":
      return 15;
    case "english":
      return 12;
    default:
      return 15;
  }
}

// ============================================
// APPLY FIX
// ============================================

export function applyFix(
  _state: AppState,
  fix: ScheduleFix,
): { newState: Partial<AppState>; result: OptimizationResult } {
  const changes = fix.action();

  const result: OptimizationResult = {
    success: Object.keys(changes).length > 0,
    changes: [],
  };

  if (changes.masterDeadline) {
    result.newDeadline = changes.masterDeadline;
    result.changes.push(
      `Deadline extended to ${format(parseISO(changes.masterDeadline), "MMM d, yyyy")}`,
    );
  }

  if (changes.weeklyHoursBudget) {
    result.newWeeklyHours = changes.weeklyHoursBudget;
    result.changes.push(
      `Weekly hours increased to ${changes.weeklyHoursBudget}h`,
    );
  }

  return { newState: changes, result };
}

// ============================================
// AUTO-OPTIMIZE ALL
// ============================================

export interface OptimizationScenario {
  id: string;
  name: string;
  description: string;
  changes: Partial<AppState>;
  tradeoffs: string[];
  recommended?: boolean;
}

export function generateOptimizationScenarios(
  _state: AppState,
  warnings: ScheduleWarning[],
): OptimizationScenario[] {
  const scenarios: OptimizationScenario[] = [];

  // Find deadline and hours issues
  const deadlineWarning = warnings.find(
    (w) => w.type === "deadline_impossible",
  );

  if (deadlineWarning) {
    const extendFix = deadlineWarning.fixes.find(
      (f) => f.type === "extend_deadline",
    );
    const hoursFix = deadlineWarning.fixes.find(
      (f) => f.type === "increase_hours",
    );

    if (extendFix) {
      scenarios.push({
        id: "extend-deadline",
        name: "Extend Deadline",
        description: extendFix.description,
        changes: extendFix.action(),
        tradeoffs: ["Later completion date", "No changes to weekly workload"],
        recommended: true,
      });
    }

    if (hoursFix) {
      scenarios.push({
        id: "increase-hours",
        name: "Increase Weekly Hours",
        description: hoursFix.description,
        changes: hoursFix.action(),
        tradeoffs: ["More work per week", "Keep current deadline"],
      });
    }
  }

  return scenarios;
}
