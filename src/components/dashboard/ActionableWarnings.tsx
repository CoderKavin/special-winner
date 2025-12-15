/**
 * ACTIONABLE WARNINGS PANEL
 *
 * Every warning has 2-3 specific fix options.
 * No warning is "read-only" - every problem has solutions.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import type { AppState } from "../../types";
import {
  analyzeScheduleWarnings,
  applyFix,
  generateOptimizationScenarios,
  type ScheduleWarning,
  type ScheduleFix,
  type OptimizationScenario,
} from "../../services/scheduleOptimizer";
import {
  AlertTriangle,
  Clock,
  Calendar,
  TrendingUp,
  Shuffle,
  Layers,
  ChevronRight,
  Zap,
  Check,
  Undo2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface ActionableWarningsProps {
  state: AppState;
  onApplyFix: (changes: Partial<AppState>) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export function ActionableWarnings({
  state,
  onApplyFix,
  onUndo,
  canUndo = false,
}: ActionableWarningsProps) {
  const [expandedWarning, setExpandedWarning] = useState<string | null>(null);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [recentFix, setRecentFix] = useState<string | null>(null);

  const warnings = useMemo(() => analyzeScheduleWarnings(state), [state]);
  const scenarios = useMemo(
    () => generateOptimizationScenarios(state, warnings),
    [state, warnings]
  );

  const criticalWarnings = warnings.filter((w) => w.severity === "critical");
  const regularWarnings = warnings.filter((w) => w.severity === "warning");
  const infoWarnings = warnings.filter((w) => w.severity === "info");

  const handleApplyFix = (fix: ScheduleFix) => {
    const { newState, result } = applyFix(state, fix);
    if (result.success) {
      onApplyFix(newState);
      setRecentFix(fix.label);
      setTimeout(() => setRecentFix(null), 3000);
    }
  };

  const handleApplyScenario = (scenario: OptimizationScenario) => {
    onApplyFix(scenario.changes);
    setShowOptimizeModal(false);
    setRecentFix(scenario.name);
    setTimeout(() => setRecentFix(null), 3000);
  };

  if (warnings.length === 0) {
    return (
      <Card className="bg-[var(--bg-surface)] border-[var(--border-subtle)] mb-6">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-emerald-500">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                Schedule looks good
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                No issues detected
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-[var(--bg-surface)] border-[var(--border-subtle)] mb-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">
                Schedule Issues
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {criticalWarnings.length > 0 && (
                  <span className="text-red-500">
                    {criticalWarnings.length} critical
                  </span>
                )}
                {criticalWarnings.length > 0 && regularWarnings.length > 0 && (
                  <span> · </span>
                )}
                {regularWarnings.length > 0 && (
                  <span>{regularWarnings.length} warnings</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canUndo && onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                className="text-[var(--text-secondary)]"
              >
                <Undo2 className="h-4 w-4 mr-1" />
                Undo
              </Button>
            )}
            {scenarios.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowOptimizeModal(true)}
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Auto-Fix All
              </Button>
            )}
          </div>
        </div>

        {/* Recent fix success message */}
        <AnimatePresence>
          {recentFix && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20"
            >
              <div className="flex items-center gap-2 text-emerald-500">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Applied: {recentFix}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warnings List */}
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Critical Warnings */}
            {criticalWarnings.map((warning) => (
              <WarningItem
                key={warning.id}
                warning={warning}
                expanded={expandedWarning === warning.id}
                onToggle={() =>
                  setExpandedWarning(
                    expandedWarning === warning.id ? null : warning.id
                  )
                }
                onApplyFix={handleApplyFix}
              />
            ))}

            {/* Regular Warnings */}
            {regularWarnings.map((warning) => (
              <WarningItem
                key={warning.id}
                warning={warning}
                expanded={expandedWarning === warning.id}
                onToggle={() =>
                  setExpandedWarning(
                    expandedWarning === warning.id ? null : warning.id
                  )
                }
                onApplyFix={handleApplyFix}
              />
            ))}

            {/* Info Warnings (collapsed by default) */}
            {infoWarnings.length > 0 && (
              <div className="p-4 bg-[var(--bg-surface-hover)]">
                <p className="text-sm text-[var(--text-tertiary)]">
                  {infoWarnings.length} optimization suggestion
                  {infoWarnings.length > 1 ? "s" : ""} available
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Optimize Modal */}
      <AnimatePresence>
        {showOptimizeModal && (
          <OptimizeModal
            scenarios={scenarios}
            onApply={handleApplyScenario}
            onClose={() => setShowOptimizeModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================
// WARNING ITEM COMPONENT
// ============================================

interface WarningItemProps {
  warning: ScheduleWarning;
  expanded: boolean;
  onToggle: () => void;
  onApplyFix: (fix: ScheduleFix) => void;
}

function WarningItem({
  warning,
  expanded,
  onToggle,
  onApplyFix,
}: WarningItemProps) {
  const getIcon = () => {
    switch (warning.type) {
      case "deadline_impossible":
      case "schedule_late":
        return <Calendar className="h-5 w-5" />;
      case "weekly_budget_exceeded":
        return <Clock className="h-5 w-5" />;
      case "context_switching":
        return <Shuffle className="h-5 w-5" />;
      case "draft_overlap":
        return <Layers className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getColor = () => {
    switch (warning.severity) {
      case "critical":
        return {
          bg: "bg-red-500/10",
          border: "border-red-500/20",
          text: "text-red-500",
          icon: "bg-red-500/20",
        };
      case "warning":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
          text: "text-amber-500",
          icon: "bg-amber-500/20",
        };
      default:
        return {
          bg: "bg-blue-500/10",
          border: "border-blue-500/20",
          text: "text-blue-500",
          icon: "bg-blue-500/20",
        };
    }
  };

  const colors = getColor();
  const recommendedFix = warning.fixes.find((f) => f.recommended);

  return (
    <div className={cn("transition-colors", expanded && colors.bg)}>
      {/* Warning Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-[var(--bg-surface-hover)] transition-colors"
      >
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            colors.icon
          )}
        >
          <span className={colors.text}>{getIcon()}</span>
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-[var(--text-primary)] truncate">
              {warning.title}
            </p>
            {warning.severity === "critical" && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500/20 text-red-500 rounded">
                Critical
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)] truncate">
            {warning.impact}
          </p>
        </div>

        {/* Quick Fix Button (on non-expanded) */}
        {!expanded && recommendedFix && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onApplyFix(recommendedFix);
            }}
            className={cn(
              "shrink-0 border-[var(--border-subtle)]",
              "hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500"
            )}
          >
            <Zap className="h-3 w-3 mr-1" />
            Quick Fix
          </Button>
        )}

        <ChevronRight
          className={cn(
            "h-5 w-5 text-[var(--text-tertiary)] transition-transform shrink-0",
            expanded && "rotate-90"
          )}
        />
      </button>

      {/* Expanded Fix Options */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Description */}
              <p className="text-sm text-[var(--text-secondary)] pl-14">
                {warning.description}
              </p>

              {/* Fix Options */}
              <div className="pl-14 space-y-2">
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  Fix Options
                </p>
                {warning.fixes.map((fix) => (
                  <FixOption
                    key={fix.id}
                    fix={fix}
                    onApply={() => onApplyFix(fix)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// FIX OPTION COMPONENT
// ============================================

interface FixOptionProps {
  fix: ScheduleFix;
  onApply: () => void;
}

function FixOption({ fix, onApply }: FixOptionProps) {
  const getIcon = () => {
    switch (fix.type) {
      case "extend_deadline":
        return <Calendar className="h-4 w-4" />;
      case "increase_hours":
        return <TrendingUp className="h-4 w-4" />;
      case "spread_work":
        return <Shuffle className="h-4 w-4" />;
      case "consolidate_ias":
        return <Layers className="h-4 w-4" />;
      case "sequence_drafts":
        return <Clock className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getRiskColor = () => {
    switch (fix.risk) {
      case "low":
        return "text-emerald-500";
      case "medium":
        return "text-amber-500";
      case "high":
        return "text-red-500";
      default:
        return "text-[var(--text-tertiary)]";
    }
  };

  return (
    <button
      onClick={onApply}
      className={cn(
        "w-full p-3 rounded-lg text-left transition-all",
        "bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]",
        "hover:border-[var(--border-emphasis)] hover:shadow-md",
        fix.recommended &&
          "ring-2 ring-emerald-500/30 border-emerald-500/30 bg-emerald-500/5"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            fix.recommended
              ? "bg-emerald-500/20 text-emerald-500"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          )}
        >
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-[var(--text-primary)]">
              {fix.label}
            </p>
            {fix.recommended && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-500 rounded">
                Recommended
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {fix.description}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {fix.impact}
          </p>
          {fix.risk && (
            <p className={cn("text-xs", getRiskColor())}>
              {fix.risk} risk
            </p>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
      </div>
    </button>
  );
}

// ============================================
// OPTIMIZE MODAL
// ============================================

interface OptimizeModalProps {
  scenarios: OptimizationScenario[];
  onApply: (scenario: OptimizationScenario) => void;
  onClose: () => void;
}

function OptimizeModal({ scenarios, onApply, onClose }: OptimizeModalProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Auto-Optimize Schedule
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Choose a fix strategy
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <X className="h-5 w-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Scenarios */}
          <div className="p-6 space-y-4">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => onApply(scenario)}
                className={cn(
                  "w-full p-4 rounded-xl text-left transition-all",
                  "bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]",
                  "hover:border-violet-500/50 hover:shadow-lg",
                  scenario.recommended &&
                    "ring-2 ring-violet-500/30 border-violet-500/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      scenario.recommended
                        ? "bg-violet-500/20 text-violet-500"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    )}
                  >
                    {scenario.id === "extend-deadline" ? (
                      <Calendar className="h-5 w-5" />
                    ) : (
                      <TrendingUp className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {scenario.name}
                      </p>
                      {scenario.recommended && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-violet-500/20 text-violet-500 rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {scenario.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {scenario.tradeoffs.map((tradeoff, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-[var(--bg-surface)] text-[var(--text-tertiary)] rounded"
                        >
                          {tradeoff}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)] shrink-0 mt-2" />
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]">
            <Button variant="ghost" onClick={onClose} className="w-full">
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
