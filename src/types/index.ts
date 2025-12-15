// IB Deadline Management System Types

// Re-export assistant types
export * from "./assistant";

export type IAStatus = "not_started" | "in_progress" | "overdue" | "completed";

export type SubjectColor =
  | "math"
  | "physics"
  | "economics"
  | "english"
  | "history";

// Phase types for learning multipliers
export type MilestonePhase =
  | "research"
  | "outline"
  | "draft"
  | "revision"
  | "polish";

// Work session for time tracking
export interface WorkSession {
  id: string;
  milestoneId: string;
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  duration: number; // in minutes
  note?: string;
}

// Active timer state
export interface ActiveTimer {
  milestoneId: string;
  iaId: string;
  startTime: string; // ISO date string
  pausedAt?: string; // ISO date string if currently paused
  accumulatedMinutes: number; // minutes accumulated before current session
}

export interface Milestone {
  id: string;
  iaId: string;
  milestone_name: string;
  description: string;
  estimated_hours: number;
  buffer_multiplier: number;
  dependencies: string[];
  deadline: string; // ISO date string
  startDate: string; // ISO date string
  completed: boolean;
  completedAt?: string; // ISO date string
  googleEventId?: string;
  phase?: MilestonePhase; // Phase category for learning (auto-detected if not set)
  workSessions?: WorkSession[]; // Logged time sessions
  actualHours?: number; // Total actual hours spent (calculated from sessions)
}

export interface IA {
  id: string;
  name: string;
  wordCount: number;
  type: string;
  status: IAStatus;
  subjectColor: SubjectColor;
  milestones: Milestone[];
  targetDeadline?: string; // Override for master deadline
}

export interface ExtendedEssay {
  name: string;
  wordCount: number;
  subject: string;
  targetDeadline: string;
  status: IAStatus;
  milestones: Milestone[];
}

// Learning multipliers for personalized estimates
export interface LearnedMultipliers {
  // Phase-based multipliers (how long each phase takes vs estimate)
  phases: Record<MilestonePhase, { multiplier: number; sampleCount: number }>;
  // Subject-based multipliers
  subjects: Record<SubjectColor, { multiplier: number; sampleCount: number }>;
  // Overall multiplier
  overall: { multiplier: number; sampleCount: number };
  // Last updated timestamp
  lastUpdated: string;
}

export interface AppState {
  ias: IA[];
  ee: ExtendedEssay;
  masterDeadline: string;
  weeklyHoursBudget: number;
  googleCalendarEventIds: Record<string, string>;
  lastCalendarSync: string | null;
  completedMilestones: string[];
  // Time tracking additions
  activeTimer: ActiveTimer | null;
  learnedMultipliers: LearnedMultipliers;
  allWorkSessions: WorkSession[]; // Global session log for analytics
  // Deep work settings
  deepWorkSettings: DeepWorkSettings;
  // Energy settings
  energySettings: EnergySettings;
  // Blocker and risk management
  blockers: Blocker[];
  risks: Risk[];
  blockerSettings: BlockerSettings;
}

export interface MilestoneSchedule {
  milestoneId: string;
  iaId: string;
  deadline: string;
  startDate: string;
  conflicts: string[];
}

export interface WeeklyWorkload {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  milestones: Milestone[];
  isOverloaded: boolean;
}

export interface Warning {
  type:
    | "overload"
    | "overlap"
    | "overdue"
    | "deadline_risk"
    | "insufficient_time"
    | "minimum_session_violation"
    | "context_switch"
    | "fragmented_schedule"
    | "deep_work_conflict";
  message: string;
  severity: "warning" | "error";
  affectedIds: string[];
  autoFixAvailable?: boolean;
  autoFixDescription?: string;
}

