/**
 * Action Executor Service
 * Executes actions on behalf of the AI assistant
 */

import type {
  AppState,
  IA,
  Blocker,
  Risk,
  ActionPayload,
  ActionPreview,
  ChangePreview,
  BlockerCategory,
  BlockerSeverity,
  RiskProbability,
  RiskImpact,
} from "../types";
import { calculateRiskScore } from "../types";

// ============================================
// ACTION HANDLERS TYPE
// ============================================

export interface ActionHandlers {
  // Milestone handlers
  updateIA: (iaId: string, updates: Partial<IA>) => void;
  toggleMilestone: (iaId: string, milestoneId: string) => void;

  // Blocker handlers
  addBlocker: (blocker: Blocker) => void;
  replaceBlocker: (blocker: Blocker) => void;

  // Risk handlers
  addRisk: (risk: Risk) => void;
  updateRisk: (riskId: string, updates: Partial<Risk>) => void;

  // Time tracking
  logManualHours: (
    iaId: string,
    milestoneId: string,
    hours: number,
    note?: string,
  ) => void;
  startTimer: (iaId: string, milestoneId: string) => void;
  stopTimer: (note?: string) => void;

  // Navigation
  navigateTo?: (view: string, params?: Record<string, string>) => void;
}

// ============================================
// ACTION PREVIEW BUILDER
// ============================================

