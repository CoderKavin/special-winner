// IB Deadline Management System Types

export type IAStatus = 'not_started' | 'in_progress' | 'overdue' | 'completed';

export type SubjectColor = 'math' | 'physics' | 'economics' | 'english' | 'history';

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

export interface AppState {
  ias: IA[];
  ee: ExtendedEssay;
  masterDeadline: string;
  weeklyHoursBudget: number;
  googleCalendarEventIds: Record<string, string>;
  lastCalendarSync: string | null;
  completedMilestones: string[];
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
  type: 'overload' | 'overlap' | 'overdue' | 'deadline_risk' | 'insufficient_time';
  message: string;
  severity: 'warning' | 'error';
  affectedIds: string[];
}

export interface AIGeneratedMilestone {
  milestone_name: string;
  description: string;
  estimated_hours: number;
  dependencies: string[];
}

// Initial hardcoded data
export const INITIAL_IAS: IA[] = [
  {
    id: 'math',
    name: 'Math AA HL IA',
    wordCount: 2200,
    type: 'Mathematical Exploration',
    status: 'not_started',
    subjectColor: 'math',
    milestones: [],
  },
  {
    id: 'physics',
    name: 'Physics HL IA',
    wordCount: 2200,
    type: 'Scientific Investigation',
    status: 'not_started',
    subjectColor: 'physics',
    milestones: [],
  },
  {
    id: 'econ-micro',
    name: 'Economics Commentary 1: Microeconomics',
    wordCount: 800,
    type: 'News Commentary',
    status: 'not_started',
    subjectColor: 'economics',
    milestones: [],
  },
  {
    id: 'econ-macro',
    name: 'Economics Commentary 2: Macroeconomics',
    wordCount: 800,
    type: 'News Commentary',
    status: 'not_started',
    subjectColor: 'economics',
    milestones: [],
  },
  {
    id: 'econ-intl',
    name: 'Economics Commentary 3: International Economics',
    wordCount: 800,
    type: 'News Commentary',
    status: 'not_started',
    subjectColor: 'economics',
    milestones: [],
  },
  {
    id: 'english',
    name: 'English Lang & Lit SL IA',
    wordCount: 1500,
    type: 'Literary Analysis',
    status: 'not_started',
    subjectColor: 'english',
    milestones: [],
  },
  {
    id: 'history',
    name: 'History SL IA',
    wordCount: 2200,
    type: 'Historical Investigation',
    status: 'not_started',
    subjectColor: 'history',
    milestones: [],
  },
];

export const INITIAL_EE: ExtendedEssay = {
  name: 'Extended Essay',
  wordCount: 4000,
  subject: 'TBD',
  targetDeadline: '2026-03-31',
  status: 'not_started',
  milestones: [],
};

export const INITIAL_STATE: AppState = {
  ias: INITIAL_IAS,
  ee: INITIAL_EE,
  masterDeadline: '2025-12-31',
  weeklyHoursBudget: 6,
  googleCalendarEventIds: {},
  lastCalendarSync: null,
  completedMilestones: [],
};

export const SUBJECT_COLORS: Record<SubjectColor, { bg: string; border: string; text: string }> = {
  math: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500',
    text: 'text-blue-400',
  },
  physics: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500',
    text: 'text-purple-400',
  },
  economics: {
    bg: 'bg-green-500/20',
    border: 'border-green-500',
    text: 'text-green-400',
  },
  english: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500',
    text: 'text-orange-400',
  },
  history: {
    bg: 'bg-red-500/20',
    border: 'border-red-500',
    text: 'text-red-400',
  },
};