// Deep Work Configuration
export interface DeepWorkSettings {
  // Minimum session lengths in hours for each phase
  minimumSessionHours: Record<MilestonePhase, number>;
  // Context switching penalty in minutes
  contextSwitchPenaltyMinutes: number;
  // Maximum different IAs to work on per day
  maxIAsPerDay: number;
  // Buffer times in minutes
  prepBufferMinutes: number;
  decompressBufferMinutes: number;
  // Whether to enforce deep work windows
  enforceDeepWorkWindows: boolean;
  // Preferred deep work time windows (24h format)
  deepWorkWindows: { start: number; end: number }[];
}

// Default deep work settings
export const DEFAULT_DEEP_WORK_SETTINGS: DeepWorkSettings = {
  minimumSessionHours: {
    research: 2,
    outline: 1.5,
    draft: 3,
    revision: 2,
    polish: 1,
  },
  contextSwitchPenaltyMinutes: 30,
  maxIAsPerDay: 2,
  prepBufferMinutes: 15,
  decompressBufferMinutes: 15,
  enforceDeepWorkWindows: false,
  deepWorkWindows: [
    { start: 9, end: 12 }, // Morning deep work: 9am-12pm
    { start: 14, end: 17 }, // Afternoon deep work: 2pm-5pm
  ],
};

// Scheduled work session for a day
export interface ScheduledSession {
  id: string;
  milestoneId: string;
  iaId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationHours: number;
  phase: MilestonePhase;
  isDeepWork: boolean;
  includesPrep: boolean;
  includesDecompress: boolean;
}

// Context switch event
export interface ContextSwitch {
  date: string;
  fromIaId: string;
  toIaId: string;
  penaltyMinutes: number;
  isSameDay: boolean;
  hasGapBetween: boolean; // Whether there's other work between sessions
}

// Schedule violation
export interface ScheduleViolation {
  id: string;
  type:
    | "minimum_session"
    | "context_switch"
    | "max_ias_per_day"
    | "fragmented_work"
    | "deep_work_conflict";
  severity: "warning" | "error";
  message: string;
  affectedMilestoneIds: string[];
  affectedDate?: string;
  productivityPenaltyPercent?: number;
  autoFix?: {
    description: string;
    action: "consolidate" | "move" | "extend" | "swap";
    suggestedChanges: Array<{
      milestoneId: string;
      field: "startDate" | "deadline" | "scheduledTime";
      newValue: string;
    }>;
  };
}

// Daily schedule analysis
export interface DailyScheduleAnalysis {
  date: string;
  sessions: ScheduledSession[];
  iaCount: number;
  totalHours: number;
  effectiveHours: number; // After context switch penalties
  contextSwitches: ContextSwitch[];
  violations: ScheduleViolation[];
  productivityScore: number; // 0-100
}

// ============ ENERGY LEVEL AWARENESS ============

// Energy levels throughout the day
export type EnergyLevel = "high" | "medium" | "low";

// Cognitive load for different task types
export type CognitiveLoad = "high" | "medium" | "low";

// Time window with energy level
export interface EnergyWindow {
  id: string;
  startHour: number; // 0-23
  endHour: number; // 0-23
  level: EnergyLevel;
  description?: string; // e.g., "Post-lunch dip"
}

// Energy pattern for a day type
export interface DayEnergyPattern {
  windows: EnergyWindow[];
}

// User's complete energy profile
export interface EnergyProfile {
  weekdayPattern: DayEnergyPattern;
  weekendPattern: DayEnergyPattern;
  // Exception days (date -> custom pattern)
  exceptions: Record<string, DayEnergyPattern>;
  // Focus mode days (only high-load work scheduled)
  focusModeDays: string[]; // ISO date strings
}

// Cognitive load classification for subject + phase combinations
export type SubjectPhaseKey = `${SubjectColor}_${MilestonePhase}`;

