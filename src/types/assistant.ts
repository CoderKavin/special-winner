// AI Assistant Types for IB Deadline Manager

import type {
  AppState,
  IA,
  Milestone,
  Blocker,
  SubjectColor,
  MilestonePhase,
  BlockerCategory,
  BlockerSeverity,
} from "./index";

// ============================================
// CONVERSATION & MESSAGE TYPES
// ============================================

export type MessageRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string; // ISO date
  // Optional metadata for assistant messages
  actions?: ExecutedAction[];
  suggestions?: AssistantSuggestion[];
  contextUsed?: ContextSnapshot;
}

export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  startedAt: string; // ISO date
  lastMessageAt: string; // ISO date
  // What view/context the conversation started from
  startContext: CurrentViewContext;
}

// ============================================
// CONTEXT AWARENESS TYPES
// ============================================

export type ViewType =
  | "dashboard"
  | "timeline"
  | "settings"
  | "ia_detail"
  | "blocker_modal"
  | "risk_modal";

export interface CurrentViewContext {
  view: ViewType;
  // Which IA is being viewed (if in detail view)
  focusedIAId?: string;
  // Which milestone is selected
  focusedMilestoneId?: string;
  // Which blocker is being viewed/edited
  focusedBlockerId?: string;
  // Active modal type
  activeModal?: string;
  // Current tab within a view
  activeTab?: string;
}

export interface ContextSnapshot {
  // Current UI state
  currentView: CurrentViewContext;
  // Full app state summary (not raw state, but processed insights)
  summary: AppStateSummary;
  // Relevant warnings/issues
  activeWarnings: ContextualWarning[];
  // Time context
  timestamp: string;
  daysUntilMasterDeadline: number;
}

export interface AppStateSummary {
  // IA overview
  totalIAs: number;
  completedIAs: number;
  inProgressIAs: number;
  overdueIAs: number;
  // Milestone overview
  totalMilestones: number;
  completedMilestones: number;
  upcomingMilestones: MilestoneSummary[];
  overdueMilestones: MilestoneSummary[];
  // Blocker overview
  activeBlockers: number;
  criticalBlockers: number;
  // Risk overview
  highPriorityRisks: number;
  // Time tracking
  hoursLoggedThisWeek: number;
  weeklyBudget: number;
  // Overall health
  projectHealthScore: number; // 0-100
  onTrackPercentage: number;
}

export interface MilestoneSummary {
  id: string;
  iaId: string;
  iaName: string;
  name: string;
  deadline: string;
  daysUntilDeadline: number;
  hoursRemaining: number;
  phase: MilestonePhase;
  isOverdue: boolean;
  hasBlocker: boolean;
}

export interface ContextualWarning {
  type: string;
  message: string;
  severity: "info" | "warning" | "error";
  relatedEntityId?: string;
  relatedEntityType?: "ia" | "milestone" | "blocker" | "risk";
}

// ============================================
// USER INTENT TYPES
// ============================================

export type IntentCategory =
  // Information queries
  | "query_status" // "How am I doing?" "What's overdue?"
  | "query_schedule" // "What's due this week?" "When is X due?"
  | "query_time" // "How much time have I logged?" "Am I on track?"
  | "query_blockers" // "What's blocking me?" "Show blockers"
  | "query_risks" // "What risks should I worry about?"
  // Actions
  | "create_milestone" // "Add a milestone for research"
  | "update_milestone" // "Mark X as complete" "Change deadline"
  | "create_blocker" // "I'm stuck because..."
  | "update_blocker" // "Resolve blocker" "Add update"
  | "create_risk" // "Add risk about..."
  | "update_risk" // "Update risk status"
  | "log_time" // "Log 2 hours on..." "I worked on..."
  | "reschedule" // "Push X back" "Move deadline"
  // Analysis
  | "analyze_schedule" // "Optimize my schedule" "Find conflicts"
  | "analyze_progress" // "Am I going to finish on time?"
  | "suggest_next" // "What should I work on?" "Prioritize"
  // General
  | "help" // "What can you do?" "Help"
  | "clarify" // User is answering a clarifying question
  | "confirm" // User is confirming an action
  | "cancel" // User is canceling an action
  | "unknown"; // Intent not recognized

export interface ParsedIntent {
  category: IntentCategory;
  confidence: number; // 0-1
  // Extracted entities
  entities: ExtractedEntities;
  // Original user message
  originalMessage: string;
  // Whether action requires confirmation
  requiresConfirmation: boolean;
  // Ambiguities that need clarification
  ambiguities?: string[];
}

export interface ExtractedEntities {
  // IA references
  iaIds?: string[];
  iaNames?: string[];
  subjectColors?: SubjectColor[];
  // Milestone references
  milestoneIds?: string[];
  milestoneNames?: string[];
  phases?: MilestonePhase[];
  // Time references
  dates?: string[];
  durations?: number[]; // hours
  deadlines?: string[];
  // Blocker/Risk references
  blockerIds?: string[];
  riskIds?: string[];
  blockerCategories?: BlockerCategory[];
  severities?: BlockerSeverity[];
  // Status changes
  targetStatus?: string;
  completed?: boolean;
  // Numeric values
  hours?: number;
  days?: number;
  // Text content
  title?: string;
  description?: string;
  notes?: string;
}

