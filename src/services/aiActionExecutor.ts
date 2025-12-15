/**
 * AI Action Executor
 * Executes actions returned by the Gemini AI assistant
 */

import type { AppState, IA, Milestone, Blocker, WorkSession } from "../types";
import type { AIAction } from "./geminiAssistant";
import { addToUndoStack } from "./geminiAssistant";

// ============================================
// ACTION RESULT TYPE
// ============================================

export interface ActionResult {
  success: boolean;
  message: string;
  changes?: string[];
  error?: string;
  undoId?: string;
}

// ============================================
// STATE UPDATER CALLBACKS
// ============================================

export interface StateUpdaters {
  updateIA: (iaId: string, updates: Partial<IA>) => void;
  updateMilestone: (
    iaId: string,
    milestoneId: string,
    updates: Partial<Milestone>,
  ) => void;
  addBlocker: (blocker: Blocker) => void;
  updateBlocker: (blockerId: string, updates: Partial<Blocker>) => void;
  updateMasterDeadline: (deadline: string) => void;
  updateWeeklyBudget: (hours: number) => void;
  addWorkSession: (session: WorkSession) => void;
  startTimer: (iaId: string, milestoneId: string) => void;
  stopTimer: (note?: string) => void;
  refreshState: () => AppState;
}

// ============================================
// MAIN EXECUTOR
// ============================================

