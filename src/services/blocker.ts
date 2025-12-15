import { differenceInDays, parseISO, format, addDays } from "date-fns";
import type {
  Blocker,
  BlockerCategory,
  BlockerSeverity,
  BlockerStatus,
  BlockerUpdate,
  BlockerSettings,
  BlockerStatistics,
  Risk,
  RiskProbability,
  RiskImpact,
  RiskStatus,
  IA,
  Milestone,
} from "../types";
import {
  DEFAULT_BLOCKER_SETTINGS,
  BLOCKER_TEMPLATES,
  RISK_SUGGESTIONS,
  calculateRiskScore,
} from "../types";

// ============================================
// BLOCKER CREATION AND MANAGEMENT
// ============================================

/**
 * Create a new blocker
 */
export function createBlocker(
  milestoneId: string,
  iaId: string,
  title: string,
  description: string,
  category: BlockerCategory,
  severity: BlockerSeverity,
  estimatedDelayDays: number,
  expectedResolutionDate?: string,
  waitingOn?: string,
): Blocker {
  const now = new Date().toISOString();
  return {
    id: `blocker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    milestoneId,
    iaId,
    title,
    description,
    category,
    severity,
    status: severity === "critical" ? "escalated" : "active",
    createdAt: now,
    expectedResolutionDate,
    lastUpdatedAt: now,
    estimatedDelayDays,
    waitingOn,
    updates: [
      {
        id: `update-${Date.now()}`,
        timestamp: now,
        message: "Blocker created",
        type: "status_change",
      },
    ],
  };
}

/**
 * Create a blocker from a template
 */
export function createBlockerFromTemplate(
  templateId: string,
  milestoneId: string,
  iaId: string,
  additionalDescription?: string,
): Blocker | null {
  const template = BLOCKER_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return null;

  const now = new Date();
  const expectedResolution = addDays(now, template.estimatedResolutionDays);

  return createBlocker(
    milestoneId,
    iaId,
    template.title,
    additionalDescription
      ? `${template.description}\n\nAdditional notes: ${additionalDescription}`
      : template.description,
    template.category,
    template.defaultSeverity,
    template.estimatedResolutionDays,
    format(expectedResolution, "yyyy-MM-dd"),
  );
}

/**
 * Add an update to a blocker
 */
export function addBlockerUpdate(
  blocker: Blocker,
  message: string,
  type: BlockerUpdate["type"] = "note",
): Blocker {
  const now = new Date().toISOString();
  return {
    ...blocker,
    lastUpdatedAt: now,
    updates: [
      ...blocker.updates,
      {
        id: `update-${Date.now()}`,
        timestamp: now,
        message,
        type,
      },
    ],
  };
}

/**
 * Resolve a blocker
 */
export function resolveBlocker(
  blocker: Blocker,
  resolutionNotes: string,
  lessonsLearned?: string,
  workaroundApplied?: string,
): Blocker {
  const now = new Date().toISOString();
  const createdDate = parseISO(blocker.createdAt);
  const actualDelayDays = differenceInDays(new Date(), createdDate);

  return {
    ...blocker,
    status: "resolved",
    resolvedAt: now,
    lastUpdatedAt: now,
    actualDelayDays,
    resolutionNotes,
    lessonsLearned,
    workaroundApplied,
    updates: [
      ...blocker.updates,
      {
        id: `update-${Date.now()}`,
        timestamp: now,
        message: `Resolved: ${resolutionNotes}`,
        type: "status_change",
      },
    ],
  };
}

/**
 * Escalate a blocker's severity
 */
export function escalateBlocker(
  blocker: Blocker,
  reason: string,
  newSeverity?: BlockerSeverity,
): Blocker {
  const now = new Date().toISOString();
  const severityOrder: BlockerSeverity[] = [
    "low",
    "medium",
    "high",
    "critical",
  ];
  const currentIndex = severityOrder.indexOf(blocker.severity);
  const escalatedSeverity =
    newSeverity || severityOrder[Math.min(currentIndex + 1, 3)];

  return {
    ...blocker,
    severity: escalatedSeverity,
    status: "escalated",
    lastUpdatedAt: now,
    autoEscalatedAt: now,
    originalSeverity: blocker.originalSeverity || blocker.severity,
    updates: [
      ...blocker.updates,
      {
        id: `update-${Date.now()}`,
        timestamp: now,
        message: `Escalated to ${escalatedSeverity}: ${reason}`,
        type: "escalation",
      },
    ],
  };
}

// ============================================
// BLOCKER DETECTION AND AUTO-ESCALATION
// ============================================

/**
 * Check if a blocker is stale (no updates for X days)
 */
export function isBlockerStale(
  blocker: Blocker,
  settings: BlockerSettings = DEFAULT_BLOCKER_SETTINGS,
): boolean {
  if (blocker.status === "resolved") return false;
  const daysSinceUpdate = differenceInDays(
    new Date(),
    parseISO(blocker.lastUpdatedAt),
  );
  return daysSinceUpdate >= settings.staleAfterDays;
}

/**
 * Check if a blocker is overdue
 */
export function isBlockerOverdue(blocker: Blocker): boolean {
  if (blocker.status === "resolved" || !blocker.expectedResolutionDate)
    return false;
  return new Date() > parseISO(blocker.expectedResolutionDate);
}

/**
 * Check if a blocker needs follow-up
 */
export function needsFollowUp(
  blocker: Blocker,
  settings: BlockerSettings = DEFAULT_BLOCKER_SETTINGS,
): boolean {
  if (blocker.status === "resolved" || !blocker.waitingOn) return false;

  if (blocker.nextFollowUpDate) {
    return new Date() >= parseISO(blocker.nextFollowUpDate);
  }

  if (blocker.lastFollowUpDate) {
    const daysSinceFollowUp = differenceInDays(
      new Date(),
      parseISO(blocker.lastFollowUpDate),
    );
    return daysSinceFollowUp >= settings.defaultFollowUpIntervalDays;
  }

  // No follow-up yet, check from creation
  const daysSinceCreation = differenceInDays(
    new Date(),
    parseISO(blocker.createdAt),
  );
  return daysSinceCreation >= settings.defaultFollowUpIntervalDays;
}

/**
 * Process auto-escalation for all blockers
 */
export function processAutoEscalation(
  blockers: Blocker[],
  settings: BlockerSettings = DEFAULT_BLOCKER_SETTINGS,
): Blocker[] {
  return blockers.map((blocker) => {
    if (blocker.status === "resolved") return blocker;

    // Check for stale blockers
    if (isBlockerStale(blocker, settings) && blocker.status !== "stale") {
      return {
        ...blocker,
        status: "stale" as BlockerStatus,
        lastUpdatedAt: new Date().toISOString(),
        updates: [
          ...blocker.updates,
          {
            id: `update-${Date.now()}`,
            timestamp: new Date().toISOString(),
            message: `Marked stale - no updates for ${settings.staleAfterDays} days`,
            type: "status_change" as const,
          },
        ],
      };
    }

    // Check for overdue blockers that need escalation
    if (isBlockerOverdue(blocker) && blocker.severity !== "critical") {
      const daysOverdue = differenceInDays(
        new Date(),
        parseISO(blocker.expectedResolutionDate!),
      );
      if (
        daysOverdue >= settings.autoEscalateAfterDays &&
        !blocker.autoEscalatedAt
      ) {
        return escalateBlocker(
          blocker,
          `Auto-escalated: ${daysOverdue} days overdue`,
        );
      }
    }

    return blocker;
  });
}

/**
 * Get active blockers for a milestone
 */
export function getBlockersForMilestone(
  blockers: Blocker[],
  milestoneId: string,
): Blocker[] {
  return blockers.filter(
    (b) => b.milestoneId === milestoneId && b.status !== "resolved",
  );
}

/**
 * Get active blockers for an IA
 */
export function getBlockersForIA(blockers: Blocker[], iaId: string): Blocker[] {
  return blockers.filter((b) => b.iaId === iaId && b.status !== "resolved");
}

/**
 * Get critical blockers
 */
export function getCriticalBlockers(blockers: Blocker[]): Blocker[] {
  return blockers.filter(
    (b) => b.severity === "critical" && b.status !== "resolved",
  );
}

/**
 * Get blockers needing attention (stale, overdue, or needing follow-up)
 */
export function getBlockersNeedingAttention(
  blockers: Blocker[],
  settings: BlockerSettings = DEFAULT_BLOCKER_SETTINGS,
): Blocker[] {
  return blockers.filter((b) => {
    if (b.status === "resolved") return false;
    return (
      isBlockerStale(b, settings) ||
      isBlockerOverdue(b) ||
      needsFollowUp(b, settings) ||
      b.severity === "critical"
    );
  });
}

// ============================================
// BLOCKER STATISTICS AND PATTERNS
// ============================================

/**
 * Calculate blocker statistics
 */
export function calculateBlockerStatistics(
  blockers: Blocker[],
): BlockerStatistics {
  const resolved = blockers.filter((b) => b.status === "resolved");
  const totalDaysLost = resolved.reduce(
    (sum, b) => sum + (b.actualDelayDays || b.estimatedDelayDays),
    0,
  );

  // Calculate average resolution time by category
  const categoryTimes: Record<BlockerCategory, number[]> = {
    resource: [],
    approval: [],
    external_dependency: [],
    knowledge_gap: [],
    technical_issue: [],
    health_personal: [],
  };

  resolved.forEach((b) => {
    if (b.actualDelayDays !== undefined) {
      categoryTimes[b.category].push(b.actualDelayDays);
    }
  });

  const averageResolutionDays: Record<BlockerCategory, number> = {
    resource: 0,
    approval: 0,
    external_dependency: 0,
    knowledge_gap: 0,
    technical_issue: 0,
    health_personal: 0,
  };

  (Object.keys(categoryTimes) as BlockerCategory[]).forEach((cat) => {
    const times = categoryTimes[cat];
    averageResolutionDays[cat] =
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  });

  // Find most common category
  const categoryCounts: Record<BlockerCategory, number> = {
    resource: 0,
    approval: 0,
    external_dependency: 0,
    knowledge_gap: 0,
    technical_issue: 0,
    health_personal: 0,
  };

  blockers.forEach((b) => categoryCounts[b.category]++);

  let mostCommonCategory: BlockerCategory | null = null;
  let maxCount = 0;
  (Object.entries(categoryCounts) as [BlockerCategory, number][]).forEach(
    ([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonCategory = cat;
      }
    },
  );

  // Calculate workaround success rate
  const withWorkarounds = resolved.filter((b) => b.workaroundApplied);
  const workaroundSuccessRate =
    resolved.length > 0 ? (withWorkarounds.length / resolved.length) * 100 : 0;

  // Generate pattern insights
  const patterns: string[] = [];

  if (mostCommonCategory && maxCount >= 3) {
    patterns.push(
      `"${getCategoryLabel(mostCommonCategory)}" is your most common blocker type (${maxCount} occurrences)`,
    );
  }

  const avgOverall = resolved.length > 0 ? totalDaysLost / resolved.length : 0;
  if (avgOverall > 5) {
    patterns.push(
      `Blockers take ${avgOverall.toFixed(1)} days on average to resolve - consider earlier mitigation`,
    );
  }

  // Check for underestimation pattern
  const underestimated = resolved.filter(
    (b) => b.actualDelayDays && b.actualDelayDays > b.estimatedDelayDays * 1.5,
  );
  if (underestimated.length >= 2) {
    patterns.push(
      `You often underestimate blocker resolution time - consider adding buffer`,
    );
  }

  return {
    totalBlockers: blockers.length,
    resolvedBlockers: resolved.length,
    averageResolutionDays,
    totalDaysLost,
    mostCommonCategory,
    workaroundSuccessRate,
    patterns,
  };
}

// ============================================
// RISK MANAGEMENT
// ============================================

/**
 * Create a new risk
 */
export function createRisk(
  title: string,
  description: string,
  category: BlockerCategory,
  probability: RiskProbability,
  impact: RiskImpact,
  iaId?: string,
  milestoneId?: string,
  mitigationStrategy?: string,
  contingencyPlan?: string,
  isSystemSuggested = false,
): Risk {
  const now = new Date().toISOString();
  return {
    id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    iaId,
    milestoneId,
    title,
    description,
    category,
    probability,
    impact,
    riskScore: calculateRiskScore(probability, impact),
    status: "identified",
    identifiedAt: now,
    lastAssessedAt: now,
    mitigationStrategy,
    contingencyPlan,
    isSystemSuggested,
    isDismissed: false,
  };
}

/**
 * Get suggested risks for an IA based on subject
 */
export function getSuggestedRisks(ia: IA, existingRisks: Risk[]): Risk[] {
  const suggestions = RISK_SUGGESTIONS.filter(
    (s) => s.forSubject === ia.subjectColor,
  );

  return suggestions
    .filter(
      (s) =>
        !existingRisks.some(
          (r) => r.iaId === ia.id && r.title === s.title && !r.isDismissed,
        ),
    )
    .map((s) =>
      createRisk(
        s.title,
        s.description,
        s.category,
        s.defaultProbability,
        s.defaultImpact,
        ia.id,
        undefined,
        s.mitigationSuggestion,
        s.contingencySuggestion,
        true,
      ),
    );
}

/**
 * Convert a risk to a blocker when it materializes
 */
export function materializeRisk(
  risk: Risk,
  milestoneId: string,
  iaId: string,
  estimatedDelayDays: number,
): { risk: Risk; blocker: Blocker } {
  const now = new Date().toISOString();

  const blocker = createBlocker(
    milestoneId,
    iaId,
    risk.title,
    `${risk.description}\n\nContingency: ${risk.contingencyPlan || "None specified"}`,
    risk.category,
    risk.riskScore >= 9 ? "critical" : risk.riskScore >= 6 ? "high" : "medium",
    estimatedDelayDays,
  );

  const updatedRisk: Risk = {
    ...risk,
    status: "materialized",
    materializedAt: now,
    lastAssessedAt: now,
    blockerId: blocker.id,
  };

  return { risk: updatedRisk, blocker };
}

/**
 * Update risk status
 */
export function updateRiskStatus(
  risk: Risk,
  status: RiskStatus,
  mitigationProgress?: number,
): Risk {
  return {
    ...risk,
    status,
    lastAssessedAt: new Date().toISOString(),
    mitigationProgress:
      mitigationProgress !== undefined
        ? mitigationProgress
        : risk.mitigationProgress,
    mitigatedAt:
      status === "avoided" ? new Date().toISOString() : risk.mitigatedAt,
  };
}

/**
 * Get high-priority risks (score >= 6)
 */
export function getHighPriorityRisks(risks: Risk[]): Risk[] {
  return risks.filter(
    (r) =>
      r.riskScore >= 6 &&
      r.status !== "materialized" &&
      r.status !== "avoided" &&
      !r.isDismissed,
  );
}

// ============================================
// CRITICAL PATH ANALYSIS
// ============================================

/**
 * Check if a milestone is on the critical path
 */
export function isOnCriticalPath(
  milestone: Milestone,
  allMilestones: Milestone[],
  masterDeadline: string,
): boolean {
  // A milestone is on critical path if:
  // 1. Its deadline is close to or past the master deadline
  // 2. It has dependencies that chain to the deadline
  // 3. It has no slack time

  const deadlineDate = parseISO(masterDeadline);
  const milestoneDeadline = parseISO(milestone.deadline);

  // Within 2 weeks of master deadline = critical
  const daysToMaster = differenceInDays(deadlineDate, milestoneDeadline);
  if (daysToMaster <= 14) return true;

  // Check if dependent milestones are critical
  const dependents = allMilestones.filter((m) =>
    m.dependencies.includes(milestone.id),
  );

  return dependents.some((d) =>
    isOnCriticalPath(d, allMilestones, masterDeadline),
  );
}

/**
 * Calculate slack time for a milestone
 */
export function calculateSlackDays(
  milestone: Milestone,
  dependentMilestones: Milestone[],
): number {
  if (dependentMilestones.length === 0) return 0;

  const myDeadline = parseISO(milestone.deadline);
  const earliestDependentStart = dependentMilestones.reduce((earliest, m) => {
    const start = parseISO(m.startDate);
    return start < earliest ? start : earliest;
  }, parseISO(dependentMilestones[0].startDate));

  return Math.max(0, differenceInDays(earliestDependentStart, myDeadline));
}

// ============================================
// WORKAROUND SUGGESTIONS
// ============================================

/**
 * Get workaround suggestions for a blocker
 */
export function getWorkaroundSuggestions(blocker: Blocker): string[] {
  // First check if this matches a template
  const template = BLOCKER_TEMPLATES.find(
    (t) => t.category === blocker.category,
  );

  if (template) {
    return template.suggestedWorkarounds;
  }

  // Generic suggestions by category
  const genericSuggestions: Record<BlockerCategory, string[]> = {
    resource: [
      "Look for alternative resources",
      "Borrow from another student",
      "Ask teacher for alternatives",
    ],
    approval: [
      "Prepare materials for review",
      "Schedule dedicated meeting time",
      "Work on non-dependent sections",
    ],
    external_dependency: [
      "Start with available information",
      "Find alternative sources",
      "Adjust scope to available data",
    ],
    knowledge_gap: [
      "Find online tutorials",
      "Ask classmates for help",
      "Consult with teacher",
    ],
    technical_issue: [
      "Try alternative software",
      "Use school resources",
      "Back up work frequently",
    ],
    health_personal: [
      "Prioritize wellbeing",
      "Communicate with teachers",
      "Adjust timeline if needed",
    ],
  };

  return genericSuggestions[blocker.category] || [];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get human-readable category label
 */
export function getCategoryLabel(category: BlockerCategory): string {
  const labels: Record<BlockerCategory, string> = {
    resource: "Resource",
    approval: "Approval",
    external_dependency: "External Dependency",
    knowledge_gap: "Knowledge Gap",
    technical_issue: "Technical Issue",
    health_personal: "Health/Personal",
  };
  return labels[category];
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: BlockerSeverity): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case "critical":
      return {
        bg: "bg-red-500/20",
        text: "text-red-400",
        border: "border-red-500",
      };
    case "high":
      return {
        bg: "bg-orange-500/20",
        text: "text-orange-400",
        border: "border-orange-500",
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
 * Get blocker age in days
 */
export function getBlockerAgeDays(blocker: Blocker): number {
  return differenceInDays(new Date(), parseISO(blocker.createdAt));
}

/**
 * Get days until expected resolution
 */
export function getDaysUntilResolution(blocker: Blocker): number | null {
  if (!blocker.expectedResolutionDate) return null;
  return differenceInDays(parseISO(blocker.expectedResolutionDate), new Date());
}
