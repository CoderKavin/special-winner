import { format, parseISO, isWeekend, startOfWeek, addDays } from "date-fns";
import type {
  EnergyLevel,
  CognitiveLoad,
  EnergyWindow,
  DayEnergyPattern,
  EnergyProfile,
  EnergySettings,
  EnergyMismatch,
  WeeklyEnergyAnalysis,
  SubjectColor,
  MilestonePhase,
  SubjectPhaseKey,
  Milestone,
  IA,
  AppState,
} from "../types";
import { DEFAULT_ENERGY_SETTINGS, COGNITIVE_LOAD_MATRIX } from "../types";
import { detectMilestonePhase } from "./learning";

/**
 * Get the cognitive load for a subject + phase combination
 */
export function getCognitiveLoad(
  subject: SubjectColor,
  phase: MilestonePhase,
): CognitiveLoad {
  const key: SubjectPhaseKey = `${subject}_${phase}`;
  return COGNITIVE_LOAD_MATRIX[key] || "medium";
}

/**
 * Get the energy pattern for a specific date
 */
export function getEnergyPatternForDate(
  date: Date | string,
  profile: EnergyProfile,
): DayEnergyPattern {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const dateKey = format(dateObj, "yyyy-MM-dd");

  // Check for exception first
  if (profile.exceptions[dateKey]) {
    return profile.exceptions[dateKey];
  }

  // Use weekend or weekday pattern
  return isWeekend(dateObj) ? profile.weekendPattern : profile.weekdayPattern;
}

/**
 * Get the energy level at a specific hour on a given date
 */
export function getEnergyLevelAtHour(
  date: Date | string,
  hour: number,
  profile: EnergyProfile,
): EnergyLevel {
  const pattern = getEnergyPatternForDate(date, profile);

  for (const window of pattern.windows) {
    if (hour >= window.startHour && hour < window.endHour) {
      return window.level;
    }
  }

  // Default to low if hour not covered
  return "low";
}

/**
 * Get the energy window at a specific hour
 */
export function getEnergyWindowAtHour(
  date: Date | string,
  hour: number,
  profile: EnergyProfile,
): EnergyWindow | null {
  const pattern = getEnergyPatternForDate(date, profile);

  for (const window of pattern.windows) {
    if (hour >= window.startHour && hour < window.endHour) {
      return window;
    }
  }

  return null;
}

/**
 * Check if a cognitive load matches an energy level appropriately
 */
export function isEnergyMatch(
  cognitiveLoad: CognitiveLoad,
  energyLevel: EnergyLevel,
): boolean {
  // High cognitive load needs high energy
  if (cognitiveLoad === "high") {
    return energyLevel === "high";
  }

  // Medium cognitive load works with high or medium energy
  if (cognitiveLoad === "medium") {
    return energyLevel === "high" || energyLevel === "medium";
  }

  // Low cognitive load works with any energy level
  return true;
}

/**
 * Get the productivity penalty for an energy mismatch
 */
export function getEnergyMismatchPenalty(
  cognitiveLoad: CognitiveLoad,
  energyLevel: EnergyLevel,
  settings: EnergySettings = DEFAULT_ENERGY_SETTINGS,
): number {
  if (cognitiveLoad === "high") {
    if (energyLevel === "medium") {
      return settings.highLoadInMediumPenalty;
    }
    if (energyLevel === "low") {
      return settings.highLoadInLowPenalty;
    }
  }

  if (cognitiveLoad === "medium" && energyLevel === "low") {
    return settings.mediumLoadInLowPenalty;
  }

  return 0;
}

/**
 * Get mismatch severity description
 */
export function getMismatchDescription(
  cognitiveLoad: CognitiveLoad,
  energyLevel: EnergyLevel,
): string {
  if (cognitiveLoad === "high" && energyLevel === "low") {
    return "Critical mismatch: High-demand task during low energy time";
  }
  if (cognitiveLoad === "high" && energyLevel === "medium") {
    return "Suboptimal: High-demand task during medium energy time";
  }
  if (cognitiveLoad === "medium" && energyLevel === "low") {
    return "Mismatch: Medium-demand task during low energy time";
  }
  if (cognitiveLoad === "low" && energyLevel === "high") {
    return "Wasted peak: Low-demand task using prime energy time";
  }
  return "Good match";
}

/**
 * Find alternative time slots with better energy matching
 */