// ============================================
// ACTION TYPES
// ============================================

export type ActionType =
  // Milestone actions
  | "complete_milestone"
  | "uncomplete_milestone"
  | "update_milestone_deadline"
  | "update_milestone_hours"
  | "create_milestone"
  // IA actions
  | "update_ia_status"
  | "generate_ia_plan"
  // Blocker actions
  | "create_blocker"
  | "resolve_blocker"
  | "update_blocker"
  | "escalate_blocker"
  // Risk actions
  | "create_risk"
  | "update_risk"
  | "materialize_risk"
  | "dismiss_risk"
  // Time tracking actions
  | "log_time"
  | "start_timer"
  | "stop_timer"
  // Schedule actions
  | "reschedule_milestone"
  | "optimize_schedule"
  // Navigation actions
  | "navigate_to_view"
  | "open_ia_detail"
  | "open_blocker_modal";

export interface ActionPayload {
  type: ActionType;
  // Target entity IDs
  iaId?: string;
  milestoneId?: string;
  blockerId?: string;
  riskId?: string;
  // Action-specific data
  data?: Record<string, unknown>;
}

export interface ActionPreview {
  action: ActionPayload;
  description: string;
  // What will change
  changes: ChangePreview[];
  // Potential side effects
  sideEffects?: string[];
  // Warnings about this action
  warnings?: string[];
  // Is this reversible?
  reversible: boolean;
}

