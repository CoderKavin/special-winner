/**
 * Enhanced Gemini AI Assistant Service
 * Full action execution capabilities for IB Deadline Manager
 */

import type { AppState, IA, Milestone } from "../types";

const GEMINI_API_KEY = "AIzaSyDmt5bvI8mXsFarINPQwpIwFVsaA5wGEXc";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ============================================
// AI ACTION TYPES
// ============================================

export interface AIAction {
  type: string;
  params: Record<string, unknown>;
}

export interface AIResponse {
  response: string;
  actions?: AIAction[];
  needsConfirmation?: boolean;
  showPreview?: boolean;
  quickActions?: Array<{
    label: string;
    action: string;
  }>;
}

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

// ============================================
// UNDO SYSTEM
// ============================================

export interface UndoEntry {
  id: string;
  action: AIAction;
  previousState: Record<string, unknown>;
  timestamp: string;
  description: string;
}

const undoStack: UndoEntry[] = [];
const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function addToUndoStack(
  action: AIAction,
  previousState: Record<string, unknown>,
  description: string,
): string {
  const entry: UndoEntry = {
    id: crypto.randomUUID(),
    action,
    previousState,
    timestamp: new Date().toISOString(),
    description,
  };
  undoStack.push(entry);

  // Clean up old entries
  const cutoff = Date.now() - UNDO_WINDOW_MS;
  while (
    undoStack.length > 0 &&
    new Date(undoStack[0].timestamp).getTime() < cutoff
  ) {
    undoStack.shift();
  }

  return entry.id;
}

export function getUndoStack(): UndoEntry[] {
  const cutoff = Date.now() - UNDO_WINDOW_MS;
  return undoStack.filter(
    (entry) => new Date(entry.timestamp).getTime() >= cutoff,
  );
}

export function popUndo(): UndoEntry | undefined {
  return undoStack.pop();
}

// ============================================
// SYSTEM INSTRUCTION BUILDER
// ============================================

interface AppContext {
  currentView: string;
  currentDate: string;
  currentTime: string;
}

function formatIAForContext(ia: IA): object {
  const completedMilestones = ia.milestones.filter((m) => m.completed).length;
  const totalMilestones = ia.milestones.length;
  const nextMilestone = ia.milestones.find((m) => !m.completed);

  return {
    id: ia.id,
    name: ia.name,
    status: ia.status,
    progress:
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0,
    completedMilestones,
    totalMilestones,
    nextMilestone: nextMilestone
      ? {
          id: nextMilestone.id,
          name: nextMilestone.milestone_name,
          deadline: nextMilestone.deadline,
          estimatedHours: nextMilestone.estimated_hours,
          phase: nextMilestone.phase || "research",
        }
      : null,
    milestones: ia.milestones.map((m) => ({
      id: m.id,
      name: m.milestone_name,
      deadline: m.deadline,
      startDate: m.startDate,
      estimatedHours: m.estimated_hours,
      actualHours: m.actualHours || 0,
      completed: m.completed,
      phase: m.phase || "research",
    })),
  };
}

function formatUpcomingMilestones(
  state: AppState,
  limit: number = 5,
): object[] {
  const now = new Date();
  const upcoming: Array<{ ia: IA; milestone: Milestone; daysUntil: number }> =
    [];

  for (const ia of state.ias) {
    for (const m of ia.milestones) {
      if (m.completed) continue;
      const deadline = new Date(m.deadline);
      const daysUntil = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil >= -7) {
        // Include up to 7 days overdue
        upcoming.push({ ia, milestone: m, daysUntil });
      }
    }
  }

  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  return upcoming.slice(0, limit).map(({ ia, milestone, daysUntil }) => ({
    id: milestone.id,
    iaId: ia.id,
    iaName: ia.name,
    name: milestone.milestone_name,
    deadline: milestone.deadline,
    daysUntilDeadline: daysUntil,
    estimatedHours: milestone.estimated_hours,
    actualHours: milestone.actualHours || 0,
    hoursRemaining: Math.max(
      0,
      milestone.estimated_hours - (milestone.actualHours || 0),
    ),
    status:
      daysUntil < 0 ? "overdue" : daysUntil === 0 ? "due_today" : "upcoming",
    phase: milestone.phase || "research",
  }));
}

