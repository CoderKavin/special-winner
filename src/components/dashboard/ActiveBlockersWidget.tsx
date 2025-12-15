import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import type { AppState, Blocker, BlockerSeverity } from "../../types";
import {
  getCriticalBlockers,
  getBlockersNeedingAttention,
  calculateBlockerStatistics,
  getCategoryLabel,
  getSeverityColor,
  getBlockerAgeDays,
  processAutoEscalation,
} from "../../services/blocker";
import { cn, formatShortDate } from "../../lib/utils";
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle2,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";

interface ActiveBlockersWidgetProps {
  state: AppState;
  onLogBlocker: () => void;
  onViewBlocker: (blocker: Blocker) => void;
  onResolveBlocker: (blocker: Blocker) => void;
  onBlockersUpdated?: (blockers: Blocker[]) => void;
}

export function ActiveBlockersWidget({
  state,
  onLogBlocker,
  onViewBlocker,
  onResolveBlocker,
  onBlockersUpdated,
}: ActiveBlockersWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  const activeBlockers = state.blockers.filter((b) => b.status !== "resolved");
  const criticalBlockers = getCriticalBlockers(state.blockers);
  const blockersNeedingAttention = getBlockersNeedingAttention(
    state.blockers,
    state.blockerSettings,
  );
  const stats = calculateBlockerStatistics(state.blockers);

  // Process auto-escalation when component mounts/updates
  useMemo(() => {
    if (onBlockersUpdated && state.blockers.length > 0) {
      const updatedBlockers = processAutoEscalation(
        state.blockers,
        state.blockerSettings,
      );
      const hasChanges = updatedBlockers.some((updated, i) => {
        const original = state.blockers[i];
        return (
          updated.status !== original.status ||
          updated.severity !== original.severity
        );
      });
      if (hasChanges) {
        onBlockersUpdated(updatedBlockers);
      }
    }
  }, [state.blockers, state.blockerSettings, onBlockersUpdated]);

  const getIAName = (iaId: string) => {
    return state.ias.find((ia) => ia.id === iaId)?.name || "Unknown IA";
  };

  const getMilestoneName = (iaId: string, milestoneId: string) => {
    const ia = state.ias.find((ia) => ia.id === iaId);
    return (
      ia?.milestones.find((m) => m.id === milestoneId)?.milestone_name ||
      "Unknown Milestone"
    );
  };

  const getSeverityIcon = (severity: BlockerSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertOctagon className="h-4 w-4" />;
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <AlertCircle className="h-4 w-4" />;
      case "low":
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (blocker: Blocker) => {
    if (blocker.status === "escalated") {
      return (
        <span className="flex items-center gap-1 text-caption px-2 py-0.5 rounded bg-critical/20 text-critical">
          <TrendingUp className="h-3 w-3" />
          Escalated
        </span>
      );
    }
    if (blocker.status === "stale") {
      return (
        <span className="flex items-center gap-1 text-caption px-2 py-0.5 rounded bg-warning/20 text-warning">
          <Clock className="h-3 w-3" />
          Needs Update
        </span>
      );
    }
    return null;
  };

  if (activeBlockers.length === 0) {
    return (
      <Card className="bg-surface border-border-subtle">
        <CardHeader className="pb-2">
          <CardTitle className="text-h3 font-semibold flex items-center justify-between text-text-primary">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-text-tertiary" />
              Blockers
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-caption"
              onClick={onLogBlocker}
            >
              <Plus className="h-3 w-3" />
              Log Blocker
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-md bg-success/10 border border-success/20">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-body-sm text-success">No active blockers</p>
              <p className="text-caption text-success/70">
                All clear! Your progress is unobstructed.
              </p>
            </div>
          </div>

          {stats.resolvedBlockers > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-caption text-text-tertiary">
                {stats.resolvedBlockers} blocker
                {stats.resolvedBlockers !== 1 ? "s" : ""} resolved
                {stats.totalDaysLost > 0 && (
                  <span> • {stats.totalDaysLost} days recovered</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const sortedBlockers = [...activeBlockers].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const displayBlockers = expanded
    ? sortedBlockers
    : sortedBlockers.slice(0, 3);

  return (
    <Card className="bg-surface border-border-subtle">
      <CardHeader className="pb-2">
        <CardTitle className="text-h3 font-semibold flex items-center justify-between text-text-primary">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-warning" />
            Active Blockers
            <span className="text-body-sm font-normal text-text-tertiary">
              ({activeBlockers.length})
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-caption"
            onClick={onLogBlocker}
          >
            <Plus className="h-3 w-3" />
            Log Blocker
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Critical Alert Banner */}
        {criticalBlockers.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-critical/10 border border-critical/30">
            <AlertOctagon className="h-5 w-5 text-critical shrink-0" />
            <div className="flex-1">
              <p className="text-body-sm font-medium text-critical">
                {criticalBlockers.length} Critical Blocker
                {criticalBlockers.length !== 1 ? "s" : ""}
              </p>
              <p className="text-caption text-critical/70">
                Immediate attention required to avoid deadline impact
              </p>
            </div>
          </div>
        )}

        {/* Needs Attention Banner */}
        {blockersNeedingAttention.length > 0 &&
          criticalBlockers.length === 0 && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-warning/10 border border-warning/30">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              <div className="flex-1">
                <p className="text-body-sm font-medium text-warning">
                  {blockersNeedingAttention.length} Blocker
                  {blockersNeedingAttention.length !== 1 ? "s" : ""} Need
                  Attention
                </p>
                <p className="text-caption text-warning/70">
                  Stale or overdue - please provide an update
                </p>
              </div>
            </div>
          )}

        {/* Blockers List */}
        <div className="space-y-2">
          <AnimatePresence>
            {displayBlockers.map((blocker, index) => (
              <motion.div
                key={blocker.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "p-3 rounded-md border transition-all duration-fast cursor-pointer",
                  "hover:bg-surface-hover",
                  blocker.severity === "critical"
                    ? "bg-critical/5 border-critical/30"
                    : blocker.severity === "high"
                      ? "bg-warning/5 border-warning/30"
                      : blocker.status === "stale" ||
                          blocker.status === "escalated"
                        ? "bg-warning/5 border-warning/30"
                        : "bg-surface-hover border-border-subtle",
                )}
                onClick={() => onViewBlocker(blocker)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5",
                      getSeverityColor(blocker.severity).text,
                    )}
                  >
                    {getSeverityIcon(blocker.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-body-sm text-text-primary truncate">
                        {blocker.title}
                      </span>
                      {getStatusBadge(blocker)}
                    </div>

                    <p className="text-caption text-text-tertiary mt-1 truncate">
                      {getIAName(blocker.iaId)} →{" "}
                      {getMilestoneName(blocker.iaId, blocker.milestoneId)}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-caption text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getBlockerAgeDays(blocker)} days old
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded",
                          getSeverityColor(blocker.severity).bg,
                        )}
                      >
                        {getCategoryLabel(blocker.category)}
                      </span>
                      {blocker.waitingOn && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {blocker.waitingOn}
                        </span>
                      )}
                    </div>

                    {blocker.expectedResolutionDate && (
                      <p className="text-caption text-text-tertiary mt-1">
                        Expected resolution:{" "}
                        {formatShortDate(blocker.expectedResolutionDate)}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-7 text-caption text-success hover:text-success hover:bg-success/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResolveBlocker(blocker);
                    }}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Show More/Less */}
        {sortedBlockers.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-caption text-text-tertiary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {sortedBlockers.length - 3} More
              </>
            )}
          </Button>
        )}

        {/* Statistics Footer */}
        <div className="pt-3 border-t border-border-subtle">
          <div className="flex items-center justify-between text-caption text-text-tertiary">
            <span>
              {stats.resolvedBlockers} resolved •{" "}
              {stats.totalDaysLost > 0
                ? `${stats.totalDaysLost} days lost`
                : "No delays yet"}
            </span>
            {stats.mostCommonCategory && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Most common: {getCategoryLabel(stats.mostCommonCategory)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
