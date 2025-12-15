import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import type { GenerationFeasibility } from "../../services/ai";
import {
  AlertTriangle,
  X,
  Calendar,
  Clock,
  TrendingUp,
  ChevronRight,
  Zap,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface ScheduleFeasibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feasibility: GenerationFeasibility | null;
  currentDeadline: string;
  currentWeeklyHours: number;
  onExtendDeadline: (newDeadline: string) => void;
  onIncreaseHours: (newHours: number) => void;
  onProceedAnyway: () => void;
}

export function ScheduleFeasibilityModal({
  open,
  onOpenChange,
  feasibility,
  currentDeadline: _currentDeadline,
  currentWeeklyHours,
  onExtendDeadline,
  onIncreaseHours,
  onProceedAnyway,
}: ScheduleFeasibilityModalProps) {
  void _currentDeadline;
  if (!feasibility || !open) return null;

  const shortage = feasibility.totalHoursNeeded - feasibility.availableHours;
  const multiplier =
    feasibility.availableHours > 0
      ? feasibility.totalHoursNeeded / feasibility.availableHours
      : Infinity;

  // Calculate progress bar width
  const progressPercent = Math.min(
    (feasibility.availableHours / feasibility.totalHoursNeeded) * 100,
    100,
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header with warning gradient */}
              <div className="relative px-6 py-5 bg-gradient-to-r from-red-500/10 to-orange-500/10 border-b border-[var(--border-subtle)]">
                <button
                  onClick={() => onOpenChange(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                      Schedule Conflict
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Not enough time available
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Visual progress comparison */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">
                      Time needed vs available
                    </span>
                    <span className="font-medium text-red-500">
                      {shortage.toFixed(0)}h short
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-8 bg-[var(--bg-surface-hover)] rounded-lg overflow-hidden">
                    {/* Available (what you have) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-lg transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                    {/* Labels */}
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs font-medium text-white drop-shadow-sm z-10">
                        {feasibility.availableHours.toFixed(0)}h available
                      </span>
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {feasibility.totalHoursNeeded.toFixed(0)}h needed
                      </span>
                    </div>
                  </div>

                  {/* Speed required callout */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-lg">
                    <Zap className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-[var(--text-primary)]">
                      Would require working{" "}
                      <span className="font-bold text-red-500">
                        {multiplier.toFixed(1)}x
                      </span>{" "}
                      your normal pace
                    </span>
                  </div>
                </div>

                {/* Compact IA breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      Hours by IA
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {feasibility.breakdown.length} IAs
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {feasibility.breakdown.slice(0, 4).map((item) => (
                      <div
                        key={item.iaId}
                        className="flex items-center justify-between text-sm py-2 px-3 bg-[var(--bg-surface-hover)] rounded-lg"
                      >
                        <span className="text-[var(--text-secondary)] truncate text-xs">
                          {item.iaName
                            .replace(" IA", "")
                            .replace("Commentary ", "")}
                        </span>
                        <span className="font-mono font-medium text-[var(--text-primary)] text-xs ml-2">
                          {item.hoursNeeded.toFixed(0)}h
                        </span>
                      </div>
                    ))}
                  </div>
                  {feasibility.breakdown.length > 4 && (
                    <div className="text-xs text-center text-[var(--text-tertiary)]">
                      +{feasibility.breakdown.length - 4} more
                    </div>
                  )}
                </div>

                {/* Solutions */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    Quick fixes
                  </span>

                  {/* Primary: Extend Deadline */}
                  <button
                    onClick={() => {
                      onExtendDeadline(feasibility.minimumDeadline);
                      onOpenChange(false);
                    }}
                    className="w-full group p-4 text-left bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl hover:from-emerald-500/15 hover:to-emerald-500/10 hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-primary)]">
                          Extend to{" "}
                          {format(
                            parseISO(feasibility.minimumDeadline),
                            "MMM d, yyyy",
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {feasibility.weeksNeeded} weeks at{" "}
                          {currentWeeklyHours}h/week
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </button>

                  {/* Secondary: Increase Hours */}
                  {feasibility.suggestedHoursPerWeek &&
                    feasibility.suggestedHoursPerWeek <= 20 && (
                      <button
                        onClick={() => {
                          onIncreaseHours(feasibility.suggestedHoursPerWeek!);
                          onOpenChange(false);
                        }}
                        className="w-full group p-4 text-left bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--border-emphasis)] transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--text-primary)]">
                              Increase to {feasibility.suggestedHoursPerWeek}
                              h/week
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                              +
                              {feasibility.suggestedHoursPerWeek -
                                currentWeeklyHours}
                              h more per week
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-blue-500 transition-colors" />
                        </div>
                      </button>
                    )}

                  {/* Tertiary: Work on fewer IAs */}
                  <button
                    onClick={() => onOpenChange(false)}
                    className="w-full group p-4 text-left bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--border-emphasis)] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-primary)]">
                          Prioritize fewer IAs
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          Focus on the most urgent ones first
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-orange-500 transition-colors" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <button
                  onClick={() => {
                    onProceedAnyway();
                    onOpenChange(false);
                  }}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Generate anyway
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