function formatActiveBlockers(state: AppState): object[] {
  return state.blockers
    .filter((b) => b.status === "active")
    .map((b) => ({
      id: b.id,
      iaId: b.iaId,
      milestoneId: b.milestoneId,
      title: b.title,
      description: b.description,
      category: b.category,
      severity: b.severity,
      createdAt: b.createdAt,
      estimatedDelayDays: b.estimatedDelayDays,
    }));
}

function formatWarnings(state: AppState): object {
  const now = new Date();
  const critical: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // Check for overdue milestones
  let overdueCount = 0;
  for (const ia of state.ias) {
    for (const m of ia.milestones) {
      if (!m.completed && new Date(m.deadline) < now) {
        overdueCount++;
      }
    }
  }
  if (overdueCount > 0) {
    critical.push(`${overdueCount} milestone(s) are overdue`);
  }

  // Check for critical blockers
  const criticalBlockers = state.blockers.filter(
    (b) => b.status === "active" && b.severity === "critical",
  ).length;
  if (criticalBlockers > 0) {
    critical.push(
      `${criticalBlockers} critical blocker(s) need immediate attention`,
    );
  }

  // Check master deadline
  const masterDeadline = new Date(state.masterDeadline);
  const daysUntilMaster = Math.ceil(
    (masterDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntilMaster <= 14) {
    warnings.push(`Only ${daysUntilMaster} days until master deadline`);
  }

  // Check weekly hours
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const hoursThisWeek = state.allWorkSessions
    .filter((s) => new Date(s.startTime) >= weekStart)
    .reduce((sum, s) => sum + s.duration / 60, 0);

  if (hoursThisWeek < state.weeklyHoursBudget * 0.5) {
    info.push(
      `Only ${hoursThisWeek.toFixed(1)}h logged this week (budget: ${state.weeklyHoursBudget}h)`,
    );
  }

  return { critical, warnings, info };
}

function calculateScheduleStatus(state: AppState): object {
  const now = new Date();
  const masterDeadline = new Date(state.masterDeadline);
  const daysUntilDeadline = Math.ceil(
    (masterDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Calculate total remaining hours
  let totalRemainingHours = 0;
  let overdueHours = 0;

  for (const ia of state.ias) {
    for (const m of ia.milestones) {
      if (!m.completed) {
        const remaining = m.estimated_hours - (m.actualHours || 0);
        totalRemainingHours += Math.max(0, remaining);
        if (new Date(m.deadline) < now) {
          overdueHours += Math.max(0, remaining);
        }
      }
    }
  }

  const weeksRemaining = daysUntilDeadline / 7;
  const hoursPerWeekNeeded =
    weeksRemaining > 0
      ? totalRemainingHours / weeksRemaining
      : totalRemainingHours;
  const onTrack = hoursPerWeekNeeded <= state.weeklyHoursBudget * 1.2; // 20% buffer

  return {
    daysUntilDeadline,
    totalRemainingHours: Math.round(totalRemainingHours * 10) / 10,
    overdueHours: Math.round(overdueHours * 10) / 10,
    hoursPerWeekNeeded: Math.round(hoursPerWeekNeeded * 10) / 10,
    weeklyBudget: state.weeklyHoursBudget,
    onTrack,
    bufferRemaining:
      Math.round(
        (state.weeklyHoursBudget - hoursPerWeekNeeded) * weeksRemaining * 10,
      ) / 10,
  };
}

export function buildSystemInstruction(
  state: AppState,
  context: AppContext,
): string {
  const appStateData = {
    masterDeadline: state.masterDeadline,
    weeklyHoursBudget: state.weeklyHoursBudget,
    ias: state.ias.map(formatIAForContext),
    upcomingMilestones: formatUpcomingMilestones(state, 7),
    activeBlockers: formatActiveBlockers(state),
    warnings: formatWarnings(state),
    schedule: calculateScheduleStatus(state),
  };

  return `You are an AI assistant embedded in an IB deadline tracking app for a 17-year-old student named Kavin. You can read all app data and execute actions to modify schedules, complete milestones, and solve scheduling problems.

CURRENT CONTEXT:
View: ${context.currentView}
Date: ${context.currentDate}
Time: ${context.currentTime}

FULL APP STATE:
${JSON.stringify(appStateData, null, 2)}

YOUR CAPABILITIES:
Return structured JSON to execute actions. Available actions:

SCHEDULE ACTIONS:
- mark_milestone_complete: Complete a milestone and log time
  params: { milestoneId: string, iaId: string, actualHours?: number }
- reschedule_milestone: Change a milestone's deadline
  params: { milestoneId: string, iaId: string, newDeadline: string (YYYY-MM-DD) }
- pause_schedule: Shift all deadlines by X days
  params: { days: number }
- extend_deadline: Change master deadline
  params: { newDeadline: string (YYYY-MM-DD) }
- optimize_schedule: Run optimization algorithm
  params: { optimizationType: "auto-fix-all" | "extend_deadline" | "increase_hours" | "rebalance" }

DATA ACTIONS:
- log_time: Add time log to milestone
  params: { milestoneId: string, iaId: string, hours: number, notes?: string }
- add_blocker: Log an obstacle
  params: { milestoneId: string, iaId: string, title: string, description: string, severity: "low" | "medium" | "high" | "critical", category: string }
- resolve_blocker: Mark blocker as resolved
  params: { blockerId: string, resolutionNotes?: string }
- update_settings: Change app settings
  params: { setting: string, value: any }

QUERY ACTIONS (no state changes):
- calculate_timeline: Show "what if" scenarios without changing data
  params: { scenario: string }
- find_conflicts: Identify scheduling problems
  params: {}
- suggest_optimizations: Recommend improvements
  params: {}

RESPONSE FORMAT:
Always return valid JSON in this exact structure:
{
  "response": "Natural language explanation of what you're doing or answering",
  "actions": [
    {
      "type": "action_name",
      "params": {
        "param1": "value1"
      }
    }
  ],
  "needsConfirmation": true/false,
  "showPreview": true/false,
  "quickActions": [
    { "label": "Button text", "action": "message to send if clicked" }
  ]
}

RULES:
1. Use actual data from APP STATE - never hallucinate or make up information
2. For destructive actions (delete, major changes), set needsConfirmation: true
3. If request is ambiguous, ask clarifying questions (return empty actions array)
4. If impossible, explain why and suggest alternatives
5. Be direct and concise - 1-3 sentences for simple queries
6. Use context from current view to interpret "this" and "that"
7. Always explain what you're about to do before executing
8. Reference actual milestone and IA names from the data

EXAMPLE INTERACTIONS:

User: "How am I doing on History IA?"
{
  "response": "History IA is currently at X% progress with Y/Z milestones complete. [provide specific details from data]",
  "actions": []
}

User: "Mark Math outline as complete with 3 hours"
{
  "response": "Marking Math AA HL IA Outline as complete with 3 hours logged.",
  "actions": [
    {
      "type": "mark_milestone_complete",
      "params": {
        "milestoneId": "[actual id from data]",
        "iaId": "math",
        "actualHours": 3
      }
    }
  ],
  "needsConfirmation": true
}

User: "I'm sick, pause everything for 5 days"
{
  "response": "Pausing your entire schedule for 5 days. All deadlines will shift forward by 5 days.",
  "actions": [
    {
      "type": "pause_schedule",
      "params": { "days": 5 }
    }
  ],
  "needsConfirmation": true,
  "showPreview": true
}

User: "What should I work on now?"
{
  "response": "[Based on actual upcoming milestones from data, suggest the highest priority task with deadline and hours info]",
  "actions": [],
  "quickActions": [
    { "label": "Start Timer", "action": "start timer for [milestone name]" },
    { "label": "Log Time", "action": "log time on [milestone name]" }
  ]
}

PERSONALITY:
- Direct and honest (no corporate speak)
- Strategic and analytical (think like project manager)
- Supportive but realistic (acknowledge challenges, offer solutions)
- Concise (don't over-explain)
- Proactive (notice problems and suggest fixes)

Never say: "I'm just an AI", "I don't have access to", "I can't help with that"
If you can't do something, explain WHY and suggest what you CAN do.`;
}

// ============================================
// GEMINI API CALLER
// ============================================

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: {
    message: string;
  };
}

export async function sendToGemini(
  userMessage: string,
  conversationHistory: GeminiMessage[],
  state: AppState,
  currentView: string = "dashboard",
): Promise<AIResponse> {
  const now = new Date();
  const context: AppContext = {
    currentView,
    currentDate: now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    currentTime: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  const systemInstruction = buildSystemInstruction(state, context);

  // Build messages array
  const messages: GeminiMessage[] = [
    {
      role: "user",
      parts: [
        {
          text: `[SYSTEM INSTRUCTION - FOLLOW EXACTLY]\n${systemInstruction}\n\n[END SYSTEM INSTRUCTION]\n\nAcknowledge and respond only with JSON as specified.`,
        },
      ],
    },
    {
      role: "model",
      parts: [
        {
          text: `{"response": "I understand. I have access to your complete IB deadline data and will respond with structured JSON. How can I help you?", "actions": []}`,
        },
      ],
    },
    ...conversationHistory,
    {
      role: "user",
      parts: [{ text: userMessage }],
    },
  ];

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response generated");
    }

    const responseText = data.candidates[0].content.parts
      .map((part) => part.text)
      .join("");

    return parseGeminiResponse(responseText);
  } catch (error) {
    console.error("Gemini AI error:", error);

    // Return fallback response
    return {
      response: `I encountered an error processing your request. ${error instanceof Error ? error.message : "Please try again."}`,
      actions: [],
    };
  }
}

// ============================================
// RESPONSE PARSER
// ============================================

function parseGeminiResponse(responseText: string): AIResponse {
  try {
    // Try direct parse
    return JSON.parse(responseText);
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Continue to next attempt
      }
    }

    // Try finding any JSON object
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue to fallback
      }
    }

    // Fallback: treat as pure text response
    return {
      response: responseText,
      actions: [],
    };
  }
}