// Energy mismatch detection result
export interface EnergyMismatch {
  id: string;
  milestoneId: string;
  milestoneName: string;
  date: string;
  scheduledHour: number;
  taskCognitiveLoad: CognitiveLoad;
  windowEnergyLevel: EnergyLevel;
  productivityImpactPercent: number;
  suggestedAlternatives: Array<{
    date: string;
    hour: number;
    energyLevel: EnergyLevel;
    reason: string;
  }>;
}

// Weekly energy analysis
export interface WeeklyEnergyAnalysis {
  weekStart: string;
  wellMatchedSessions: number;
  mismatchedSessions: number;
  mismatches: EnergyMismatch[];
  overallEnergyScore: number; // 0-100
  highLoadInLowEnergy: number;
  lowLoadInHighEnergy: number; // Wasted peak energy
}

// Energy settings that can be customized
export interface EnergySettings {
  profile: EnergyProfile;
  // Whether to enforce energy matching
  enforceEnergyMatching: boolean;
  // Allow overrides with warning
  allowMismatchOverrides: boolean;
  // Productivity penalty percentages
  highLoadInMediumPenalty: number; // Default 20%
  highLoadInLowPenalty: number; // Default 40%
  mediumLoadInLowPenalty: number; // Default 15%
}

// Default energy windows
export const DEFAULT_WEEKDAY_PATTERN: DayEnergyPattern = {
  windows: [
    {
      id: "early-morning",
      startHour: 6,
      endHour: 8,
      level: "medium",
      description: "Wake up, getting started",
    },
    {
      id: "morning-peak",
      startHour: 8,
      endHour: 12,
      level: "high",
      description: "Peak focus time",
    },
    {
      id: "lunch-dip",
      startHour: 12,
      endHour: 14,
      level: "low",
      description: "Post-lunch energy dip",
    },
    {
      id: "afternoon",
      startHour: 14,
      endHour: 17,
      level: "medium",
      description: "Recovering energy",
    },
    {
      id: "evening",
      startHour: 17,
      endHour: 20,
      level: "medium",
      description: "Evening focus",
    },
    {
      id: "night",
      startHour: 20,
      endHour: 23,
      level: "low",
      description: "Winding down",
    },
  ],
};

export const DEFAULT_WEEKEND_PATTERN: DayEnergyPattern = {
  windows: [
    {
      id: "morning-slow",
      startHour: 8,
      endHour: 10,
      level: "medium",
      description: "Relaxed morning",
    },
    {
      id: "late-morning",
      startHour: 10,
      endHour: 13,
      level: "high",
      description: "Weekend peak",
    },
    {
      id: "afternoon",
      startHour: 13,
      endHour: 17,
      level: "medium",
      description: "Flexible afternoon",
    },
    {
      id: "evening",
      startHour: 17,
      endHour: 22,
      level: "low",
      description: "Rest time",
    },
  ],
};

export const DEFAULT_ENERGY_PROFILE: EnergyProfile = {
  weekdayPattern: DEFAULT_WEEKDAY_PATTERN,
  weekendPattern: DEFAULT_WEEKEND_PATTERN,
  exceptions: {},
  focusModeDays: [],
};

export const DEFAULT_ENERGY_SETTINGS: EnergySettings = {
  profile: DEFAULT_ENERGY_PROFILE,
  enforceEnergyMatching: true,
  allowMismatchOverrides: true,
  highLoadInMediumPenalty: 20,
  highLoadInLowPenalty: 40,
  mediumLoadInLowPenalty: 15,
};

// Cognitive load matrix for subject + phase combinations
export const COGNITIVE_LOAD_MATRIX: Record<SubjectPhaseKey, CognitiveLoad> = {
  // Math - technical, high cognitive load throughout
  math_research: "high",
  math_outline: "high",
  math_draft: "high",
  math_revision: "high",
  math_polish: "medium",

  // Physics - experimental design is demanding
  physics_research: "high",
  physics_outline: "high",
  physics_draft: "high",
  physics_revision: "medium",
  physics_polish: "low",

  // Economics - article finding is easier
  economics_research: "low",
  economics_outline: "medium",
  economics_draft: "high",
  economics_revision: "medium",
  economics_polish: "low",

  // English - literary analysis requires creativity
  english_research: "medium",
  english_outline: "high",
  english_draft: "high",
  english_revision: "high",
  english_polish: "low",

  // History - research-heavy
  history_research: "high",
  history_outline: "medium",
  history_draft: "high",
  history_revision: "medium",
  history_polish: "low",
};