export function findBetterTimeSlots(
  requiredCognitiveLoad: CognitiveLoad,
  currentDate: string,
  profile: EnergyProfile,
  daysToSearch: number = 7,
): Array<{
  date: string;
  hour: number;
  energyLevel: EnergyLevel;
  reason: string;
}> {
  const alternatives: Array<{
    date: string;
    hour: number;
    energyLevel: EnergyLevel;
    reason: string;
  }> = [];

  const startDate = parseISO(currentDate);

  for (let d = 0; d < daysToSearch; d++) {
    const checkDate = addDays(startDate, d);
    const dateStr = format(checkDate, "yyyy-MM-dd");
    const pattern = getEnergyPatternForDate(checkDate, profile);

    for (const window of pattern.windows) {
      // Check if this window is a good match
      if (isEnergyMatch(requiredCognitiveLoad, window.level)) {
        // Prefer high energy for high load
        if (requiredCognitiveLoad === "high" && window.level === "high") {
          alternatives.push({
            date: dateStr,
            hour: window.startHour,
            energyLevel: window.level,
            reason: `${window.description || "Peak energy"} - ideal for intensive work`,
          });
        } else if (requiredCognitiveLoad === "medium") {
          alternatives.push({
            date: dateStr,
            hour: window.startHour,
            energyLevel: window.level,
            reason: window.description || "Good energy window",
          });
        } else if (requiredCognitiveLoad === "low" && window.level === "low") {
          alternatives.push({
            date: dateStr,
            hour: window.startHour,
            energyLevel: window.level,
            reason: `${window.description || "Low energy time"} - perfect for light tasks`,
          });
        }
      }
    }
  }

  // Sort by best match and limit results
  return alternatives.slice(0, 5);
}

/**
 * Detect energy mismatches in scheduled milestones
 */
export function detectEnergyMismatches(
  milestones: Milestone[],
  ias: IA[],
  settings: EnergySettings = DEFAULT_ENERGY_SETTINGS,
): EnergyMismatch[] {
  const mismatches: EnergyMismatch[] = [];

  for (const milestone of milestones) {
    if (milestone.completed) continue;

    const ia = ias.find((i) => i.id === milestone.iaId);
    if (!ia) continue;

    const phase =
      milestone.phase || detectMilestonePhase(milestone.milestone_name);
    const cognitiveLoad = getCognitiveLoad(ia.subjectColor, phase);

    // Check the milestone's scheduled date (using startDate)
    const scheduledDate = parseISO(milestone.startDate);
    // Assume work starts at 9am by default
    const scheduledHour = 9;

    const energyLevel = getEnergyLevelAtHour(
      scheduledDate,
      scheduledHour,
      settings.profile,
    );

    if (!isEnergyMatch(cognitiveLoad, energyLevel)) {
      const penalty = getEnergyMismatchPenalty(
        cognitiveLoad,
        energyLevel,
        settings,
      );

      mismatches.push({
        id: `mismatch-${milestone.id}`,
        milestoneId: milestone.id,
        milestoneName: milestone.milestone_name,
        date: milestone.startDate,
        scheduledHour,
        taskCognitiveLoad: cognitiveLoad,
        windowEnergyLevel: energyLevel,
        productivityImpactPercent: penalty,
        suggestedAlternatives: findBetterTimeSlots(
          cognitiveLoad,
          milestone.startDate,
          settings.profile,
        ),
      });
    }
  }

  return mismatches;
}

/**
 * Analyze a week's schedule for energy matching
 */
export function analyzeWeeklyEnergy(state: AppState): WeeklyEnergyAnalysis {
  const settings = state.energySettings || DEFAULT_ENERGY_SETTINGS;
  const allMilestones = state.ias.flatMap((ia) => ia.milestones);

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  // Get milestones for this week
  const weekMilestones = allMilestones.filter((m) => {
    if (m.completed) return false;
    const startDate = parseISO(m.startDate);
    const deadline = parseISO(m.deadline);
    return (
      (startDate >= weekStart && startDate < addDays(weekStart, 7)) ||
      (deadline >= weekStart && deadline < addDays(weekStart, 7))
    );
  });

  const mismatches = detectEnergyMismatches(
    weekMilestones,
    state.ias,
    settings,
  );

  let wellMatchedSessions = 0;
  let highLoadInLowEnergy = 0;
  let lowLoadInHighEnergy = 0;

  for (const milestone of weekMilestones) {
    const ia = state.ias.find((i) => i.id === milestone.iaId);
    if (!ia) continue;

    const phase =
      milestone.phase || detectMilestonePhase(milestone.milestone_name);
    const cognitiveLoad = getCognitiveLoad(ia.subjectColor, phase);
    const scheduledDate = parseISO(milestone.startDate);
    const energyLevel = getEnergyLevelAtHour(
      scheduledDate,
      9,
      settings.profile,
    );

    if (isEnergyMatch(cognitiveLoad, energyLevel)) {
      wellMatchedSessions++;
    }

    if (cognitiveLoad === "high" && energyLevel === "low") {
      highLoadInLowEnergy++;
    }

    if (cognitiveLoad === "low" && energyLevel === "high") {
      lowLoadInHighEnergy++;
    }
  }

  const totalSessions = weekMilestones.length;
  const mismatchedSessions = mismatches.length;
  const overallEnergyScore =
    totalSessions > 0
      ? Math.round((wellMatchedSessions / totalSessions) * 100)
      : 100;

  return {
    weekStart: weekStartStr,
    wellMatchedSessions,
    mismatchedSessions,
    mismatches,
    overallEnergyScore,
    highLoadInLowEnergy,
    lowLoadInHighEnergy,
  };
}

