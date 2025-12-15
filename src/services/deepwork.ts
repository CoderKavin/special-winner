import {
  format,
  parseISO,
  differenceInDays,
  addDays,
  startOfDay,
  endOfDay,
} from "date-fns";
import type {
  IA,
  Milestone,
  MilestonePhase,
  DeepWorkSettings,
  ScheduledSession,
  ContextSwitch,
  ScheduleViolation,
  DailyScheduleAnalysis,
  AppState,
} from "../types";
import { DEFAULT_DEEP_WORK_SETTINGS } from "../types";
import { detectMilestonePhase } from "./learning";

/**
 * Check if a phase requires deep work (extended uninterrupted focus)
 */
export function isDeepWorkPhase(phase: MilestonePhase): boolean {
  return ["research", "outline", "draft", "revision"].includes(phase);
}

/**
 * Get the minimum session hours for a phase
 */
export function getMinimumSessionHours(
  phase: MilestonePhase,
  settings: DeepWorkSettings = DEFAULT_DEEP_WORK_SETTINGS,
): number {
  return settings.minimumSessionHours[phase];
}

/**
 * Calculate the total time needed for a milestone including buffers
 */
export function getTotalTimeWithBuffers(
  milestone: Milestone,
  settings: DeepWorkSettings = DEFAULT_DEEP_WORK_SETTINGS,
): {
  coreHours: number;
  prepMinutes: number;
  decompressMinutes: number;
  totalMinutes: number;
} {
  const phase =
    milestone.phase || detectMilestonePhase(milestone.milestone_name);
  const coreHours = milestone.estimated_hours * milestone.buffer_multiplier;
  const isDeepWork = isDeepWorkPhase(phase);

  const prepMinutes = isDeepWork ? settings.prepBufferMinutes : 0;
  const decompressMinutes = isDeepWork ? settings.decompressBufferMinutes : 0;

  return {
    coreHours,
    prepMinutes,
    decompressMinutes,
    totalMinutes: coreHours * 60 + prepMinutes + decompressMinutes,
  };
}

/**
 * Detect minimum session violations
 */
export function detectMinimumSessionViolations(
  milestones: Milestone[],
  settings: DeepWorkSettings = DEFAULT_DEEP_WORK_SETTINGS,
): ScheduleViolation[] {
  const violations: ScheduleViolation[] = [];

  for (const milestone of milestones) {
    if (milestone.completed) continue;

    const phase =
      milestone.phase || detectMilestonePhase(milestone.milestone_name);
    const minimumHours = settings.minimumSessionHours[phase];
    const scheduledHours =
      milestone.estimated_hours * milestone.buffer_multiplier;

    // Check if the scheduled duration is less than minimum
    // This is a simplified check - in reality we'd check against scheduled calendar blocks
    if (scheduledHours < minimumHours && isDeepWorkPhase(phase)) {
      const shortfallHours = minimumHours - scheduledHours;

      violations.push({
        id: `min-session-${milestone.id}`,
        type: "minimum_session",
        severity: phase === "draft" ? "error" : "warning",
        message: `"${milestone.milestone_name}" is scheduled for ${scheduledHours.toFixed(1)}h but ${phase} work requires minimum ${minimumHours}h blocks for productive focus.`,
        affectedMilestoneIds: [milestone.id],
        affectedDate: milestone.startDate,
        productivityPenaltyPercent: Math.round(
          (shortfallHours / minimumHours) * 30,
        ),
        autoFix: {
          description: `Extend session to ${minimumHours}h minimum block`,
          action: "extend",
          suggestedChanges: [
            {
              milestoneId: milestone.id,
              field: "scheduledTime",
              newValue: `${minimumHours}`,
            },
          ],
        },
      });
    }
  }

  return violations;
}

/**
 * Analyze a day's schedule for context switches and violations
 */