export interface AIGeneratedMilestone {
  milestone_name: string;
  description: string;
  estimated_hours: number;
  dependencies: string[];
}

// Initial hardcoded data
export const INITIAL_IAS: IA[] = [
  {
    id: "math",
    name: "Math AA HL IA",
    wordCount: 2200,
    type: "Mathematical Exploration",
    status: "not_started",
    subjectColor: "math",
    milestones: [],
  },
  {
    id: "physics",
    name: "Physics HL IA",
    wordCount: 2200,
    type: "Scientific Investigation",
    status: "not_started",
    subjectColor: "physics",
    milestones: [],
  },
  {
    id: "econ-micro",
    name: "Economics Commentary 1: Microeconomics",
    wordCount: 800,
    type: "News Commentary",
    status: "not_started",
    subjectColor: "economics",
    milestones: [],
  },
  {
    id: "econ-macro",
    name: "Economics Commentary 2: Macroeconomics",
    wordCount: 800,
    type: "News Commentary",
    status: "not_started",
    subjectColor: "economics",
    milestones: [],
  },
  {
    id: "econ-intl",
    name: "Economics Commentary 3: International Economics",
    wordCount: 800,
    type: "News Commentary",
    status: "not_started",
    subjectColor: "economics",
    milestones: [],
  },
  {
    id: "english",
    name: "English Lang & Lit SL IA",
    wordCount: 1500,
    type: "Literary Analysis",
    status: "not_started",
    subjectColor: "english",
    milestones: [],
  },
  {
    id: "history",
    name: "History SL IA",
    wordCount: 2200,
    type: "Historical Investigation",
    status: "not_started",
    subjectColor: "history",
    milestones: [],
  },
];

export const INITIAL_EE: ExtendedEssay = {
  name: "Extended Essay",
  wordCount: 4000,
  subject: "TBD",
  targetDeadline: "2026-03-31",
  status: "not_started",
  milestones: [],
};

// Default multipliers (1.0 = no adjustment)
export const INITIAL_LEARNED_MULTIPLIERS: LearnedMultipliers = {
  phases: {
    research: { multiplier: 1.0, sampleCount: 0 },
    outline: { multiplier: 1.0, sampleCount: 0 },
    draft: { multiplier: 1.0, sampleCount: 0 },
    revision: { multiplier: 1.0, sampleCount: 0 },
    polish: { multiplier: 1.0, sampleCount: 0 },
  },
  subjects: {
    math: { multiplier: 1.0, sampleCount: 0 },
    physics: { multiplier: 1.0, sampleCount: 0 },
    economics: { multiplier: 1.0, sampleCount: 0 },
    english: { multiplier: 1.0, sampleCount: 0 },
    history: { multiplier: 1.0, sampleCount: 0 },
  },
  overall: { multiplier: 1.0, sampleCount: 0 },
  lastUpdated: new Date().toISOString(),
};

// Forward declaration needed before INITIAL_STATE
export const DEFAULT_BLOCKER_SETTINGS: BlockerSettings = {
  staleAfterDays: 3,
  autoEscalateAfterDays: 2,
  notifyOnCritical: true,
  notifyOnStale: true,
  notifyOnOverdue: true,
  defaultFollowUpIntervalDays: 2,
};