/**
 * Get energy level color for visualization
 */
export function getEnergyLevelColor(level: EnergyLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case "high":
      return {
        bg: "bg-green-500/20",
        text: "text-green-400",
        border: "border-green-500",
      };
    case "medium":
      return {
        bg: "bg-yellow-500/20",
        text: "text-yellow-400",
        border: "border-yellow-500",
      };
    case "low":
      return {
        bg: "bg-slate-500/20",
        text: "text-slate-400",
        border: "border-slate-500",
      };
  }
}

/**
 * Get cognitive load color for visualization
 */
export function getCognitiveLoadColor(load: CognitiveLoad): {
  bg: string;
  text: string;
  intensity: string;
} {
  switch (load) {
    case "high":
      return {
        bg: "bg-red-500/30",
        text: "text-red-400",
        intensity: "ring-2 ring-red-500/50",
      };
    case "medium":
      return {
        bg: "bg-orange-500/30",
        text: "text-orange-400",
        intensity: "ring-1 ring-orange-500/30",
      };
    case "low":
      return {
        bg: "bg-blue-500/30",
        text: "text-blue-400",
        intensity: "",
      };
  }
}

/**
 * Get label for cognitive load
 */
export function getCognitiveLoadLabel(load: CognitiveLoad): string {
  switch (load) {
    case "high":
      return "High Intensity";
    case "medium":
      return "Medium Intensity";
    case "low":
      return "Low Intensity";
  }
}

/**
 * Get label for energy level
 */
export function getEnergyLevelLabel(level: EnergyLevel): string {
  switch (level) {
    case "high":
      return "Peak Energy";
    case "medium":
      return "Moderate Energy";
    case "low":
      return "Low Energy";
  }
}

/**
 * Check if date is a focus mode day
 */
export function isFocusModeDay(
  date: Date | string,
  profile: EnergyProfile,
): boolean {
  const dateStr = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  return profile.focusModeDays.includes(dateStr);
}

/**
 * Get all high-energy windows for a date range
 */
export function getHighEnergyWindows(
  startDate: Date,
  endDate: Date,
  profile: EnergyProfile,
): Array<{ date: string; window: EnergyWindow }> {
  const windows: Array<{ date: string; window: EnergyWindow }> = [];
  let current = startDate;

  while (current <= endDate) {
    const pattern = getEnergyPatternForDate(current, profile);
    const dateStr = format(current, "yyyy-MM-dd");

    for (const window of pattern.windows) {
      if (window.level === "high") {
        windows.push({ date: dateStr, window });
      }
    }

    current = addDays(current, 1);
  }

  return windows;
}

/**
 * Calculate total high-energy hours available in a date range
 */
export function calculateAvailableHighEnergyHours(
  startDate: Date,
  endDate: Date,
  profile: EnergyProfile,
): number {
  const highWindows = getHighEnergyWindows(startDate, endDate, profile);
  return highWindows.reduce(
    (total, { window }) => total + (window.endHour - window.startHour),
    0,
  );
}

/**
 * Check if schedule has enough high-energy time for high-load tasks
 */