// ============================================
// ACTION VALIDATOR
// ============================================

const VALID_ACTION_TYPES = [
  "mark_milestone_complete",
  "reschedule_milestone",
  "log_time",
  "pause_schedule",
  "extend_deadline",
  "optimize_schedule",
  "add_blocker",
  "resolve_blocker",
  "update_settings",
  "calculate_timeline",
  "find_conflicts",
  "suggest_optimizations",
  "start_timer",
  "stop_timer",
];

export function validateAction(action: AIAction): {
  valid: boolean;
  error?: string;
} {
  if (!VALID_ACTION_TYPES.includes(action.type)) {
    return { valid: false, error: `Unknown action type: ${action.type}` };
  }

  // Validate required params for specific actions
  switch (action.type) {
    case "mark_milestone_complete":
      if (!action.params.milestoneId || !action.params.iaId) {
        return {
          valid: false,
          error: "mark_milestone_complete requires milestoneId and iaId",
        };
      }
      break;
    case "reschedule_milestone":
      if (
        !action.params.milestoneId ||
        !action.params.iaId ||
        !action.params.newDeadline
      ) {
        return {
          valid: false,
          error:
            "reschedule_milestone requires milestoneId, iaId, and newDeadline",
        };
      }
      break;
    case "log_time":
      if (
        !action.params.milestoneId ||
        !action.params.iaId ||
        typeof action.params.hours !== "number"
      ) {
        return {
          valid: false,
          error: "log_time requires milestoneId, iaId, and hours",
        };
      }
      break;
    case "pause_schedule":
      if (typeof action.params.days !== "number") {
        return { valid: false, error: "pause_schedule requires days (number)" };
      }
      break;
    case "extend_deadline":
      if (!action.params.newDeadline) {
        return { valid: false, error: "extend_deadline requires newDeadline" };
      }
      break;
    case "add_blocker":
      if (!action.params.title || !action.params.iaId) {
        return { valid: false, error: "add_blocker requires title and iaId" };
      }
      break;
    case "resolve_blocker":
      if (!action.params.blockerId) {
        return { valid: false, error: "resolve_blocker requires blockerId" };
      }
      break;
  }

  return { valid: true };
}

