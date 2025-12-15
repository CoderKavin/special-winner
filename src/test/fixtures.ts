/**
 * TEST FIXTURES
 * Mock data for comprehensive testing
 */

import type { IA, Milestone, AppState, WorkSession } from "../types";
import { INITIAL_STATE } from "../types";
import { format, addDays, addWeeks } from "date-fns";

// ============================================
// MOCK IAS
// ============================================

export const mockEconomicsMicroIA: IA = {
  id: "econ-micro",
  name: "Economics Commentary 1: Microeconomics",
  type: "commentary",
  wordCount: 800,
  status: "not_started",
  milestones: [],
};

export const mockEconomicsMacroIA: IA = {
  id: "econ-macro",
  name: "Economics Commentary 2: Macroeconomics",
  type: "commentary",
  wordCount: 800,
  status: "not_started",
  milestones: [],
};

export const mockMathIA: IA = {
  id: "math",
  name: "Math AA HL IA",
  type: "exploration",
  wordCount: 3000,
  status: "not_started",
  milestones: [],
};

export const mockPhysicsIA: IA = {
  id: "physics",
  name: "Physics HL IA",
  type: "investigation",
  wordCount: 2500,
  status: "not_started",
  milestones: [],
};

export const mockHistoryIA: IA = {
  id: "history",
  name: "History SL IA",
  type: "investigation",
  wordCount: 2200,
  status: "not_started",
  milestones: [],
};

export const mockEnglishIA: IA = {
  id: "english",
  name: "English Lang & Lit SL IA",
  type: "analysis",
  wordCount: 1500,
  status: "not_started",
  milestones: [],
};

export const mockAllIAs: IA[] = [
  mockEconomicsMicroIA,
  mockEconomicsMacroIA,
  {
    ...mockEconomicsMicroIA,
    id: "econ-intl",
    name: "Economics Commentary 3: International Economics",
  },
  mockMathIA,
  mockPhysicsIA,
  mockHistoryIA,
  mockEnglishIA,
];

// ============================================
// MOCK MILESTONES
// ============================================

const today = new Date();

export function createMockMilestone(
  iaId: string,
  index: number,
  overrides: Partial<Milestone> = {},
): Milestone {
  const phases = [
    "research",
    "outline",
    "draft",
    "revision",
    "polish",
  ] as const;
  const phaseNames = [
    "Research & Topic Selection",
    "Outline & Structure",
    "First Draft",
    "Revision & Refinement",
    "Final Polish",
  ];
  // Use realistic hours that match our actual estimates (total ~12h per IA average)
  const hours = [2, 1.5, 5, 2.5, 1];

  return {
    id: `${iaId}-milestone-${index}`,
    iaId,
    milestone_name: phaseNames[index] || `Milestone ${index + 1}`,
    description: `Description for ${phaseNames[index]}`,
    estimated_hours: hours[index] || 5,
    buffer_multiplier: 1.2,
    dependencies: index > 0 ? [phaseNames[index - 1]] : [],
    deadline: format(addWeeks(today, index + 2), "yyyy-MM-dd"),
    startDate: format(addWeeks(today, index + 1), "yyyy-MM-dd"),
    completed: false,
    phase: phases[index] || "research",
    workSessions: [],
    ...overrides,
  };
}

export function createMockMilestonesForIA(iaId: string): Milestone[] {
  return Array.from({ length: 5 }, (_, i) => createMockMilestone(iaId, i));
}

export const mockMilestonesWithProgress: Milestone[] = [
  createMockMilestone("history", 0, { completed: true, actualHours: 4 }),
  createMockMilestone("history", 1, { completed: true, actualHours: 2.5 }),
  createMockMilestone("history", 2, { completed: false }),
  createMockMilestone("history", 3, { completed: false }),
  createMockMilestone("history", 4, { completed: false }),
];

// ============================================
// MOCK WORK SESSIONS
// ============================================

export function createMockWorkSession(
  milestoneId: string,
  duration: number,
  daysAgo: number = 0,
): WorkSession {
  const sessionDate = addDays(today, -daysAgo);
  return {
    id: `session-${Date.now()}-${Math.random()}`,
    milestoneId,
    startTime: format(sessionDate, "yyyy-MM-dd'T'HH:mm:ss"),
    endTime: format(addDays(sessionDate, 0), "yyyy-MM-dd'T'HH:mm:ss"),
    duration,
    note: "Test session",
  };
}

// ============================================
// MOCK APP STATE
// ============================================

export const mockEmptyState: AppState = {
  ...INITIAL_STATE,
  masterDeadline: format(addWeeks(today, 26), "yyyy-MM-dd"), // 6 months out
  weeklyHoursBudget: 6,
};

export const mockStateWithIAs: AppState = {
  ...mockEmptyState,
  ias: mockAllIAs,
};

export const mockStateWithMilestones: AppState = {
  ...mockEmptyState,
  ias: mockAllIAs.map((ia) => ({
    ...ia,
    milestones: createMockMilestonesForIA(ia.id),
    status: "in_progress" as const,
  })),
};

export const mockStateWithProgress: AppState = {
  ...mockEmptyState,
  ias: [
    {
      ...mockHistoryIA,
      milestones: mockMilestonesWithProgress,
      status: "in_progress",
    },
    ...mockAllIAs.filter((ia) => ia.id !== "history"),
  ],
  completedMilestones: ["history-milestone-0", "history-milestone-1"],
  allWorkSessions: [
    createMockWorkSession("history-milestone-0", 240, 5),
    createMockWorkSession("history-milestone-1", 150, 2),
  ],
};

// ============================================
// EDGE CASE DATA
// ============================================

export const mockImpossibleDeadline = format(addDays(today, 3), "yyyy-MM-dd"); // 3 days from now
export const mockRealisticDeadline = format(addWeeks(today, 26), "yyyy-MM-dd"); // 6 months
export const mockFarFutureDeadline = format(addWeeks(today, 260), "yyyy-MM-dd"); // 5 years

export const mockVeryLongIAName = "A".repeat(150); // 150 character name

export const mockMinimalHours = 1; // 1 hour per week
export const mockExcessiveHours = 60; // 60 hours per week

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createMockStateWithDeadline(deadline: string): AppState {
  return {
    ...mockStateWithIAs,
    masterDeadline: deadline,
  };
}

export function createMockStateWithHours(hours: number): AppState {
  return {
    ...mockStateWithIAs,
    weeklyHoursBudget: hours,
  };
}

export function getTotalEstimatedHours(ias: IA[]): number {
  return ias.reduce((total, ia) => {
    const iaHours = ia.milestones.reduce(
      (sum, m) => sum + m.estimated_hours * m.buffer_multiplier,
      0,
    );
    return total + (iaHours || estimateIAHours(ia));
  }, 0);
}

function estimateIAHours(ia: IA): number {
  if (ia.id.startsWith("econ")) return 7 * 1.2;
  switch (ia.id) {
    case "math":
      return 19 * 1.2;
    case "physics":
      return 18 * 1.2;
    case "history":
      return 15 * 1.2;
    case "english":
      return 12 * 1.2;
    default:
      return 15 * 1.2;
  }
}
