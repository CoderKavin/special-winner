import type {
  IA,
  Milestone,
  MilestonePhase,
  SubjectColor,
  LearnedMultipliers,
  AppState,
} from "../types";

// Minimum samples needed for high confidence
export const MIN_SAMPLES_FOR_CONFIDENCE = 3;

/**
 * Detect the phase of a milestone based on its name
 */
export function detectMilestonePhase(milestoneName: string): MilestonePhase {
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
    name.includes("plan")
  ) {
    return "outline";
  }
  if (
    name.includes("draft") ||
    name.includes("first") ||
    name.includes("write")
  ) {
    return "draft";
  }
  if (
    name.includes("revision") ||
    name.includes("refine") ||
    name.includes("review") ||
    name.includes("edit")
  ) {
    return "revision";
  }
  if (
    name.includes("polish") ||
    name.includes("final") ||
    name.includes("submission") ||
    name.includes("submit")
  ) {
    return "polish";
  }

  // Default to draft if unclear
  return "draft";
}

/**
 * Calculate the actual/estimated ratio for a completed milestone
 */
function calculateMilestoneRatio(milestone: Milestone): number | null {
  if (!milestone.completed || !milestone.actualHours) {
    return null;
  }

  const estimatedHours =
    milestone.estimated_hours * milestone.buffer_multiplier;
  if (estimatedHours <= 0) return null;

  return milestone.actualHours / estimatedHours;
}

/**
 * Calculate updated multipliers based on all completed milestones
 */