export function buildActionPreview(
  action: ActionPayload,
  state: AppState,
): ActionPreview | null {
  const changes: ChangePreview[] = [];
  let description = "";
  const warnings: string[] = [];
  const sideEffects: string[] = [];
  let reversible = true;

  switch (action.type) {
    case "complete_milestone": {
      const { iaId, milestoneId } = action;
      if (!iaId || !milestoneId) return null;

      const ia = state.ias.find((i) => i.id === iaId);
      const milestone = ia?.milestones.find((m) => m.id === milestoneId);
      if (!ia || !milestone) return null;

      description = `Mark "${milestone.milestone_name}" as complete`;
      changes.push({
        entityType: "milestone",
        entityId: milestoneId,
        entityName: milestone.milestone_name,
        field: "completed",
        oldValue: "false",
        newValue: "true",
      });

      // Check if this completes the IA
      const remainingMilestones = ia.milestones.filter(
        (m) => !m.completed && m.id !== milestoneId,
      );
      if (remainingMilestones.length === 0) {
        sideEffects.push(`This will complete the entire "${ia.name}" IA!`);
      }

      // Check for blockers
      const hasBlocker = state.blockers.some(
        (b) => b.milestoneId === milestoneId && b.status === "active",
      );
      if (hasBlocker) {
        warnings.push(
          "This milestone has an active blocker that will remain unresolved.",
        );
      }

      break;
    }

    case "uncomplete_milestone": {
      const { iaId, milestoneId } = action;
      if (!iaId || !milestoneId) return null;

      const ia = state.ias.find((i) => i.id === iaId);
      const milestone = ia?.milestones.find((m) => m.id === milestoneId);
      if (!ia || !milestone) return null;

      description = `Mark "${milestone.milestone_name}" as incomplete`;
      changes.push({
        entityType: "milestone",
        entityId: milestoneId,
        entityName: milestone.milestone_name,
        field: "completed",
        oldValue: "true",
        newValue: "false",
      });
      break;
    }

    case "update_milestone_deadline": {
      const { iaId, milestoneId, data } = action;
      if (!iaId || !milestoneId || !data?.newDeadline) return null;

      const ia = state.ias.find((i) => i.id === iaId);
      const milestone = ia?.milestones.find((m) => m.id === milestoneId);
      if (!ia || !milestone) return null;

      const newDeadline = data.newDeadline as string;
      description = `Change deadline of "${milestone.milestone_name}" to ${newDeadline}`;
      changes.push({
        entityType: "milestone",
        entityId: milestoneId,
        entityName: milestone.milestone_name,
        field: "deadline",
        oldValue: milestone.deadline,
        newValue: newDeadline,
      });

      // Check if new deadline is after master deadline
      if (new Date(newDeadline) > new Date(state.masterDeadline)) {
        warnings.push("New deadline is after the master deadline!");
      }

      sideEffects.push("Downstream milestones may be rescheduled.");
      break;
    }

    case "log_time": {
      const { iaId, milestoneId, data } = action;
      if (!iaId || !milestoneId || !data?.hours) return null;

      const ia = state.ias.find((i) => i.id === iaId);
      const milestone = ia?.milestones.find((m) => m.id === milestoneId);
      if (!ia || !milestone) return null;

      const hours = data.hours as number;
      const currentHours = milestone.actualHours || 0;
      description = `Log ${hours}h of work on "${milestone.milestone_name}"`;
      changes.push({
        entityType: "milestone",
        entityId: milestoneId,
        entityName: milestone.milestone_name,
        field: "actualHours",
        oldValue: `${currentHours}h`,
        newValue: `${currentHours + hours}h`,
      });

      reversible = false; // Time logs shouldn't be undone casually
      break;
    }

    case "create_blocker": {
      const { data } = action;
      if (!data) return null;

      const title = (data.title as string) || "New Blocker";
      description = `Create blocker: "${title}"`;
      changes.push({
        entityType: "blocker",
        entityId: "new",
        entityName: title,
        field: "status",
        oldValue: "N/A",
        newValue: "active",
      });

      const iaId = data.iaId as string;
      const ia = state.ias.find((i) => i.id === iaId);
      if (ia) {
        sideEffects.push(`This will be tracked against "${ia.name}".`);
      }
      break;
    }

    case "resolve_blocker": {
      const { blockerId, data } = action;
      if (!blockerId) return null;

      const blocker = state.blockers.find((b) => b.id === blockerId);
      if (!blocker) return null;

      description = `Resolve blocker: "${blocker.title}"`;
      changes.push({
        entityType: "blocker",
        entityId: blockerId,
        entityName: blocker.title,
        field: "status",
        oldValue: blocker.status,
        newValue: "resolved",
      });

      if (data?.lessonsLearned) {
        sideEffects.push(
          "Lessons learned will be recorded for future reference.",
        );
      }
      break;
    }

    case "create_risk": {
      const { data } = action;
      if (!data) return null;

      const title = (data.title as string) || "New Risk";
      const probability = (data.probability as RiskProbability) || "medium";
      const impact = (data.impact as RiskImpact) || "moderate";
      const score = calculateRiskScore(probability, impact);

      description = `Add risk: "${title}" (Score: ${score})`;
      changes.push({
        entityType: "risk",
        entityId: "new",
        entityName: title,
        field: "status",
        oldValue: "N/A",
        newValue: "identified",
      });

      if (score >= 9) {
        warnings.push(
          "This is a high-priority risk that should be closely monitored.",
        );
      }
      break;
    }

    case "materialize_risk": {
      const { riskId } = action;
      if (!riskId) return null;

      const risk = state.risks.find((r) => r.id === riskId);
      if (!risk) return null;

      description = `Convert risk "${risk.title}" into a blocker`;
      changes.push({
        entityType: "risk",
        entityId: riskId,
        entityName: risk.title,
        field: "status",
        oldValue: risk.status,
        newValue: "materialized",
      });

      sideEffects.push("A new blocker will be created from this risk.");
      warnings.push(
        "This indicates the risk has occurred. Review mitigation strategies.",
      );
      reversible = false;
      break;
    }

    case "start_timer": {
      const { iaId, milestoneId } = action;
      if (!iaId || !milestoneId) return null;

      const ia = state.ias.find((i) => i.id === iaId);
      const milestone = ia?.milestones.find((m) => m.id === milestoneId);
      if (!ia || !milestone) return null;

      description = `Start timer for "${milestone.milestone_name}"`;
      changes.push({
        entityType: "milestone",
        entityId: milestoneId,
        entityName: milestone.milestone_name,
        field: "timer",
        oldValue: "stopped",
        newValue: "running",
      });

      if (state.activeTimer) {
        warnings.push("This will stop the currently running timer.");
      }
      break;
    }

    case "stop_timer": {
      const activeTimer = state.activeTimer;
      if (!activeTimer) return null;

      const ia = state.ias.find((i) => i.id === activeTimer.iaId);
      const milestone = ia?.milestones.find(
        (m) => m.id === activeTimer.milestoneId,
      );

      description = `Stop timer${milestone ? ` for "${milestone.milestone_name}"` : ""}`;
      if (milestone) {
        changes.push({
          entityType: "milestone",
          entityId: milestone.id,
          entityName: milestone.milestone_name,
          field: "timer",
          oldValue: "running",
          newValue: "stopped",
        });
      }

      sideEffects.push("Elapsed time will be logged to the milestone.");
      break;
    }

    case "navigate_to_view": {
      const { data } = action;
      const view = data?.view as string;
      description = `Navigate to ${view || "dashboard"}`;
      // Navigation doesn't need change previews
      reversible = true;
      break;
    }

    case "open_ia_detail": {
      const { iaId } = action;
      const ia = state.ias.find((i) => i.id === iaId);
      description = `Open details for "${ia?.name || "IA"}"`;
      reversible = true;
      break;
    }

    default:
      return null;
  }

  return {
    action,
    description,
    changes,
    sideEffects: sideEffects.length > 0 ? sideEffects : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    reversible,
  };
}

