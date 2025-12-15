import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import type { AppState, ScheduleViolation, Blocker } from "../../types";
import { DEFAULT_ENERGY_SETTINGS } from "../../types";
import { generateWarnings, cn } from "../../lib/utils";
import { analyzeFullSchedule } from "../../services/deepwork";
import {
  detectEnergyMismatches,
  getCognitiveLoadLabel,
  getEnergyLevelLabel,
} from "../../services/energy";
import { detectMilestonePhase } from "../../services/learning";
import {
  getCriticalBlockers,
  getBlockersNeedingAttention,
  getCategoryLabel,
  getSeverityColor,
  getBlockerAgeDays,
} from "../../services/blocker";
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Clock,
  Shuffle,
  Layers,
  Scissors,
  Focus,
  Zap,
  ChevronDown,
  ChevronUp,
  Wrench,
  BatteryWarning,
  Lock,
  AlertOctagon,
} from "lucide-react";

interface WarningsPanelProps {
  state: AppState;
  onApplyAutoFix?: (violation: ScheduleViolation) => void;
  onViewBlocker?: (blocker: Blocker) => void;
}

export function WarningsPanel({
  state,
  onApplyAutoFix,
  onViewBlocker,
}: WarningsPanelProps) {
  const [showDeepWorkDetails, setShowDeepWorkDetails] = useState(false);
  const [showEnergyDetails, setShowEnergyDetails] = useState(false);
  const [showBlockerDetails, setShowBlockerDetails] = useState(false);

  const warnings = useMemo(() => generateWarnings(state), [state]);

  const scheduleAnalysis = useMemo(() => analyzeFullSchedule(state), [state]);

  const energySettings = state.energySettings || DEFAULT_ENERGY_SETTINGS;

  // Get all milestones with phases for energy mismatch detection
  const milestonesWithPhases = useMemo(() => {
    return state.ias.flatMap((ia) =>
      ia.milestones.map((m) => ({
        ...m,
        phase: m.phase || detectMilestonePhase(m.milestone_name),
      })),
    );
  }, [state.ias]);

  const energyMismatches = useMemo(
    () =>
      detectEnergyMismatches(milestonesWithPhases, state.ias, energySettings),
    [milestonesWithPhases, state.ias, energySettings],
  );

  const deepWorkViolations = scheduleAnalysis.violations;
  const hasDeepWorkIssues = deepWorkViolations.length > 0;
  const hasEnergyIssues = energyMismatches.length > 0;

  // Blocker analysis
  const criticalBlockers = getCriticalBlockers(state.blockers || []);
  const blockersNeedingAttention = getBlockersNeedingAttention(
    state.blockers || [],
    state.blockerSettings,
  );
  const hasBlockerIssues =
    criticalBlockers.length > 0 || blockersNeedingAttention.length > 0;

  // Get IA name for a blocker
  const getIAName = (iaId: string) => {
    return state.ias.find((ia) => ia.id === iaId)?.name || "Unknown IA";
  };

  // Get milestone name for a blocker
  const getMilestoneName = (iaId: string, milestoneId: string) => {
    const ia = state.ias.find((ia) => ia.id === iaId);
    return (
      ia?.milestones.find((m) => m.id === milestoneId)?.milestone_name ||
      "Unknown Milestone"
    );
  };

  if (
    warnings.length === 0 &&
    !hasDeepWorkIssues &&
    !hasEnergyIssues &&
    !hasBlockerIssues
  ) {
    return null;
  }

  const errors = warnings.filter((w) => w.severity === "error");
  const warningsOnly = warnings.filter((w) => w.severity === "warning");

  const deepWorkErrors = deepWorkViolations.filter(
    (v) => v.severity === "error",
  );
  const deepWorkWarnings = deepWorkViolations.filter(
    (v) => v.severity === "warning",
  );

  const getViolationIcon = (type: ScheduleViolation["type"]) => {
    switch (type) {
      case "minimum_session":
        return <Clock className="h-4 w-4" />;
      case "context_switch":
        return <Shuffle className="h-4 w-4" />;
      case "max_ias_per_day":
        return <Layers className="h-4 w-4" />;
      case "fragmented_work":
        return <Scissors className="h-4 w-4" />;
      case "deep_work_conflict":
        return <Focus className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card className="bg-surface border-border-subtle mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-h3 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-primary">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Warnings & Alerts
          </div>
          {hasDeepWorkIssues && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-caption px-2 py-1 rounded-md font-medium",
                  scheduleAnalysis.overallProductivityScore >= 80
                    ? "bg-success/20 text-success"
                    : scheduleAnalysis.overallProductivityScore >= 60
                      ? "bg-warning/20 text-warning"
                      : "bg-critical/20 text-critical",
                )}
              >
                <Zap className="h-3 w-3 inline mr-1" />
                {scheduleAnalysis.overallProductivityScore}% efficiency
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Standard Warnings */}
        <AnimatePresence>
          {errors.map((warning, index) => (
            <motion.div
              key={`error-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-md",
                "bg-critical/10 border border-critical/20",
              )}
            >
              <XCircle className="h-4 w-4 text-critical shrink-0 mt-0.5" />
              <p className="text-body-sm text-critical">{warning.message}</p>
            </motion.div>
          ))}

          {warningsOnly.map((warning, index) => (
            <motion.div
              key={`warning-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: (errors.length + index) * 0.05 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-md",
                "bg-warning/10 border border-warning/20",
              )}
            >
              <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-body-sm text-warning">{warning.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Deep Work Violations Section */}
        {hasDeepWorkIssues && (
          <div className="space-y-2">
            <button
              onClick={() => setShowDeepWorkDetails(!showDeepWorkDetails)}
              className="w-full flex items-center justify-between p-3 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors duration-fast"
            >
              <div className="flex items-center gap-3">
                <Focus className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="text-body-sm font-medium text-primary">
                    Focus & Efficiency Issues
                  </p>
                  <p className="text-caption text-primary/70">
                    {deepWorkErrors.length > 0 && (
                      <span className="text-critical">
                        {deepWorkErrors.length} critical
                      </span>
                    )}
                    {deepWorkErrors.length > 0 &&
                      deepWorkWarnings.length > 0 && <span> • </span>}
                    {deepWorkWarnings.length > 0 && (
                      <span>{deepWorkWarnings.length} warnings</span>
                    )}
                    {scheduleAnalysis.totalContextSwitches > 0 && (
                      <span>
                        {" "}
                        • {scheduleAnalysis.totalPenaltyHours.toFixed(1)}h lost
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {showDeepWorkDetails ? (
                <ChevronUp className="h-4 w-4 text-primary" />
              ) : (
                <ChevronDown className="h-4 w-4 text-primary" />
              )}
            </button>

            <AnimatePresence>
              {showDeepWorkDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {deepWorkErrors.map((violation, index) => (
                    <motion.div
                      key={violation.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-md bg-critical/10 border border-critical/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-critical mt-0.5">
                          {getViolationIcon(violation.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-body-sm text-critical">
                            {violation.message}
                          </p>
                          {violation.productivityPenaltyPercent && (
                            <p className="text-caption text-critical/70 mt-1">
                              ~{violation.productivityPenaltyPercent}%
                              productivity impact
                            </p>
                          )}
                        </div>
                        {violation.autoFix && onApplyAutoFix && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-caption h-7 border-critical/30 text-critical hover:bg-critical/20"
                            onClick={() => onApplyAutoFix(violation)}
                          >
                            <Wrench className="h-3 w-3" />
                            Fix
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {deepWorkWarnings.map((violation, index) => (
                    <motion.div
                      key={violation.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: (deepWorkErrors.length + index) * 0.05,
                      }}
                      className="p-3 rounded-md bg-warning/10 border border-warning/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-warning mt-0.5">
                          {getViolationIcon(violation.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-body-sm text-warning">
                            {violation.message}
                          </p>
                          {violation.productivityPenaltyPercent && (
                            <p className="text-caption text-warning/70 mt-1">
                              ~{violation.productivityPenaltyPercent}%
                              productivity impact
                            </p>
                          )}
                        </div>
                        {violation.autoFix && onApplyAutoFix && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-caption h-7 border-warning/30 text-warning hover:bg-warning/20"
                            onClick={() => onApplyAutoFix(violation)}
                          >
                            <Wrench className="h-3 w-3" />
                            Fix
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {scheduleAnalysis.totalContextSwitches > 0 && (
                    <div className="p-3 rounded-md bg-surface-hover border border-border-subtle">
                      <div className="flex items-center justify-between text-caption">
                        <span className="text-text-secondary">
                          Total context switches detected
                        </span>
                        <span className="text-text-primary font-medium font-mono">
                          {scheduleAnalysis.totalContextSwitches}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-caption mt-1">
                        <span className="text-text-secondary">
                          Time lost to switching overhead
                        </span>
                        <span className="text-warning font-medium font-mono">
                          {scheduleAnalysis.totalPenaltyHours.toFixed(1)} hours
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Active Blockers Section */}
        {hasBlockerIssues && (
          <div className="space-y-2">
            <button
              onClick={() => setShowBlockerDetails(!showBlockerDetails)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-md transition-colors duration-fast",
                criticalBlockers.length > 0
                  ? "bg-critical/10 border border-critical/30 hover:bg-critical/15"
                  : "bg-warning/10 border border-warning/20 hover:bg-warning/15",
              )}
            >
              <div className="flex items-center gap-3">
                <Lock
                  className={cn(
                    "h-4 w-4",
                    criticalBlockers.length > 0
                      ? "text-critical"
                      : "text-warning",
                  )}
                />
                <div className="text-left">
                  <p
                    className={cn(
                      "text-body-sm font-medium",
                      criticalBlockers.length > 0
                        ? "text-critical"
                        : "text-warning",
                    )}
                  >
                    {criticalBlockers.length > 0
                      ? "Critical Blockers"
                      : "Blockers Need Attention"}
                  </p>
                  <p
                    className={cn(
                      "text-caption",
                      criticalBlockers.length > 0
                        ? "text-critical/70"
                        : "text-warning/70",
                    )}
                  >
                    {criticalBlockers.length > 0 && (
                      <span>{criticalBlockers.length} critical</span>
                    )}
                    {criticalBlockers.length > 0 &&
                      blockersNeedingAttention.length >
                        criticalBlockers.length && <span> • </span>}
                    {blockersNeedingAttention.length >
                      criticalBlockers.length && (
                      <span>
                        {blockersNeedingAttention.length -
                          criticalBlockers.length}{" "}
                        stale/overdue
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {showBlockerDetails ? (
                <ChevronUp
                  className={cn(
                    "h-4 w-4",
                    criticalBlockers.length > 0
                      ? "text-critical"
                      : "text-warning",
                  )}
                />
              ) : (
                <ChevronDown
                  className={cn(
                    "h-4 w-4",
                    criticalBlockers.length > 0
                      ? "text-critical"
                      : "text-warning",
                  )}
                />
              )}
            </button>

            <AnimatePresence>
              {showBlockerDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {criticalBlockers.map((blocker, index) => (
                    <motion.div
                      key={blocker.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-md bg-critical/10 border border-critical/20 cursor-pointer hover:bg-critical/15 transition-colors duration-fast"
                      onClick={() => onViewBlocker?.(blocker)}
                    >
                      <div className="flex items-start gap-3">
                        <AlertOctagon className="h-4 w-4 text-critical mt-0.5" />
                        <div className="flex-1">
                          <p className="text-body-sm text-critical font-medium">
                            {blocker.title}
                          </p>
                          <p className="text-caption text-critical/70 mt-1">
                            {getIAName(blocker.iaId)} →{" "}
                            {getMilestoneName(
                              blocker.iaId,
                              blocker.milestoneId,
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-caption text-critical/70">
                            <span>{getCategoryLabel(blocker.category)}</span>
                            <span>•</span>
                            <span>{getBlockerAgeDays(blocker)} days old</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {blockersNeedingAttention
                    .filter((b) => b.severity !== "critical")
                    .map((blocker, index) => (
                      <motion.div
                        key={blocker.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: (criticalBlockers.length + index) * 0.05,
                        }}
                        className="p-3 rounded-md bg-warning/10 border border-warning/20 cursor-pointer hover:bg-warning/15 transition-colors duration-fast"
                        onClick={() => onViewBlocker?.(blocker)}
                      >
                        <div className="flex items-start gap-3">
                          <Clock className="h-4 w-4 text-warning mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-body-sm text-warning font-medium">
                                {blocker.title}
                              </p>
                              {blocker.status === "stale" && (
                                <span className="text-caption px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                                  Stale
                                </span>
                              )}
                              {blocker.status === "escalated" && (
                                <span className="text-caption px-1.5 py-0.5 rounded bg-critical/20 text-critical">
                                  Escalated
                                </span>
                              )}
                            </div>
                            <p className="text-caption text-warning/70 mt-1">
                              {getIAName(blocker.iaId)} →{" "}
                              {getMilestoneName(
                                blocker.iaId,
                                blocker.milestoneId,
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-caption text-warning/70">
                              <span>{getCategoryLabel(blocker.category)}</span>
                              <span>•</span>
                              <span>{getBlockerAgeDays(blocker)} days old</span>
                              <span>•</span>
                              <span
                                className={
                                  getSeverityColor(blocker.severity).text
                                }
                              >
                                {blocker.severity}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                  <div className="p-3 rounded-md bg-surface-hover border border-border-subtle">
                    <p className="text-caption text-text-secondary">
                      {criticalBlockers.length > 0
                        ? "Critical blockers require immediate action to prevent deadline impact."
                        : "Update stale blockers or mark them as resolved to keep your progress accurate."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Energy Mismatch Section */}
        {hasEnergyIssues && (
          <div className="space-y-2">
            <button
              onClick={() => setShowEnergyDetails(!showEnergyDetails)}
              className="w-full flex items-center justify-between p-3 rounded-md bg-warning/10 border border-warning/20 hover:bg-warning/15 transition-colors duration-fast"
            >
              <div className="flex items-center gap-3">
                <BatteryWarning className="h-4 w-4 text-warning" />
                <div className="text-left">
                  <p className="text-body-sm font-medium text-warning">
                    Energy Mismatch Detected
                  </p>
                  <p className="text-caption text-warning/70">
                    {energyMismatches.length} task
                    {energyMismatches.length !== 1 ? "s" : ""} scheduled at
                    suboptimal times
                    {energyMismatches.reduce(
                      (sum, m) => sum + m.productivityImpactPercent,
                      0,
                    ) > 0 && (
                      <span>
                        {" "}
                        •{" "}
                        {Math.round(
                          energyMismatches.reduce(
                            (sum, m) => sum + m.productivityImpactPercent,
                            0,
                          ) / energyMismatches.length,
                        )}
                        % avg penalty
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {showEnergyDetails ? (
                <ChevronUp className="h-4 w-4 text-warning" />
              ) : (
                <ChevronDown className="h-4 w-4 text-warning" />
              )}
            </button>

            <AnimatePresence>
              {showEnergyDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {energyMismatches.map((mismatch, index) => {
                    const ia = state.ias.find((i) =>
                      i.milestones.some((m) => m.id === mismatch.milestoneId),
                    );
                    const milestone = ia?.milestones.find(
                      (m) => m.id === mismatch.milestoneId,
                    );

                    return (
                      <motion.div
                        key={mismatch.milestoneId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-3 rounded-md bg-warning/10 border border-warning/20"
                      >
                        <div className="flex items-start gap-3">
                          <BatteryWarning className="h-4 w-4 text-warning mt-0.5" />
                          <div className="flex-1">
                            <p className="text-body-sm text-warning">
                              {milestone?.milestone_name || "Unknown milestone"}
                            </p>
                            <p className="text-caption text-warning/70 mt-1">
                              {getCognitiveLoadLabel(
                                mismatch.taskCognitiveLoad,
                              )}{" "}
                              cognitive load task in{" "}
                              {getEnergyLevelLabel(mismatch.windowEnergyLevel)}{" "}
                              energy window
                            </p>
                            <p className="text-caption text-warning/70">
                              -{mismatch.productivityImpactPercent}%
                              productivity
                            </p>
                            {mismatch.suggestedAlternatives.length > 0 && (
                              <p className="text-caption text-success mt-1">
                                Better times:{" "}
                                {mismatch.suggestedAlternatives
                                  .slice(0, 2)
                                  .map(
                                    (alt: { date: string; hour: number }) =>
                                      `${alt.hour}:00`,
                                  )
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  <div className="p-3 rounded-md bg-surface-hover border border-border-subtle">
                    <div className="flex items-center justify-between text-caption">
                      <span className="text-text-secondary">
                        Total productivity loss from mismatches
                      </span>
                      <span className="text-warning font-medium font-mono">
                        ~
                        {Math.round(
                          energyMismatches.reduce(
                            (sum, m) => sum + m.productivityImpactPercent,
                            0,
                          ) / Math.max(energyMismatches.length, 1),
                        )}
                        % average
                      </span>
                    </div>
                    <p className="text-caption text-text-tertiary mt-2">
                      Consider rescheduling high-load tasks to your peak energy
                      windows for better focus and efficiency.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