export function calculateLearnedMultipliers(ias: IA[]): LearnedMultipliers {
  const phaseData: Record<MilestonePhase, { total: number; count: number }> = {
    research: { total: 0, count: 0 },
    outline: { total: 0, count: 0 },
    draft: { total: 0, count: 0 },
    revision: { total: 0, count: 0 },
    polish: { total: 0, count: 0 },
  };

  const subjectData: Record<SubjectColor, { total: number; count: number }> = {
    math: { total: 0, count: 0 },
    physics: { total: 0, count: 0 },
    economics: { total: 0, count: 0 },
    english: { total: 0, count: 0 },
    history: { total: 0, count: 0 },
  };

  let overallTotal = 0;
  let overallCount = 0;

  // Collect data from all completed milestones
  for (const ia of ias) {
    for (const milestone of ia.milestones) {
      const ratio = calculateMilestoneRatio(milestone);
      if (ratio === null) continue;

      // Phase data
      const phase =
        milestone.phase || detectMilestonePhase(milestone.milestone_name);
      phaseData[phase].total += ratio;
      phaseData[phase].count += 1;

      // Subject data
      subjectData[ia.subjectColor].total += ratio;
      subjectData[ia.subjectColor].count += 1;

      // Overall data
      overallTotal += ratio;
      overallCount += 1;
    }
  }

  // Calculate multipliers
  const phases: LearnedMultipliers["phases"] =
    {} as LearnedMultipliers["phases"];
  for (const phase of Object.keys(phaseData) as MilestonePhase[]) {
    const data = phaseData[phase];
    phases[phase] = {
      multiplier: data.count > 0 ? data.total / data.count : 1.0,
      sampleCount: data.count,
    };
  }

  const subjects: LearnedMultipliers["subjects"] =
    {} as LearnedMultipliers["subjects"];
  for (const subject of Object.keys(subjectData) as SubjectColor[]) {
    const data = subjectData[subject];
    subjects[subject] = {
      multiplier: data.count > 0 ? data.total / data.count : 1.0,
      sampleCount: data.count,
    };
  }

  return {
    phases,
    subjects,
    overall: {
      multiplier: overallCount > 0 ? overallTotal / overallCount : 1.0,
      sampleCount: overallCount,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get the adjusted estimate for a milestone based on learned multipliers
 */
export function getAdjustedEstimate(
  milestone: Milestone,
  subjectColor: SubjectColor,
  multipliers: LearnedMultipliers,
): {
  originalHours: number;
  adjustedHours: number;
  appliedMultiplier: number;
  multiplierSource: string;
  confidence: "low" | "medium" | "high";
  sampleCount: number;
} {
  const originalHours = milestone.estimated_hours * milestone.buffer_multiplier;
  const phase =
    milestone.phase || detectMilestonePhase(milestone.milestone_name);

  const phaseMultiplier = multipliers.phases[phase];
  const subjectMultiplier = multipliers.subjects[subjectColor];
  const overallMultiplier = multipliers.overall;

  // Determine which multiplier to use based on sample count
  let appliedMultiplier = 1.0;
  let multiplierSource = "AI estimate (no historical data)";
  let sampleCount = 0;

  // Prefer phase-specific if we have enough samples
  if (phaseMultiplier.sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE) {
    appliedMultiplier = phaseMultiplier.multiplier;
    multiplierSource = `${phase} phase (${phaseMultiplier.sampleCount} samples)`;
    sampleCount = phaseMultiplier.sampleCount;
  }
  // Fall back to subject-specific
  else if (subjectMultiplier.sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE) {
    appliedMultiplier = subjectMultiplier.multiplier;
    multiplierSource = `${subjectColor} subject (${subjectMultiplier.sampleCount} samples)`;
    sampleCount = subjectMultiplier.sampleCount;
  }
  // Fall back to overall
  else if (overallMultiplier.sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE) {
    appliedMultiplier = overallMultiplier.multiplier;
    multiplierSource = `overall average (${overallMultiplier.sampleCount} samples)`;
    sampleCount = overallMultiplier.sampleCount;
  }
  // Low confidence - use weighted blend
  else if (overallMultiplier.sampleCount > 0) {
    // Blend between 1.0 and learned multiplier based on sample count
    const blendWeight =
      overallMultiplier.sampleCount / MIN_SAMPLES_FOR_CONFIDENCE;
    appliedMultiplier =
      1.0 + (overallMultiplier.multiplier - 1.0) * blendWeight;
    multiplierSource = `preliminary (${overallMultiplier.sampleCount}/${MIN_SAMPLES_FOR_CONFIDENCE} samples needed)`;
    sampleCount = overallMultiplier.sampleCount;
  }

  // Determine confidence level
  let confidence: "low" | "medium" | "high" = "low";
  if (sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE * 2) {
    confidence = "high";
  } else if (sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE) {
    confidence = "medium";
  }

  return {
    originalHours,
    adjustedHours: originalHours * appliedMultiplier,
    appliedMultiplier,
    multiplierSource,
    confidence,
    sampleCount,
  };
}

/**
 * Get a human-readable explanation of the multiplier
 */
export function getMultiplierExplanation(multiplier: number): string {
  if (multiplier < 0.8) {
    return `You work ${Math.round((1 - multiplier) * 100)}% faster than estimated`;
  } else if (multiplier > 1.2) {
    return `You take ${Math.round((multiplier - 1) * 100)}% longer than estimated`;
  } else {
    return "You work close to the estimated pace";
  }
}

/**
 * Get statistics about logged work for the current week
 */
export function getWeeklyStats(state: AppState): {
  plannedHours: number;
  loggedHours: number;
  loggedToday: boolean;
  sessionsThisWeek: number;
} {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  let loggedMinutes = 0;
  let loggedToday = false;
  let sessionsThisWeek = 0;

  for (const session of state.allWorkSessions) {
    const sessionDate = new Date(session.startTime);
    if (sessionDate >= startOfWeek) {
      loggedMinutes += session.duration;
      sessionsThisWeek += 1;

      if (sessionDate >= startOfToday) {
        loggedToday = true;
      }
    }
  }

  return {
    plannedHours: state.weeklyHoursBudget,
    loggedHours: loggedMinutes / 60,
    loggedToday,
    sessionsThisWeek,
  };
}

/**
 * Calculate how many completed milestones have time data
 */
export function getCompletedMilestonesWithData(ias: IA[]): {
  total: number;
  withData: number;
} {
  let total = 0;
  let withData = 0;

  for (const ia of ias) {
    for (const milestone of ia.milestones) {
      if (milestone.completed) {
        total += 1;
        if (milestone.actualHours && milestone.actualHours > 0) {
          withData += 1;
        }
      }
    }
  }

  return { total, withData };
}
