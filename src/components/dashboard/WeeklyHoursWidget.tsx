import { useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";
import type { AppState } from "../../types";
import { getWeeklyStats } from "../../services/learning";
import { Clock, CheckCircle2, Calendar } from "lucide-react";

interface WeeklyHoursWidgetProps {
  state: AppState;
}

export function WeeklyHoursWidget({ state }: WeeklyHoursWidgetProps) {
  const stats = useMemo(() => getWeeklyStats(state), [state]);

  const progressPercentage = Math.min(
    (stats.loggedHours / stats.plannedHours) * 100,
    100,
  );

  const getProgressVariant = () => {
    if (progressPercentage >= 100) return "success";
    if (progressPercentage >= 50) return "default";
    return "warning";
  };

  return (
    <Card className="bg-white dark:bg-surface border-slate-200 dark:border-border-subtle">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-500 dark:text-text-secondary uppercase tracking-wide">
            This Week's Progress
          </span>
          <Clock className="h-5 w-5 text-slate-400 dark:text-text-tertiary" />
        </div>

        {/* Hours display */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-bold text-slate-900 dark:text-text-primary font-mono">
            {stats.loggedHours.toFixed(1)}
          </span>
          <span className="text-base text-slate-500 dark:text-text-tertiary">
            / {stats.plannedHours} hrs
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={progressPercentage}
          variant={getProgressVariant()}
          size="default"
          className="mb-4 h-3"
        />

        {/* Stats row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 dark:text-text-tertiary" />
            <span className="text-slate-600 dark:text-text-secondary">
              {stats.sessionsThisWeek} session
              {stats.sessionsThisWeek !== 1 ? "s" : ""} logged
            </span>
          </div>

          {stats.loggedToday ? (
            <div className="flex items-center gap-1.5 text-success font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Active today</span>
            </div>
          ) : (
            <span className="text-slate-500 dark:text-text-tertiary">
              No activity today
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
