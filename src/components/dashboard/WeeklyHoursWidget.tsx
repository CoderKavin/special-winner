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
    <Card className="bg-surface border-border-subtle">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-caption text-text-secondary uppercase tracking-wide">
            This Week's Progress
          </span>
          <Clock className="h-4 w-4 text-text-tertiary" />
        </div>

        {/* Hours display */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-display font-bold text-text-primary font-mono">
            {stats.loggedHours.toFixed(1)}
          </span>
          <span className="text-body-sm text-text-tertiary">
            / {stats.plannedHours} hrs
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={progressPercentage}
          variant={getProgressVariant()}
          size="default"
          className="mb-3"
        />

        {/* Stats row */}
        <div className="flex items-center justify-between text-caption">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-text-tertiary" />
            <span className="text-text-secondary">
              {stats.sessionsThisWeek} session
              {stats.sessionsThisWeek !== 1 ? "s" : ""} logged
            </span>
          </div>

          {stats.loggedToday ? (
            <div className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3 w-3" />
              <span>Active today</span>
            </div>
          ) : (
            <span className="text-text-tertiary">No activity today</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