export function validateHighEnergyCapacity(
  milestones: Milestone[],
  ias: IA[],
  startDate: Date,
  endDate: Date,
  settings: EnergySettings,
): {
  isValid: boolean;
  requiredHighEnergyHours: number;
  availableHighEnergyHours: number;
  shortfall: number;
} {
  // Calculate required high-energy hours
  let requiredHighEnergyHours = 0;

  for (const milestone of milestones) {
    if (milestone.completed) continue;

    const ia = ias.find((i) => i.id === milestone.iaId);
    if (!ia) continue;

    const phase =
      milestone.phase || detectMilestonePhase(milestone.milestone_name);
    const cognitiveLoad = getCognitiveLoad(ia.subjectColor, phase);

    if (cognitiveLoad === "high") {
      requiredHighEnergyHours +=
        milestone.estimated_hours * milestone.buffer_multiplier;
    }
  }

  const availableHighEnergyHours = calculateAvailableHighEnergyHours(
    startDate,
    endDate,
    settings.profile,
  );

  const shortfall = Math.max(
    0,
    requiredHighEnergyHours - availableHighEnergyHours,
  );

  return {
    isValid: shortfall === 0,
    requiredHighEnergyHours,
    availableHighEnergyHours,
    shortfall,
  };
}

/**
 * Optimization suggestion for a milestone
 */
export interface OptimizationSuggestion {
  milestoneId: string;
  milestoneName: string;
  iaName: string;
  currentCognitiveLoad: CognitiveLoad;
  currentEnergyLevel: EnergyLevel;
  suggestedDate: string;
  suggestedHour: number;
  suggestedEnergyLevel: EnergyLevel;
  expectedProductivityGain: number;
  reason: string;
}

/**
 * Generate auto-optimization suggestions for mismatched milestones
 */
export function generateOptimizationSuggestions(
  state: AppState,
): OptimizationSuggestion[] {
  const settings = state.energySettings || DEFAULT_ENERGY_SETTINGS;
  const suggestions: OptimizationSuggestion[] = [];

  // Get all milestones with their phases
  const milestonesWithContext = state.ias.flatMap((ia) =>
    ia.milestones
      .filter((m) => !m.completed)
      .map((m) => ({
        milestone: m,
        ia,
        phase: m.phase || detectMilestonePhase(m.milestone_name),
      })),
  );

  // Detect current mismatches
  const mismatches = detectEnergyMismatches(
    milestonesWithContext.map((mc) => ({ ...mc.milestone, phase: mc.phase })),
    state.ias,
    settings,
  );

  // For each mismatch, generate a suggestion
  for (const mismatch of mismatches) {
    const mc = milestonesWithContext.find(
      (m) => m.milestone.id === mismatch.milestoneId,
    );
    if (!mc) continue;

    const cognitiveLoad = getCognitiveLoad(mc.ia.subjectColor, mc.phase);

    // Find the best alternative time slot
    if (mismatch.suggestedAlternatives.length > 0) {
      const bestAlt = mismatch.suggestedAlternatives[0];

      suggestions.push({
        milestoneId: mismatch.milestoneId,
        milestoneName: mismatch.milestoneName,
        iaName: mc.ia.name,
        currentCognitiveLoad: cognitiveLoad,
        currentEnergyLevel: mismatch.windowEnergyLevel,
        suggestedDate: bestAlt.date,
        suggestedHour: bestAlt.hour,
        suggestedEnergyLevel: bestAlt.energyLevel,
        expectedProductivityGain: mismatch.productivityImpactPercent,
        reason: `Move ${getCognitiveLoadLabel(cognitiveLoad).toLowerCase()} task from ${getEnergyLevelLabel(mismatch.windowEnergyLevel).toLowerCase()} to ${getEnergyLevelLabel(bestAlt.energyLevel).toLowerCase()} window`,
      });
    }
  }

  // Sort by expected productivity gain (highest first)
  suggestions.sort(
    (a, b) => b.expectedProductivityGain - a.expectedProductivityGain,
  );

  return suggestions;
}

/**
 * Calculate total potential productivity gain from all optimizations
 */
export function calculateTotalOptimizationGain(
  suggestions: OptimizationSuggestion[],
): number {
  if (suggestions.length === 0) return 0;
  return suggestions.reduce((sum, s) => sum + s.expectedProductivityGain, 0);
}

/**
 * Get a summary of optimization opportunities
 */
export function getOptimizationSummary(state: AppState): {
  totalSuggestions: number;
  highPrioritySuggestions: number;
  potentialProductivityGain: number;
  topSuggestion: OptimizationSuggestion | null;
} {
  const suggestions = generateOptimizationSuggestions(state);

  return {
    totalSuggestions: suggestions.length,
    highPrioritySuggestions: suggestions.filter(
      (s) => s.expectedProductivityGain >= 20,
    ).length,
    potentialProductivityGain: calculateTotalOptimizationGain(suggestions),
    topSuggestion: suggestions[0] || null,
  };
}