export function analyzeDailySchedule(
  date: string,
  milestones: Milestone[],
  ias: IA[],
  settings: DeepWorkSettings = DEFAULT_DEEP_WORK_SETTINGS,
): DailyScheduleAnalysis {
  const dateObj = parseISO(date);
  const dayMilestones = milestones.filter((m) => {
    if (m.completed) return false;
    const start = parseISO(m.startDate);
    const end = parseISO(m.deadline);
    return dateObj >= startOfDay(start) && dateObj <= endOfDay(end);
  });

  // Group by IA
  const iaGroups = new Map<string, Milestone[]>();
  for (const m of dayMilestones) {
    const existing = iaGroups.get(m.iaId) || [];
    existing.push(m);
    iaGroups.set(m.iaId, existing);
  }

  const iaCount = iaGroups.size;
  const sessions: ScheduledSession[] = [];
  const contextSwitches: ContextSwitch[] = [];
  const violations: ScheduleViolation[] = [];

  // Create sessions from milestones
  let currentHour = 9; // Start at 9am
  const iaOrder = Array.from(iaGroups.keys());

  for (let i = 0; i < iaOrder.length; i++) {
    const iaId = iaOrder[i];
    const iaMilestones = iaGroups.get(iaId) || [];

    for (const milestone of iaMilestones) {
      const phase =
        milestone.phase || detectMilestonePhase(milestone.milestone_name);
      const hours = milestone.estimated_hours * milestone.buffer_multiplier;
      const isDeepWork = isDeepWorkPhase(phase);

      sessions.push({
        id: `session-${milestone.id}-${date}`,
        milestoneId: milestone.id,
        iaId: milestone.iaId,
        date,
        startTime: `${currentHour.toString().padStart(2, "0")}:00`,
        endTime: `${(currentHour + hours).toString().padStart(2, "0")}:00`,
        durationHours: hours,
        phase,
        isDeepWork,
        includesPrep: isDeepWork,
        includesDecompress: isDeepWork,
      });

      currentHour += hours + 0.5; // 30 min break between sessions
    }

    // Detect context switch to next IA
    if (i < iaOrder.length - 1) {
      const nextIaId = iaOrder[i + 1];
      contextSwitches.push({
        date,
        fromIaId: iaId,
        toIaId: nextIaId,
        penaltyMinutes: settings.contextSwitchPenaltyMinutes,
        isSameDay: true,
        hasGapBetween: false,
      });
    }
  }

  // Calculate total hours
  const totalHours = sessions.reduce((sum, s) => sum + s.durationHours, 0);
  const switchPenaltyHours =
    (contextSwitches.length * settings.contextSwitchPenaltyMinutes) / 60;
  const effectiveHours = Math.max(0, totalHours - switchPenaltyHours);

  // Check for max IAs per day violation
  if (iaCount > settings.maxIAsPerDay) {
    violations.push({
      id: `max-ias-${date}`,
      type: "max_ias_per_day",
      severity: "warning",
      message: `${iaCount} different IAs scheduled on ${format(dateObj, "MMM d")} (max recommended: ${settings.maxIAsPerDay}). This causes significant context switching overhead.`,
      affectedMilestoneIds: dayMilestones.map((m) => m.id),
      affectedDate: date,
      productivityPenaltyPercent: Math.round(
        (iaCount - settings.maxIAsPerDay) * 15,
      ),
      autoFix: {
        description: `Move ${iaCount - settings.maxIAsPerDay} IA(s) to another day`,
        action: "move",
        suggestedChanges: [],
      },
    });
  }

  // Check for context switch violations (same IA split with other work between)
  const iaSessionCounts = new Map<string, number>();
  for (const session of sessions) {
    iaSessionCounts.set(
      session.iaId,
      (iaSessionCounts.get(session.iaId) || 0) + 1,
    );
  }

  for (const [iaId, count] of iaSessionCounts) {
    if (count > 1) {
      // Check if there's other work between sessions of the same IA
      const iaSessions = sessions.filter((s) => s.iaId === iaId);
      const otherSessions = sessions.filter((s) => s.iaId !== iaId);

      for (let i = 0; i < iaSessions.length - 1; i++) {
        const current = iaSessions[i];
        const next = iaSessions[i + 1];

        // Check if there's other work between these sessions
        const hasGapWork = otherSessions.some((s) => {
          const sStart = parseInt(s.startTime.split(":")[0]);
          const currentEnd = parseInt(current.endTime.split(":")[0]);
          const nextStart = parseInt(next.startTime.split(":")[0]);
          return sStart >= currentEnd && sStart < nextStart;
        });

        if (hasGapWork) {
          const ia = ias.find((i) => i.id === iaId);
          violations.push({
            id: `fragmented-${iaId}-${date}`,
            type: "fragmented_work",
            severity: "warning",
            message: `${ia?.name || "IA"} work is split across the day with other work in between. This fragments focus and reduces productivity.`,
            affectedMilestoneIds: [current.milestoneId, next.milestoneId],
            affectedDate: date,
            productivityPenaltyPercent: 20,
            autoFix: {
              description: "Consolidate into continuous block",
              action: "consolidate",
              suggestedChanges: [],
            },
          });
        }
      }
    }
  }

  // Calculate productivity score (100 = perfect, 0 = terrible)
  let productivityScore = 100;

  // Deduct for context switches
  productivityScore -= contextSwitches.length * 10;

  // Deduct for violations
  for (const violation of violations) {
    productivityScore -= violation.productivityPenaltyPercent || 10;
  }

  // Deduct for too many IAs
  if (iaCount > settings.maxIAsPerDay) {
    productivityScore -= (iaCount - settings.maxIAsPerDay) * 15;
  }

  productivityScore = Math.max(0, Math.min(100, productivityScore));

  return {
    date,
    sessions,
    iaCount,
    totalHours,
    effectiveHours,
    contextSwitches,
    violations,
    productivityScore,
  };
}