export const INITIAL_STATE: AppState = {
  ias: INITIAL_IAS,
  ee: INITIAL_EE,
  masterDeadline: "2025-12-31",
  weeklyHoursBudget: 6,
  googleCalendarEventIds: {},
  lastCalendarSync: null,
  completedMilestones: [],
  activeTimer: null,
  learnedMultipliers: INITIAL_LEARNED_MULTIPLIERS,
  allWorkSessions: [],
  deepWorkSettings: DEFAULT_DEEP_WORK_SETTINGS,
  energySettings: DEFAULT_ENERGY_SETTINGS,
  blockers: [],
  risks: [],
  blockerSettings: DEFAULT_BLOCKER_SETTINGS,
};

export const SUBJECT_COLORS: Record<
  SubjectColor,
  { bg: string; border: string; text: string }
> = {
  math: {
    bg: "bg-blue-500/20",
    border: "border-blue-500",
    text: "text-blue-400",
  },
  physics: {
    bg: "bg-purple-500/20",
    border: "border-purple-500",
    text: "text-purple-400",
  },
  economics: {
    bg: "bg-green-500/20",
    border: "border-green-500",
    text: "text-green-400",
  },
  english: {
    bg: "bg-orange-500/20",
    border: "border-orange-500",
    text: "text-orange-400",
  },
  history: {
    bg: "bg-red-500/20",
    border: "border-red-500",
    text: "text-red-400",
  },
};

// ============================================
// BLOCKER AND RISK MANAGEMENT TYPES
// ============================================

// Blocker category types
export type BlockerCategory =
  | "resource" // Lab equipment, materials, software
  | "approval" // Teacher approval, permissions
  | "external_dependency" // Library books, external data
  | "knowledge_gap" // Need to learn something
  | "technical_issue" // Software, equipment problems
  | "health_personal"; // Personal circumstances

// Blocker severity levels
export type BlockerSeverity = "low" | "medium" | "high" | "critical";

// Blocker status
export type BlockerStatus = "active" | "resolved" | "escalated" | "stale";

// Blocker update entry
export interface BlockerUpdate {
  id: string;
  timestamp: string; // ISO date
  message: string;
  type: "status_change" | "note" | "escalation" | "follow_up";
}

// Core blocker interface
export interface Blocker {
  id: string;
  milestoneId: string;
  iaId: string;
  // Description
  title: string;
  description: string;
  category: BlockerCategory;
  severity: BlockerSeverity;
  status: BlockerStatus;
  // Timing
  createdAt: string; // ISO date
  expectedResolutionDate?: string; // ISO date
  resolvedAt?: string; // ISO date
  lastUpdatedAt: string; // ISO date
  // Impact
  estimatedDelayDays: number;
  actualDelayDays?: number;
  // Resolution
  resolutionNotes?: string;
  lessonsLearned?: string;
  workaroundApplied?: string;
  // External dependency tracking
  waitingOn?: string; // Who/what are we waiting on
  lastFollowUpDate?: string; // ISO date
  nextFollowUpDate?: string; // ISO date
  // Updates history
  updates: BlockerUpdate[];
  // Auto-escalation tracking
  autoEscalatedAt?: string; // ISO date
  originalSeverity?: BlockerSeverity;
}

// Risk probability and impact levels
export type RiskProbability = "low" | "medium" | "high" | "very_high";
export type RiskImpact = "minor" | "moderate" | "major" | "severe";
export type RiskStatus =
  | "identified"
  | "mitigating"
  | "materialized"
  | "avoided"
  | "accepted";

// Risk interface
export interface Risk {
  id: string;
  iaId?: string; // Optional - can be IA-specific or general
  milestoneId?: string; // Optional - can be milestone-specific
  // Description
  title: string;
  description: string;
  category: BlockerCategory;
  // Assessment
  probability: RiskProbability;
  impact: RiskImpact;
  riskScore: number; // Calculated: probability * impact
  status: RiskStatus;
  // Dates
  identifiedAt: string; // ISO date
  lastAssessedAt: string; // ISO date
  materializedAt?: string; // ISO date - when it became a blocker
  mitigatedAt?: string; // ISO date
  // Mitigation
  mitigationStrategy?: string;
  contingencyPlan?: string;
  mitigationProgress?: number; // 0-100
  // Linked blocker if materialized
  blockerId?: string;
  // Suggested by system or user-added
  isSystemSuggested: boolean;
  isDismissed: boolean;
}