export async function executeAIAction(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case "mark_milestone_complete":
        return await executeMilestoneComplete(action, state, updaters);

      case "reschedule_milestone":
        return await executeRescheduleMilestone(action, state, updaters);

      case "log_time":
        return await executeLogTime(action, state, updaters);

      case "pause_schedule":
        return await executePauseSchedule(action, state, updaters);

      case "extend_deadline":
        return await executeExtendDeadline(action, state, updaters);

      case "optimize_schedule":
        return await executeOptimizeSchedule(action, state, updaters);

      case "add_blocker":
        return await executeAddBlocker(action, state, updaters);

      case "resolve_blocker":
        return await executeResolveBlocker(action, state, updaters);

      case "update_settings":
        return await executeUpdateSettings(action, state, updaters);

      case "start_timer":
        return await executeStartTimer(action, state, updaters);

      case "stop_timer":
        return await executeStopTimer(action, state, updaters);

      // Query actions (no state changes)
      case "calculate_timeline":
      case "find_conflicts":
      case "suggest_optimizations":
        return { success: true, message: "Query executed (no changes made)" };

      default:
        return {
          success: false,
          message: "Unknown action",
          error: `Unknown action type: ${action.type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: "Action failed",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ============================================
// ACTION IMPLEMENTATIONS
// ============================================

async function executeMilestoneComplete(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { milestoneId, iaId, actualHours } = action.params as {
    milestoneId: string;
    iaId: string;
    actualHours?: number;
  };

  const ia = state.ias.find((i) => i.id === iaId);
  if (!ia) {
    return {
      success: false,
      message: "IA not found",
      error: `IA not found: ${iaId}`,
    };
  }

  const milestone = ia.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    return {
      success: false,
      message: "Milestone not found",
      error: `Milestone not found: ${milestoneId}`,
    };
  }

  if (milestone.completed) {
    return {
      success: false,
      message: "Milestone already completed",
      error: `Milestone already completed: ${milestone.milestone_name}`,
    };
  }

  // Save previous state for undo
  const previousState = {
    completed: milestone.completed,
    completedAt: milestone.completedAt,
    actualHours: milestone.actualHours,
  };

  // Update milestone
  const updates: Partial<Milestone> = {
    completed: true,
    completedAt: new Date().toISOString(),
  };

  if (typeof actualHours === "number") {
    updates.actualHours = (milestone.actualHours || 0) + actualHours;

    // Also log a work session
    const session: WorkSession = {
      id: crypto.randomUUID(),
      milestoneId,
      startTime: new Date(
        Date.now() - actualHours * 60 * 60 * 1000,
      ).toISOString(),
      endTime: new Date().toISOString(),
      duration: actualHours * 60, // Convert to minutes
      note: "Logged via AI assistant",
    };
    updaters.addWorkSession(session);
  }

  updaters.updateMilestone(iaId, milestoneId, updates);

  // Add to undo stack
  const undoId = addToUndoStack(
    action,
    previousState,
    `Complete ${milestone.milestone_name}`,
  );

  // Check if all milestones are complete
  const remainingMilestones = ia.milestones.filter(
    (m) => !m.completed && m.id !== milestoneId,
  );
  const changes = [`Marked "${milestone.milestone_name}" as complete`];

  if (actualHours) {
    changes.push(`Logged ${actualHours} hours`);
  }

  if (remainingMilestones.length === 0) {
    updaters.updateIA(iaId, { status: "completed" });
    changes.push(`${ia.name} is now complete!`);
  }

  return {
    success: true,
    message: `Completed ${milestone.milestone_name}`,
    changes,
    undoId,
  };
}

async function executeRescheduleMilestone(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { milestoneId, iaId, newDeadline } = action.params as {
    milestoneId: string;
    iaId: string;
    newDeadline: string;
  };

  const ia = state.ias.find((i) => i.id === iaId);
  if (!ia) {
    return {
      success: false,
      message: "IA not found",
      error: `IA not found: ${iaId}`,
    };
  }

  const milestone = ia.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    return {
      success: false,
      message: "Milestone not found",
      error: `Milestone not found: ${milestoneId}`,
    };
  }

  // Save previous state for undo
  const previousState = {
    deadline: milestone.deadline,
    startDate: milestone.startDate,
  };

  const oldDeadline = milestone.deadline;

  // Calculate days shifted
  const oldDate = new Date(oldDeadline);
  const newDate = new Date(newDeadline);
  const daysShifted = Math.round(
    (newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Update deadline
  updaters.updateMilestone(iaId, milestoneId, { deadline: newDeadline });

  // Add to undo stack
  const undoId = addToUndoStack(
    action,
    previousState,
    `Reschedule ${milestone.milestone_name}`,
  );

  return {
    success: true,
    message: `Rescheduled ${milestone.milestone_name}`,
    changes: [
      `Moved deadline from ${oldDeadline} to ${newDeadline}`,
      `Shifted by ${daysShifted > 0 ? "+" : ""}${daysShifted} days`,
    ],
    undoId,
  };
}

async function executeLogTime(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { milestoneId, iaId, hours, notes } = action.params as {
    milestoneId: string;
    iaId: string;
    hours: number;
    notes?: string;
  };

  const ia = state.ias.find((i) => i.id === iaId);
  if (!ia) {
    return {
      success: false,
      message: "IA not found",
      error: `IA not found: ${iaId}`,
    };
  }

  const milestone = ia.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    return {
      success: false,
      message: "Milestone not found",
      error: `Milestone not found: ${milestoneId}`,
    };
  }

  // Create work session
  const session: WorkSession = {
    id: crypto.randomUUID(),
    milestoneId,
    startTime: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
    endTime: new Date().toISOString(),
    duration: hours * 60,
    note: notes || "Logged via AI assistant",
  };

  updaters.addWorkSession(session);

  // Update milestone actual hours
  const newActualHours = (milestone.actualHours || 0) + hours;
  updaters.updateMilestone(iaId, milestoneId, { actualHours: newActualHours });

  // Save for undo
  const previousState = { actualHours: milestone.actualHours || 0 };
  const undoId = addToUndoStack(
    action,
    previousState,
    `Log ${hours}h on ${milestone.milestone_name}`,
  );

  return {
    success: true,
    message: `Logged ${hours} hours on ${milestone.milestone_name}`,
    changes: [
      `Added ${hours}h to ${milestone.milestone_name}`,
      `Total: ${newActualHours.toFixed(1)}h / ${milestone.estimated_hours}h estimated`,
    ],
    undoId,
  };
}

async function executePauseSchedule(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { days } = action.params as { days: number };

  const previousState: Record<string, { deadline: string; startDate: string }> =
    {};
  const changes: string[] = [];
  let milestonesShifted = 0;

  // Shift all incomplete milestones
  for (const ia of state.ias) {
    for (const milestone of ia.milestones) {
      if (milestone.completed) continue;

      previousState[`${ia.id}:${milestone.id}`] = {
        deadline: milestone.deadline,
        startDate: milestone.startDate,
      };

      const newDeadline = new Date(milestone.deadline);
      newDeadline.setDate(newDeadline.getDate() + days);

      const newStartDate = new Date(milestone.startDate);
      newStartDate.setDate(newStartDate.getDate() + days);

      updaters.updateMilestone(ia.id, milestone.id, {
        deadline: newDeadline.toISOString().split("T")[0],
        startDate: newStartDate.toISOString().split("T")[0],
      });

      milestonesShifted++;
    }
  }

  // Also shift master deadline
  const oldMasterDeadline = state.masterDeadline;
  const newMasterDeadline = new Date(state.masterDeadline);
  newMasterDeadline.setDate(newMasterDeadline.getDate() + days);
  updaters.updateMasterDeadline(newMasterDeadline.toISOString().split("T")[0]);

  previousState["masterDeadline"] = {
    deadline: oldMasterDeadline,
    startDate: "",
  };

  const undoId = addToUndoStack(
    action,
    previousState,
    `Pause schedule for ${days} days`,
  );

  changes.push(`Shifted ${milestonesShifted} milestones by ${days} days`);
  changes.push(
    `Master deadline moved from ${oldMasterDeadline} to ${newMasterDeadline.toISOString().split("T")[0]}`,
  );

  return {
    success: true,
    message: `Paused schedule for ${days} days`,
    changes,
    undoId,
  };
}

async function executeExtendDeadline(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { newDeadline } = action.params as { newDeadline: string };

  const previousState = { masterDeadline: state.masterDeadline };
  const oldDeadline = state.masterDeadline;

  updaters.updateMasterDeadline(newDeadline);

  const undoId = addToUndoStack(
    action,
    previousState,
    `Extend master deadline`,
  );

  const oldDate = new Date(oldDeadline);
  const newDate = new Date(newDeadline);
  const daysExtended = Math.round(
    (newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    success: true,
    message: `Extended master deadline to ${newDeadline}`,
    changes: [
      `Master deadline changed from ${oldDeadline} to ${newDeadline}`,
      `Extended by ${daysExtended} days`,
    ],
    undoId,
  };
}

async function executeOptimizeSchedule(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { optimizationType } = action.params as {
    optimizationType:
      | "auto-fix-all"
      | "extend_deadline"
      | "increase_hours"
      | "rebalance";
  };

  const changes: string[] = [];
  const now = new Date();

  switch (optimizationType) {
    case "auto-fix-all": {
      // Find overdue milestones and reschedule them
      let rescheduled = 0;
      for (const ia of state.ias) {
        for (const milestone of ia.milestones) {
          if (milestone.completed) continue;

          const deadline = new Date(milestone.deadline);
          if (deadline < now) {
            // Reschedule to 7 days from now
            const newDeadline = new Date();
            newDeadline.setDate(newDeadline.getDate() + 7 + rescheduled * 3);

            updaters.updateMilestone(ia.id, milestone.id, {
              deadline: newDeadline.toISOString().split("T")[0],
            });
            rescheduled++;
          }
        }
      }
      changes.push(`Rescheduled ${rescheduled} overdue milestones`);
      break;
    }

    case "extend_deadline": {
      // Extend master deadline by 2 weeks
      const newMasterDeadline = new Date(state.masterDeadline);
      newMasterDeadline.setDate(newMasterDeadline.getDate() + 14);
      updaters.updateMasterDeadline(
        newMasterDeadline.toISOString().split("T")[0],
      );
      changes.push(
        `Extended master deadline by 2 weeks to ${newMasterDeadline.toISOString().split("T")[0]}`,
      );
      break;
    }

    case "increase_hours": {
      // Increase weekly budget by 2 hours
      const newBudget = state.weeklyHoursBudget + 2;
      updaters.updateWeeklyBudget(newBudget);
      changes.push(
        `Increased weekly hours budget from ${state.weeklyHoursBudget}h to ${newBudget}h`,
      );
      break;
    }

    case "rebalance": {
      // Spread milestones more evenly
      const incompleteMilestones: Array<{ ia: IA; milestone: Milestone }> = [];
      for (const ia of state.ias) {
        for (const m of ia.milestones) {
          if (!m.completed) {
            incompleteMilestones.push({ ia, milestone: m });
          }
        }
      }

      // Sort by current deadline
      incompleteMilestones.sort(
        (a, b) =>
          new Date(a.milestone.deadline).getTime() -
          new Date(b.milestone.deadline).getTime(),
      );

      // Redistribute evenly
      const masterDeadline = new Date(state.masterDeadline);
      const daysRemaining = Math.ceil(
        (masterDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const interval = Math.floor(
        daysRemaining / (incompleteMilestones.length + 1),
      );

      incompleteMilestones.forEach(({ ia, milestone }, index) => {
        const newDeadline = new Date(now);
        newDeadline.setDate(newDeadline.getDate() + interval * (index + 1));

        updaters.updateMilestone(ia.id, milestone.id, {
          deadline: newDeadline.toISOString().split("T")[0],
        });
      });

      changes.push(
        `Rebalanced ${incompleteMilestones.length} milestones across ${daysRemaining} days`,
      );
      break;
    }
  }

  const undoId = addToUndoStack(
    action,
    {},
    `Optimize schedule: ${optimizationType}`,
  );

  return {
    success: true,
    message: `Schedule optimized (${optimizationType})`,
    changes,
    undoId,
  };
}

async function executeAddBlocker(
  action: AIAction,
  _state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { milestoneId, iaId, title, description, severity, category } =
    action.params as {
      milestoneId?: string;
      iaId: string;
      title: string;
      description?: string;
      severity?: "low" | "medium" | "high" | "critical";
      category?: string;
    };

  const blocker: Blocker = {
    id: crypto.randomUUID(),
    milestoneId: milestoneId || "",
    iaId,
    title,
    description: description || "",
    category: (category as Blocker["category"]) || "technical_issue",
    severity: severity || "medium",
    status: "active",
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    estimatedDelayDays:
      severity === "critical" ? 7 : severity === "high" ? 5 : 3,
    updates: [],
  };

  updaters.addBlocker(blocker);

  const undoId = addToUndoStack(
    action,
    { blockerId: blocker.id },
    `Add blocker: ${title}`,
  );

  return {
    success: true,
    message: `Added blocker: ${title}`,
    changes: [
      `Created ${severity || "medium"} severity blocker`,
      `Estimated delay: ${blocker.estimatedDelayDays} days`,
    ],
    undoId,
  };
}

async function executeResolveBlocker(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { blockerId, resolutionNotes } = action.params as {
    blockerId: string;
    resolutionNotes?: string;
  };

  const blocker = state.blockers.find((b) => b.id === blockerId);
  if (!blocker) {
    return {
      success: false,
      message: "Blocker not found",
      error: `Blocker not found: ${blockerId}`,
    };
  }

  const previousState = {
    status: blocker.status,
    resolvedAt: blocker.resolvedAt,
  };

  updaters.updateBlocker(blockerId, {
    status: "resolved",
    resolvedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    resolutionNotes: resolutionNotes || "Resolved via AI assistant",
  });

  const undoId = addToUndoStack(
    action,
    previousState,
    `Resolve blocker: ${blocker.title}`,
  );

  return {
    success: true,
    message: `Resolved blocker: ${blocker.title}`,
    changes: [`Blocker "${blocker.title}" marked as resolved`],
    undoId,
  };
}

async function executeUpdateSettings(
  action: AIAction,
  _state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { setting, value } = action.params as {
    setting: string;
    value: unknown;
  };

  const changes: string[] = [];

  switch (setting) {
    case "weeklyHoursBudget":
      if (typeof value === "number") {
        updaters.updateWeeklyBudget(value);
        changes.push(`Weekly hours budget updated to ${value}h`);
      }
      break;
    case "masterDeadline":
      if (typeof value === "string") {
        updaters.updateMasterDeadline(value);
        changes.push(`Master deadline updated to ${value}`);
      }
      break;
    default:
      return {
        success: false,
        message: "Unknown setting",
        error: `Unknown setting: ${setting}`,
      };
  }

  const undoId = addToUndoStack(action, {}, `Update setting: ${setting}`);

  return {
    success: true,
    message: `Updated ${setting}`,
    changes,
    undoId,
  };
}

async function executeStartTimer(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { milestoneId, iaId } = action.params as {
    milestoneId: string;
    iaId: string;
  };

  const ia = state.ias.find((i) => i.id === iaId);
  if (!ia) {
    return {
      success: false,
      message: "IA not found",
      error: `IA not found: ${iaId}`,
    };
  }

  const milestone = ia.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    return {
      success: false,
      message: "Milestone not found",
      error: `Milestone not found: ${milestoneId}`,
    };
  }

  if (state.activeTimer) {
    return {
      success: false,
      message: "Timer already running",
      error: "Timer already running. Stop it first.",
    };
  }

  updaters.startTimer(iaId, milestoneId);

  return {
    success: true,
    message: `Started timer for ${milestone.milestone_name}`,
    changes: [`Timer started for "${milestone.milestone_name}"`],
  };
}

async function executeStopTimer(
  action: AIAction,
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult> {
  const { note } = action.params as { note?: string };

  if (!state.activeTimer) {
    return {
      success: false,
      message: "No timer running",
      error: "No timer is currently running",
    };
  }

  const ia = state.ias.find((i) => i.id === state.activeTimer?.iaId);
  const milestone = ia?.milestones.find(
    (m) => m.id === state.activeTimer?.milestoneId,
  );

  updaters.stopTimer(note);

  return {
    success: true,
    message: `Stopped timer${milestone ? ` for ${milestone.milestone_name}` : ""}`,
    changes: [`Timer stopped and time logged`],
  };
}

// ============================================
// BATCH EXECUTOR
// ============================================

export async function executeAIActions(
  actions: AIAction[],
  state: AppState,
  updaters: StateUpdaters,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    const result = await executeAIAction(action, state, updaters);
    results.push(result);

    // Get fresh state after each action
    state = updaters.refreshState();

    // Stop on first error for dependent actions
    if (!result.success) {
      break;
    }
  }

  return results;
}

// ============================================
// ACTION PREVIEW GENERATOR
// ============================================

export function generateActionPreview(
  action: AIAction,
  state: AppState,
): { description: string; changes: string[]; warnings: string[] } {
  const changes: string[] = [];
  const warnings: string[] = [];
  let description = "";

  switch (action.type) {
    case "mark_milestone_complete": {
      const { milestoneId, iaId, actualHours } = action.params as {
        milestoneId: string;
        iaId: string;
        actualHours?: number;
      };
      const ia = state.ias.find((i) => i.id === iaId);
      const milestone = ia?.milestones.find((m) => m.id === milestoneId);

      description = `Complete "${milestone?.milestone_name || milestoneId}"`;
      changes.push(`Status: incomplete → complete`);
      if (actualHours) {
        changes.push(`Log ${actualHours} hours`);
      }

      // Check if this completes the IA
      if (ia && milestone) {
        const remaining = ia.milestones.filter(
          (m) => !m.completed && m.id !== milestoneId,
        );
        if (remaining.length === 0) {
          changes.push(`This will complete the entire ${ia.name}!`);
        }
      }
      break;
    }

    case "pause_schedule": {
      const { days } = action.params as { days: number };
      description = `Pause schedule for ${days} days`;

      let count = 0;
      for (const ia of state.ias) {
        count += ia.milestones.filter((m) => !m.completed).length;
      }

      changes.push(`Shift ${count} milestone deadlines by ${days} days`);
      changes.push(`Move master deadline by ${days} days`);
      warnings.push("This affects all incomplete milestones");
      break;
    }

    case "extend_deadline": {
      const { newDeadline } = action.params as { newDeadline: string };
      description = `Extend master deadline to ${newDeadline}`;

      const oldDate = new Date(state.masterDeadline);
      const newDate = new Date(newDeadline);
      const days = Math.round(
        (newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      changes.push(`Master deadline: ${state.masterDeadline} → ${newDeadline}`);
      changes.push(`${days > 0 ? "+" : ""}${days} days`);
      break;
    }

    case "optimize_schedule": {
      const { optimizationType } = action.params as {
        optimizationType: string;
      };
      description = `Optimize schedule (${optimizationType})`;

      switch (optimizationType) {
        case "auto-fix-all":
          changes.push("Reschedule all overdue milestones");
          changes.push("Rebalance workload");
          warnings.push("This will modify multiple milestone deadlines");
          break;
        case "extend_deadline":
          changes.push("Extend master deadline by 2 weeks");
          break;
        case "increase_hours":
          changes.push("Increase weekly hours budget");
          break;
        case "rebalance":
          changes.push("Redistribute milestones evenly");
          warnings.push("All milestone deadlines will change");
          break;
      }
      break;
    }

    default:
      description = action.type.replace(/_/g, " ");
  }

  return { description, changes, warnings };
}