/**
 * Analyze the entire schedule for violations
 */
export function analyzeFullSchedule(state: AppState): {
  violations: ScheduleViolation[];
  dailyAnalyses: DailyScheduleAnalysis[];
  overallProductivityScore: number;
  totalContextSwitches: number;
  totalPenaltyHours: number;
} {
  const { ias, deepWorkSettings } = state;
  const settings = deepWorkSettings || DEFAULT_DEEP_WORK_SETTINGS;
  const allMilestones = ias.flatMap((ia) => ia.milestones);
  const violations: ScheduleViolation[] = [];
  const dailyAnalyses: DailyScheduleAnalysis[] = [];

  // Get date range from milestones
  const dates = new Set<string>();
  for (const m of allMilestones) {
    if (m.completed) continue;
    const start = parseISO(m.startDate);
    const end = parseISO(m.deadline);
    const dayCount = differenceInDays(end, start) + 1;

    for (let i = 0; i < dayCount; i++) {
      dates.add(format(addDays(start, i), "yyyy-MM-dd"));
    }
  }

  // Analyze each day
  for (const date of Array.from(dates).sort()) {
    const analysis = analyzeDailySchedule(date, allMilestones, ias, settings);
    dailyAnalyses.push(analysis);
    violations.push(...analysis.violations);
  }

  // Add minimum session violations
  const minSessionViolations = detectMinimumSessionViolations(
    allMilestones,
    settings,
  );
  violations.push(...minSessionViolations);

  // Detect fragmented milestones across days
  const fragmentedViolations = detectFragmentedMilestones(allMilestones);
  violations.push(...fragmentedViolations);

  // Calculate overall stats
  const totalContextSwitches = dailyAnalyses.reduce(
    (sum, d) => sum + d.contextSwitches.length,
    0,
  );
  const totalPenaltyHours =
    (totalContextSwitches * settings.contextSwitchPenaltyMinutes) / 60;

  const overallProductivityScore =
    dailyAnalyses.length > 0
      ? Math.round(
          dailyAnalyses.reduce((sum, d) => sum + d.productivityScore, 0) /
            dailyAnalyses.length,
        )
      : 100;

  return {
    violations,
    dailyAnalyses,
    overallProductivityScore,
    totalContextSwitches,
    totalPenaltyHours,
  };
}

/**
 * Detect milestones that are fragmented across multiple days
 */
function detectFragmentedMilestones(
  milestones: Milestone[],
): ScheduleViolation[] {
  const violations: ScheduleViolation[] = [];

  for (const milestone of milestones) {
    if (milestone.completed) continue;

    const phase =
      milestone.phase || detectMilestonePhase(milestone.milestone_name);
    const start = parseISO(milestone.startDate);
    const end = parseISO(milestone.deadline);
    const daySpan = differenceInDays(end, start) + 1;
    const hours = milestone.estimated_hours * milestone.buffer_multiplier;

    // If a milestone spans multiple days but could fit in one day's deep work session
    if (daySpan > 1 && hours <= 8 && isDeepWorkPhase(phase)) {
      violations.push({
        id: `fragmented-milestone-${milestone.id}`,
        type: "fragmented_work",
        severity: "warning",
        message: `"${milestone.milestone_name}" is spread across ${daySpan} days but only requires ${hours.toFixed(1)}h. Consider consolidating into a single focused session.`,
        affectedMilestoneIds: [milestone.id],
        productivityPenaltyPercent: 15,
        autoFix: {
          description: `Schedule as single ${hours.toFixed(1)}h block`,
          action: "consolidate",
          suggestedChanges: [
            {
              milestoneId: milestone.id,
              field: "deadline",
              newValue: milestone.startDate, // Same day
            },
          ],
        },
      });
    }
  }

  return violations;
}