// Common blocker templates for quick selection
export interface BlockerTemplate {
  id: string;
  title: string;
  description: string;
  category: BlockerCategory;
  defaultSeverity: BlockerSeverity;
  suggestedWorkarounds: string[];
  estimatedResolutionDays: number;
}

// Risk suggestion based on IA type
export interface RiskSuggestion {
  id: string;
  forSubject: SubjectColor;
  forPhase?: MilestonePhase;
  title: string;
  description: string;
  category: BlockerCategory;
  defaultProbability: RiskProbability;
  defaultImpact: RiskImpact;
  mitigationSuggestion: string;
  contingencySuggestion: string;
}

// Blocker statistics for learning
export interface BlockerStatistics {
  totalBlockers: number;
  resolvedBlockers: number;
  averageResolutionDays: Record<BlockerCategory, number>;
  totalDaysLost: number;
  mostCommonCategory: BlockerCategory | null;
  workaroundSuccessRate: number;
  // Pattern insights
  patterns: string[];
}

// Blocker settings
export interface BlockerSettings {
  // Auto-escalation thresholds
  staleAfterDays: number; // Days without update before marked stale
  autoEscalateAfterDays: number; // Days overdue before auto-escalation
  // Notification preferences
  notifyOnCritical: boolean;
  notifyOnStale: boolean;
  notifyOnOverdue: boolean;
  // Follow-up reminders
  defaultFollowUpIntervalDays: number;
}

// Common blocker templates
export const BLOCKER_TEMPLATES: BlockerTemplate[] = [
  {
    id: "lab-equipment",
    title: "Lab equipment unavailable",
    description:
      "Required laboratory equipment is not available or reserved by others",
    category: "resource",
    defaultSeverity: "high",
    suggestedWorkarounds: [
      "Consider simulation-based investigation",
      "Book alternative time slot",
      "Use different equipment with similar function",
    ],
    estimatedResolutionDays: 3,
  },
  {
    id: "library-book",
    title: "Waiting for library resource",
    description:
      "Required book or resource is on loan or needs interlibrary loan",
    category: "external_dependency",
    defaultSeverity: "medium",
    suggestedWorkarounds: [
      "Start with secondary sources while waiting",
      "Find digital alternatives (JSTOR, Google Scholar)",
      "Check if another library has it",
    ],
    estimatedResolutionDays: 14,
  },
  {
    id: "teacher-approval",
    title: "Waiting for teacher approval",
    description: "Topic, methodology, or draft needs teacher sign-off",
    category: "approval",
    defaultSeverity: "high",
    suggestedWorkarounds: [
      "Prepare alternative approaches to present",
      "Work on non-dependent sections",
      "Schedule meeting to discuss in person",
    ],
    estimatedResolutionDays: 5,
  },
  {
    id: "knowledge-gap",
    title: "Need to learn new concept/skill",
    description: "Lack understanding of required concept or technique",
    category: "knowledge_gap",
    defaultSeverity: "medium",
    suggestedWorkarounds: [
      "Watch Khan Academy or YouTube tutorials",
      "Ask teacher for recommended resources",
      "Study group with classmates",
    ],
    estimatedResolutionDays: 7,
  },
  {
    id: "software-issue",
    title: "Software or technical problem",
    description:
      "Required software not working, data lost, or technical issues",
    category: "technical_issue",
    defaultSeverity: "high",
    suggestedWorkarounds: [
      "Use school computers as backup",
      "Try alternative software (free alternatives)",
      "Contact IT support",
    ],
    estimatedResolutionDays: 2,
  },
  {
    id: "data-collection",
    title: "Data collection delayed",
    description:
      "Survey responses, experimental data, or interviews not completed",
    category: "external_dependency",
    defaultSeverity: "medium",
    suggestedWorkarounds: [
      "Extend data collection period",
      "Use smaller sample size",
      "Find secondary data sources",
    ],
    estimatedResolutionDays: 7,
  },
  {
    id: "health-personal",
    title: "Health or personal circumstances",
    description: "Unable to work due to health or personal reasons",
    category: "health_personal",
    defaultSeverity: "medium",
    suggestedWorkarounds: [
      "Focus on recovery first",
      "Delegate research tasks if possible",
      "Request deadline extension if needed",
    ],
    estimatedResolutionDays: 5,
  },
];

