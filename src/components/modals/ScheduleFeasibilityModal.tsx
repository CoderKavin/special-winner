import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import type { GenerationFeasibility } from "../../services/ai";
import {
  AlertTriangle,
  X,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
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
  // currentDeadline is available for future use if needed
  void _currentDeadline;
  if (!feasibility || !open) return null;

  const shortage = feasibility.totalHoursNeeded - feasibility.availableHours;
  const multiplier =
    feasibility.availableHours > 0
      ? (feasibility.totalHoursNeeded / feasibility.availableHours).toFixed(1)
      : "∞";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg bg-white dark:bg-surface border border-slate-200 dark:border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-border-subtle bg-red-50 dark:bg-critical/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-critical/20 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-critical" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-text-primary">
                      Impossible Schedule
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-text-secondary">
                      The current timeline cannot work
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-slate-50 dark:bg-surface-hover border-slate-200 dark:border-border-subtle">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-text-tertiary mb-1">
                        <Clock className="h-4 w-4" />
                        Hours Needed
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-text-primary">
                        {feasibility.totalHoursNeeded.toFixed(0)}h
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-50 dark:bg-surface-hover border-slate-200 dark:border-border-subtle">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-text-tertiary mb-1">
                        <Calendar className="h-4 w-4" />
                        Hours Available
                      </div>
                      <div className="text-2xl font-bold text-critical">
                        {feasibility.availableHours.toFixed(0)}h
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Explanation */}
                <div className="p-4 bg-red-50 dark:bg-critical/5 border border-red-200 dark:border-critical/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-critical shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-700 dark:text-text-secondary">
                      <p className="font-medium text-slate-900 dark:text-text-primary mb-1">
                        {shortage.toFixed(0)} hours short
                      </p>
                      <p>
                        You would need to work{" "}
                        <span className="font-semibold text-critical">
                          {multiplier}x faster
                        </span>{" "}
                        than your {currentWeeklyHours}h/week budget allows. This
                        is physically impossible.
                      </p>
                    </div>
                  </div>
                </div>

                {/* IA Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-text-secondary mb-3">
                    Hours by IA
                  </h3>
                  <div className="space-y-2">
                    {feasibility.breakdown.map((item) => (
                      <div
                        key={item.iaId}
                        className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 dark:bg-surface-hover rounded-lg"
                      >
                        <span className="text-slate-700 dark:text-text-secondary truncate">
                          {item.iaName}
                        </span>
                        <span className="font-mono font-medium text-slate-900 dark:text-text-primary">
                          {item.hoursNeeded.toFixed(0)}h ({item.weeksNeeded}w)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Solutions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-text-secondary">
                    Solutions
                  </h3>

                  {/* Option 1: Extend Deadline */}
                  <button
                    onClick={() => {
                      onExtendDeadline(feasibility.minimumDeadline);
                      onOpenChange(false);
                    }}
                    className="w-full p-4 text-left bg-emerald-50 dark:bg-success/10 border border-emerald-200 dark:border-success/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-success/15 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                        <Calendar className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-text-primary">
                          Extend Deadline
                        </div>
                        <div className="text-sm text-slate-600 dark:text-text-secondary">
                          Move to{" "}
                          {format(
                            parseISO(feasibility.minimumDeadline),
                            "MMMM d, yyyy",
                          )}{" "}
                          ({feasibility.weeksNeeded} weeks needed)
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-success ml-auto shrink-0" />
                    </div>
                  </button>

                  {/* Option 2: Increase Hours (if reasonable) */}
                  {feasibility.suggestedHoursPerWeek &&
                    feasibility.suggestedHoursPerWeek <= 20 && (
                      <button
                        onClick={() => {
                          onIncreaseHours(feasibility.suggestedHoursPerWeek!);
                          onOpenChange(false);
                        }}
                        className="w-full p-4 text-left bg-blue-50 dark:bg-info/10 border border-blue-200 dark:border-info/20 rounded-xl hover:bg-blue-100 dark:hover:bg-info/15 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center shrink-0">
                            <TrendingUp className="h-5 w-5 text-info" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-text-primary">
                              Increase Weekly Hours
                            </div>
                            <div className="text-sm text-slate-600 dark:text-text-secondary">
                              Work {feasibility.suggestedHoursPerWeek}h/week
                              instead of {currentWeeklyHours}h/week
                            </div>
                          </div>
                        </div>
                      </button>
                    )}

                  {/* Option 3: Reduce Scope */}
                  <div className="p-4 bg-slate-50 dark:bg-surface-hover border border-slate-200 dark:border-border-subtle rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-border-emphasis flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-slate-500 dark:text-text-tertiary" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-text-primary">
                          Reduce Scope
                        </div>
                        <div className="text-sm text-slate-600 dark:text-text-secondary">
                          Complete fewer IAs by the current deadline. Prioritize
                          the most important ones.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-border-subtle bg-slate-50 dark:bg-surface-hover">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onProceedAnyway();
                    onOpenChange(false);
                  }}
                  className="text-slate-600 dark:text-text-secondary"
                >
                  Generate Anyway (Not Recommended)
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