// ============================================
// PROACTIVE SUGGESTIONS
// ============================================

export interface ProactiveSuggestion {
  id: string;
  type: "warning" | "suggestion" | "reminder";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "urgent";
  suggestedAction?: string;
  quickActions?: Array<{ label: string; action: string }>;
}

export function generateProactiveSuggestions(
  state: AppState,
): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];
  const now = new Date();

  // Check for critical blockers
  const criticalBlockers = state.blockers.filter(
    (b) => b.status === "active" && b.severity === "critical",
  );
  if (criticalBlockers.length > 0) {
    suggestions.push({
      id: "critical-blockers",
      type: "warning",
      title: "Critical Blockers",
      message: `You have ${criticalBlockers.length} critical blocker(s) that need immediate attention.`,
      priority: "urgent",
      suggestedAction: "show my blockers",
      quickActions: [
        { label: "Show Blockers", action: "show my blockers" },
        { label: "Help Resolve", action: "help me resolve blockers" },
      ],
    });
  }

  // Check for overdue milestones
  let overdueCount = 0;
  for (const ia of state.ias) {
    for (const m of ia.milestones) {
      if (!m.completed && new Date(m.deadline) < now) {
        overdueCount++;
      }
    }
  }
  if (overdueCount > 0) {
    suggestions.push({
      id: "overdue-milestones",
      type: "warning",
      title: "Overdue Milestones",
      message: `${overdueCount} milestone(s) are past their deadline.`,
      priority: "high",
      quickActions: [
        { label: "Show Overdue", action: "what's overdue?" },
        { label: "Reschedule", action: "help me reschedule overdue items" },
      ],
    });
  }

  // Check weekly progress
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const hoursThisWeek = state.allWorkSessions
    .filter((s) => new Date(s.startTime) >= weekStart)
    .reduce((sum, s) => sum + s.duration / 60, 0);

  const dayOfWeek = now.getDay();
  const expectedProgress = (dayOfWeek / 7) * state.weeklyHoursBudget;

  if (dayOfWeek >= 3 && hoursThisWeek < expectedProgress * 0.5) {
    suggestions.push({
      id: "weekly-progress",
      type: "reminder",
      title: "Weekly Progress",
      message: `You've logged ${hoursThisWeek.toFixed(1)}h this week. Consider catching up to stay on track.`,
      priority: "medium",
      quickActions: [
        { label: "What Should I Work On?", action: "what should I work on?" },
        { label: "Start Working", action: "start timer for next task" },
      ],
    });
  }

  // Check master deadline
  const masterDeadline = new Date(state.masterDeadline);
  const daysUntilMaster = Math.ceil(
    (masterDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilMaster <= 30) {
    suggestions.push({
      id: "master-deadline",
      type: "warning",
      title: "Deadline Approaching",
      message: `Only ${daysUntilMaster} days until your master deadline!`,
      priority: daysUntilMaster <= 14 ? "urgent" : "high",
      quickActions: [
        { label: "Check Status", action: "how am I doing?" },
        { label: "Optimize Schedule", action: "optimize my schedule" },
      ],
    });
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