// Risk suggestions by subject
export const RISK_SUGGESTIONS: RiskSuggestion[] = [
  // Physics
  {
    id: "physics-lab",
    forSubject: "physics",
    title: "Lab equipment availability conflict",
    description:
      "Physics labs are shared - equipment may be unavailable when needed",
    category: "resource",
    defaultProbability: "medium",
    defaultImpact: "major",
    mitigationSuggestion: "Reserve lab equipment at least 2 weeks in advance",
    contingencySuggestion: "Prepare simulation-based alternative methodology",
  },
  {
    id: "physics-data",
    forSubject: "physics",
    forPhase: "research",
    title: "Experimental data insufficient",
    description: "Initial experiments may not yield usable data",
    category: "technical_issue",
    defaultProbability: "medium",
    defaultImpact: "major",
    mitigationSuggestion: "Plan for 2-3 data collection attempts",
    contingencySuggestion: "Have backup research question ready",
  },
  // Math
  {
    id: "math-complexity",
    forSubject: "math",
    title: "Mathematical concept too complex",
    description: "Chosen topic may require math beyond current skill level",
    category: "knowledge_gap",
    defaultProbability: "medium",
    defaultImpact: "major",
    mitigationSuggestion: "Consult teacher early about scope",
    contingencySuggestion: "Have simpler alternative exploration ready",
  },
  // History
  {
    id: "history-sources",
    forSubject: "history",
    forPhase: "research",
    title: "Primary sources difficult to access",
    description: "May need interlibrary loan or archive access",
    category: "external_dependency",
    defaultProbability: "high",
    defaultImpact: "moderate",
    mitigationSuggestion: "Identify sources early and request immediately",
    contingencySuggestion: "Use digital archives as fallback",
  },
  // Economics
  {
    id: "econ-articles",
    forSubject: "economics",
    forPhase: "research",
    title: "Suitable current news article hard to find",
    description:
      "Finding an article that clearly demonstrates economic concepts",
    category: "external_dependency",
    defaultProbability: "low",
    defaultImpact: "minor",
    mitigationSuggestion:
      "Start collecting articles early from multiple sources",
    contingencySuggestion: "Keep backup articles for each commentary",
  },
  // English
  {
    id: "english-text",
    forSubject: "english",
    title: "Primary text interpretation challenges",
    description: "Chosen text may be more complex than anticipated",
    category: "knowledge_gap",
    defaultProbability: "medium",
    defaultImpact: "moderate",
    mitigationSuggestion: "Read critical analyses before starting",
    contingencySuggestion: "Narrow focus to specific passage if needed",
  },
];

// Calculate risk score (1-16 scale)
export function calculateRiskScore(
  probability: RiskProbability,
  impact: RiskImpact,
): number {
  const probValues: Record<RiskProbability, number> = {
    low: 1,
    medium: 2,
    high: 3,
    very_high: 4,
  };
  const impactValues: Record<RiskImpact, number> = {
    minor: 1,
    moderate: 2,
    major: 3,
    severe: 4,
  };
  return probValues[probability] * impactValues[impact];
}