export interface ChangePreview {
  entityType: "ia" | "milestone" | "blocker" | "risk" | "setting";
  entityId: string;
  entityName: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface ExecutedAction {
  id: string;
  payload: ActionPayload;
  executedAt: string;
  success: boolean;
  error?: string;
  changes: ChangePreview[];
}

// ============================================
// ASSISTANT RESPONSE TYPES
// ============================================

export interface AssistantSuggestion {
  id: string;
  type: "action" | "insight" | "reminder" | "tip";
  title: string;
  description: string;
  // If this is an actionable suggestion
  action?: ActionPayload;
  // Priority level
  priority: "low" | "medium" | "high";
  // Related entities
  relatedIAId?: string;
  relatedMilestoneId?: string;
}

export interface AssistantResponse {
  // The main text response
  message: string;
  // Actions to execute (if user confirms)
  pendingActions?: ActionPreview[];
  // Proactive suggestions
  suggestions?: AssistantSuggestion[];
  // Follow-up questions for clarification
  clarificationNeeded?: string[];
  // Quick action buttons to show
  quickActions?: QuickAction[];
  // Whether we're waiting for user confirmation
  awaitingConfirmation: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  action: ActionPayload;
  variant: "primary" | "secondary" | "danger";
}

// ============================================
// PROACTIVE ASSISTANCE TYPES
// ============================================

export type ProactiveEventType =
  | "deadline_approaching"
  | "milestone_overdue"
  | "blocker_stale"
  | "schedule_conflict"
  | "workload_imbalance"
  | "energy_mismatch"
  | "risk_materializing"
  | "milestone_completed"
  | "long_session_reminder";

export interface ProactiveNotification {
  id: string;
  type: ProactiveEventType;
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  // Suggested action
  suggestedAction?: ActionPayload;
  suggestedActionLabel?: string;
  // Related entities
  relatedIAId?: string;
  relatedMilestoneId?: string;
  relatedBlockerId?: string;
  // Whether user has dismissed this
  dismissed: boolean;
  dismissedAt?: string;
}

// ============================================
// ASSISTANT STATE TYPES
// ============================================

export interface AssistantState {
  // Is the assistant panel open
  isOpen: boolean;
  // Current conversation
  conversation: Conversation | null;
  // Pending actions waiting for confirmation
  pendingActions: ActionPreview[];
  // Active notifications
  notifications: ProactiveNotification[];
  // Is the assistant currently processing
  isProcessing: boolean;
  // Last error if any
  lastError?: string;
  // User preferences
  preferences: AssistantPreferences;
}

export interface AssistantPreferences {
  // Show proactive notifications
  enableProactiveAssistance: boolean;
  // Notification priority threshold
  minNotificationPriority: "low" | "medium" | "high" | "urgent";
  // Keyboard shortcut to open
  keyboardShortcut: string;
  // Position of floating button
  floatingButtonPosition: "bottom-right" | "bottom-left";
  // Show in header
  showInHeader: boolean;
}

export const DEFAULT_ASSISTANT_PREFERENCES: AssistantPreferences = {
  enableProactiveAssistance: true,
  minNotificationPriority: "medium",
  keyboardShortcut: "Cmd+K",
  floatingButtonPosition: "bottom-right",
  showInHeader: true,
};

// ============================================
// CONTEXT BUILDER HELPERS
// ============================================

export interface ContextBuilderInput {
  state: AppState;
  currentView: CurrentViewContext;
  focusedIA?: IA;
  focusedMilestone?: Milestone;
  focusedBlocker?: Blocker;
}

// Function to build context snapshot
export function buildContextSnapshot(
  input: ContextBuilderInput,
): ContextSnapshot {
  const { state, currentView } = input;
  const now = new Date();
  const masterDeadline = new Date(state.masterDeadline);
  const daysUntilMasterDeadline = Math.ceil(
    (masterDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Calculate summaries
  const completedIAs = state.ias.filter(
    (ia) => ia.status === "completed",
  ).length;
  const inProgressIAs = state.ias.filter(
    (ia) => ia.status === "in_progress",
  ).length;
  const overdueIAs = state.ias.filter((ia) => ia.status === "overdue").length;

  const allMilestones = state.ias.flatMap((ia) => ia.milestones);
  const completedMilestones = allMilestones.filter((m) => m.completed).length;

  const upcomingMilestones: MilestoneSummary[] = [];
  const overdueMilestones: MilestoneSummary[] = [];

  for (const ia of state.ias) {
    for (const m of ia.milestones) {
      if (m.completed) continue;
      const deadline = new Date(m.deadline);
      const daysUntil = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const summary: MilestoneSummary = {
        id: m.id,
        iaId: ia.id,
        iaName: ia.name,
        name: m.milestone_name,
        deadline: m.deadline,
        daysUntilDeadline: daysUntil,
        hoursRemaining:
          m.estimated_hours * m.buffer_multiplier - (m.actualHours || 0),
        phase: m.phase || "research",
        isOverdue: daysUntil < 0,
        hasBlocker: state.blockers.some(
          (b) => b.milestoneId === m.id && b.status === "active",
        ),
      };

      if (daysUntil < 0) {
        overdueMilestones.push(summary);
      } else if (daysUntil <= 7) {
        upcomingMilestones.push(summary);
      }
    }
  }

  // Sort by deadline
  upcomingMilestones.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
  overdueMilestones.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);

  const activeBlockers = state.blockers.filter(
    (b) => b.status === "active",
  ).length;
  const criticalBlockers = state.blockers.filter(
    (b) => b.status === "active" && b.severity === "critical",
  ).length;

  const highPriorityRisks = state.risks.filter(
    (r) => r.status !== "avoided" && r.riskScore >= 9,
  ).length;

  // Calculate hours logged this week
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const hoursLoggedThisWeek = state.allWorkSessions
    .filter((s) => new Date(s.startTime) >= weekStart)
    .reduce((sum, s) => sum + s.duration / 60, 0);

  // Calculate project health score
  const onTrack = allMilestones.filter((m) => {
    if (m.completed) return true;
    const deadline = new Date(m.deadline);
    return deadline >= now;
  }).length;
  const onTrackPercentage =
    allMilestones.length > 0
      ? Math.round((onTrack / allMilestones.length) * 100)
      : 100;

  let projectHealthScore = onTrackPercentage;
  projectHealthScore -= criticalBlockers * 10;
  projectHealthScore -= overdueMilestones.length * 5;
  projectHealthScore = Math.max(0, Math.min(100, projectHealthScore));

  const summary: AppStateSummary = {
    totalIAs: state.ias.length,
    completedIAs,
    inProgressIAs,
    overdueIAs,
    totalMilestones: allMilestones.length,
    completedMilestones,
    upcomingMilestones: upcomingMilestones.slice(0, 5),
    overdueMilestones: overdueMilestones.slice(0, 5),
    activeBlockers,
    criticalBlockers,
    highPriorityRisks,
    hoursLoggedThisWeek: Math.round(hoursLoggedThisWeek * 10) / 10,
    weeklyBudget: state.weeklyHoursBudget,
    projectHealthScore,
    onTrackPercentage,
  };

  // Build warnings
  const activeWarnings: ContextualWarning[] = [];

  if (criticalBlockers > 0) {
    activeWarnings.push({
      type: "critical_blocker",
      message: `${criticalBlockers} critical blocker(s) require immediate attention`,
      severity: "error",
    });
  }

  if (overdueMilestones.length > 0) {
    activeWarnings.push({
      type: "overdue_milestones",
      message: `${overdueMilestones.length} milestone(s) are overdue`,
      severity: "error",
    });
  }

  if (daysUntilMasterDeadline <= 30) {
    activeWarnings.push({
      type: "deadline_approaching",
      message: `Only ${daysUntilMasterDeadline} days until master deadline`,
      severity: daysUntilMasterDeadline <= 14 ? "error" : "warning",
    });
  }

  return {
    currentView,
    summary,
    activeWarnings,
    timestamp: now.toISOString(),
    daysUntilMasterDeadline,
  };
}