/**
 * Get suggestions for improving schedule efficiency
 */
export function getScheduleImprovementSuggestions(
  violations: ScheduleViolation[],
): Array<{
  title: string;
  description: string;
  impact: string;
  action: () => void;
}> {
  const suggestions: Array<{
    title: string;
    description: string;
    impact: string;
    action: () => void;
  }> = [];

  // Group violations by type
  const byType = new Map<string, ScheduleViolation[]>();
  for (const v of violations) {
    const existing = byType.get(v.type) || [];
    existing.push(v);
    byType.set(v.type, existing);
  }

  // Suggest fixes for minimum session violations
  const minSessionViolations = byType.get("minimum_session") || [];
  if (minSessionViolations.length > 0) {
    suggestions.push({
      title: "Extend Short Sessions",
      description: `${minSessionViolations.length} session(s) are shorter than recommended for deep work.`,
      impact: `+${minSessionViolations.length * 10}% productivity`,
      action: () => {
        // Would trigger auto-fix
      },
    });
  }

  // Suggest fixes for context switches
  const contextSwitchViolations = byType.get("max_ias_per_day") || [];
  if (contextSwitchViolations.length > 0) {
    suggestions.push({
      title: "Reduce Daily IA Count",
      description: `${contextSwitchViolations.length} day(s) have too many different IAs scheduled.`,
      impact: `+${contextSwitchViolations.length * 15}% productivity`,
      action: () => {
        // Would trigger auto-fix
      },
    });
  }

  // Suggest consolidation for fragmented work
  const fragmentedViolations = byType.get("fragmented_work") || [];
  if (fragmentedViolations.length > 0) {
    suggestions.push({
      title: "Consolidate Fragmented Work",
      description: `${fragmentedViolations.length} work block(s) could be consolidated for better focus.`,
      impact: `+${fragmentedViolations.length * 15}% productivity`,
      action: () => {
        // Would trigger auto-fix
      },
    });
  }

  return suggestions;
}

/**
 * Check if a time slot is within deep work windows
 */
export function isWithinDeepWorkWindow(
  startHour: number,
  endHour: number,
  settings: DeepWorkSettings,
): boolean {
  if (!settings.enforceDeepWorkWindows) return true;

  return settings.deepWorkWindows.some(
    (window) => startHour >= window.start && endHour <= window.end,
  );
}

/**
 * Format a violation for display
 */
export function formatViolation(violation: ScheduleViolation): {
  icon: string;
  color: string;
  title: string;
  description: string;
} {
  switch (violation.type) {
    case "minimum_session":
      return {
        icon: "clock",
        color: violation.severity === "error" ? "red" : "yellow",
        title: "Session Too Short",
        description: violation.message,
      };
    case "context_switch":
      return {
        icon: "shuffle",
        color: "yellow",
        title: "Context Switch Detected",
        description: violation.message,
      };
    case "max_ias_per_day":
      return {
        icon: "layers",
        color: "orange",
        title: "Too Many IAs",
        description: violation.message,
      };
    case "fragmented_work":
      return {
        icon: "scissors",
        color: "yellow",
        title: "Fragmented Work",
        description: violation.message,
      };
    case "deep_work_conflict":
      return {
        icon: "alert-triangle",
        color: "red",
        title: "Deep Work Conflict",
        description: violation.message,
      };
    default:
      return {
        icon: "alert-circle",
        color: "gray",
        title: "Schedule Issue",
        description: violation.message,
      };
  }
}

/**
 * Calculate effective hours after context switch penalties
 */
export function calculateEffectiveHours(
  scheduledHours: number,
  contextSwitchCount: number,
  settings: DeepWorkSettings = DEFAULT_DEEP_WORK_SETTINGS,
): {
  scheduledHours: number;
  penaltyHours: number;
  effectiveHours: number;
  efficiencyPercent: number;
} {
  const penaltyHours =
    (contextSwitchCount * settings.contextSwitchPenaltyMinutes) / 60;
  const effectiveHours = Math.max(0, scheduledHours - penaltyHours);
  const efficiencyPercent =
    scheduledHours > 0
      ? Math.round((effectiveHours / scheduledHours) * 100)
      : 100;

  return {
    scheduledHours,
    penaltyHours,
    effectiveHours,
    efficiencyPercent,
  };
}