// ============================================
// ACTION EXECUTOR
// ============================================

export async function executeAction(
  action: ActionPayload,
  state: AppState,
  handlers: ActionHandlers,
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case "complete_milestone":
      case "uncomplete_milestone": {
        const { iaId, milestoneId } = action;
        if (!iaId || !milestoneId) {
          return { success: false, error: "Missing IA or milestone ID" };
        }
        handlers.toggleMilestone(iaId, milestoneId);
        return { success: true };
      }

      case "update_milestone_deadline": {
        const { iaId, milestoneId, data } = action;
        if (!iaId || !milestoneId || !data?.newDeadline) {
          return { success: false, error: "Missing required data" };
        }

        const ia = state.ias.find((i) => i.id === iaId);
        if (!ia) return { success: false, error: "IA not found" };

        const updatedMilestones = ia.milestones.map((m) =>
          m.id === milestoneId
            ? { ...m, deadline: data.newDeadline as string }
            : m,
        );
        handlers.updateIA(iaId, { milestones: updatedMilestones });
        return { success: true };
      }

      case "log_time": {
        const { iaId, milestoneId, data } = action;
        if (!iaId || !milestoneId || !data?.hours) {
          return { success: false, error: "Missing required data" };
        }
        handlers.logManualHours(
          iaId,
          milestoneId,
          data.hours as number,
          data.note as string | undefined,
        );
        return { success: true };
      }

      case "start_timer": {
        const { iaId, milestoneId } = action;
        if (!iaId || !milestoneId) {
          return { success: false, error: "Missing IA or milestone ID" };
        }
        handlers.startTimer(iaId, milestoneId);
        return { success: true };
      }

      case "stop_timer": {
        const { data } = action;
        handlers.stopTimer(data?.note as string | undefined);
        return { success: true };
      }

      case "create_blocker": {
        const { data } = action;
        if (!data) return { success: false, error: "Missing blocker data" };

        const blocker: Blocker = {
          id: crypto.randomUUID(),
          milestoneId: data.milestoneId as string,
          iaId: data.iaId as string,
          title: data.title as string,
          description: (data.description as string) || "",
          category: (data.category as BlockerCategory) || "technical_issue",
          severity: (data.severity as BlockerSeverity) || "medium",
          status: "active",
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          estimatedDelayDays: (data.estimatedDelayDays as number) || 1,
          updates: [],
        };
        handlers.addBlocker(blocker);
        return { success: true };
      }

      case "resolve_blocker": {
        const { blockerId, data } = action;
        if (!blockerId) return { success: false, error: "Missing blocker ID" };

        const blocker = state.blockers.find((b) => b.id === blockerId);
        if (!blocker) return { success: false, error: "Blocker not found" };

        const resolved: Blocker = {
          ...blocker,
          status: "resolved",
          resolvedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          resolutionNotes: (data?.resolutionNotes as string) || "Resolved",
          lessonsLearned: data?.lessonsLearned as string | undefined,
        };
        handlers.replaceBlocker(resolved);
        return { success: true };
      }

      case "create_risk": {
        const { data } = action;
        if (!data) return { success: false, error: "Missing risk data" };

        const probability = (data.probability as RiskProbability) || "medium";
        const impact = (data.impact as RiskImpact) || "moderate";

        const risk: Risk = {
          id: crypto.randomUUID(),
          iaId: data.iaId as string | undefined,
          milestoneId: data.milestoneId as string | undefined,
          title: data.title as string,
          description: (data.description as string) || "",
          category: (data.category as BlockerCategory) || "technical_issue",
          probability,
          impact,
          riskScore: calculateRiskScore(probability, impact),
          status: "identified",
          identifiedAt: new Date().toISOString(),
          lastAssessedAt: new Date().toISOString(),
          isSystemSuggested: false,
          isDismissed: false,
        };
        handlers.addRisk(risk);
        return { success: true };
      }

      case "update_risk": {
        const { riskId, data } = action;
        if (!riskId || !data)
          return { success: false, error: "Missing required data" };
        handlers.updateRisk(riskId, data as Partial<Risk>);
        return { success: true };
      }

      case "materialize_risk": {
        const { riskId, data } = action;
        if (!riskId) return { success: false, error: "Missing risk ID" };

        const risk = state.risks.find((r) => r.id === riskId);
        if (!risk) return { success: false, error: "Risk not found" };

        // Validate that the risk has an associated IA
        if (!risk.iaId) {
          return {
            success: false,
            error: "Risk must be associated with an IA to materialize",
          };
        }

        // Create blocker from risk
        const blocker: Blocker = {
          id: crypto.randomUUID(),
          milestoneId: risk.milestoneId || "",
          iaId: risk.iaId,
          title: risk.title,
          description: `Materialized from risk: ${risk.description}`,
          category: risk.category,
          severity:
            risk.riskScore >= 12
              ? "critical"
              : risk.riskScore >= 9
                ? "high"
                : "medium",
          status: "active",
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          estimatedDelayDays:
            (data?.estimatedDelayDays as number) ||
            Math.ceil(risk.riskScore / 2),
          updates: [],
        };

        handlers.addBlocker(blocker);
        handlers.updateRisk(riskId, {
          status: "materialized",
          materializedAt: new Date().toISOString(),
          blockerId: blocker.id,
        });
        return { success: true };
      }

      case "navigate_to_view": {
        if (handlers.navigateTo) {
          const { data } = action;
          handlers.navigateTo(
            (data?.view as string) || "dashboard",
            data?.params as Record<string, string> | undefined,
          );
        }
        return { success: true };
      }

      case "open_ia_detail": {
        if (handlers.navigateTo) {
          const { iaId } = action;
          handlers.navigateTo("ia_detail", { iaId: iaId || "" });
        }
        return { success: true };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// BATCH EXECUTOR
// ============================================

export async function executeBatchActions(
  actions: ActionPayload[],
  state: AppState,
  handlers: ActionHandlers,
): Promise<Array<{ action: ActionPayload; success: boolean; error?: string }>> {
  const results: Array<{
    action: ActionPayload;
    success: boolean;
    error?: string;
  }> = [];

  for (const action of actions) {
    const result = await executeAction(action, state, handlers);
    results.push({ action, ...result });

    // Stop on first failure for dependent actions
    if (!result.success) {
      break;
    }
  }

  return results;
}
