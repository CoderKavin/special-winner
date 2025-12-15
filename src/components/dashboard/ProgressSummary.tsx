import { useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import { ProgressRing } from "../ui/progress";
import { Badge } from "../ui/badge";
import type { AppState } from "../../types";
import { daysUntil, formatDate } from "../../lib/utils";
import { Calendar, Clock, CheckCircle2, Target } from "lucide-react";
import {
  parseISO,
  isWithinInterval,
  addDays,
  startOfDay,
  endOfDay,
} from "date-fns";

interface ProgressSummaryProps {
  state: AppState;
}

export function ProgressSummary({ state }: ProgressSummaryProps) {
  const stats = useMemo(() => {
    const completed = state.ias.filter(
      (ia) => ia.status === "completed",
    ).length;
    const inProgress = state.ias.filter(
      (ia) => ia.status === "in_progress",
    ).length;
    const notStarted = state.ias.filter(
      (ia) => ia.status === "not_started",
    ).length;

    const totalMilestones = state.ias.reduce(
      (sum, ia) => sum + ia.milestones.length,
      0,
    );
    const completedMilestones = state.ias.reduce(
      (sum, ia) => sum + ia.milestones.filter((m) => m.completed).length,
      0,
    );

    const progressPercentage =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    const daysLeft = daysUntil(state.masterDeadline);

    // Get this week's tasks
    const now = new Date();
    const weekEnd = addDays(now, 7);
    const thisWeekTasks = state.ias
      .flatMap((ia) =>
        ia.milestones
          .filter(
            (m) =>
              !m.completed &&
              isWithinInterval(parseISO(m.deadline), {
                start: startOfDay(now),
                end: endOfDay(weekEnd),
              }),
          )
          .map((m) => ({
            ...m,
            iaName: ia.name,
            subjectColor: ia.subjectColor,
          })),
      )
      .sort(
        (a, b) =>
          parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime(),
      );

    return {
      completed,
      inProgress,
      notStarted,
      totalMilestones,
      completedMilestones,
      progressPercentage,
      daysLeft,
      thisWeekTasks,
    };
  }, [state]);

  const getDaysLeftColor = () => {
    if (stats.daysLeft <= 0) return "text-critical";
    if (stats.daysLeft <= 14) return "text-warning";
    if (stats.daysLeft <= 30) return "text-info";
    return "text-success";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {/* Overall Progress */}
      <Card className="bg-white dark:bg-surface border-slate-200 dark:border-border-subtle">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 dark:text-text-secondary uppercase tracking-wide">
              Overall Progress
            </span>
            <Target className="h-5 w-5 text-slate-400 dark:text-text-tertiary" />
          </div>
          <div className="flex items-center gap-5">
            <ProgressRing
              value={stats.progressPercentage}
              size={72}
              strokeWidth={6}
              color="#5E6AD2"
              showLabel={false}
            />
            <div>
              <div className="text-4xl font-bold text-slate-900 dark:text-text-primary">
                {stats.progressPercentage}%
              </div>
              <div className="text-sm text-slate-500 dark:text-text-tertiary mt-1">
                {stats.completedMilestones}/{stats.totalMilestones} milestones
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IA Status */}
      <Card className="bg-white dark:bg-surface border-slate-200 dark:border-border-subtle">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 dark:text-text-secondary uppercase tracking-wide">
              IAs Status
            </span>
            <CheckCircle2 className="h-5 w-5 text-slate-400 dark:text-text-tertiary" />
          </div>
          <div className="text-4xl font-bold text-slate-900 dark:text-text-primary mb-3">
            {stats.completed}
            <span className="text-slate-400 dark:text-text-tertiary">
              /{state.ias.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success" size="lg">
              {stats.completed} Done
            </Badge>
            <Badge variant="warning" size="lg">
              {stats.inProgress} Active
            </Badge>
            <Badge variant="secondary" size="lg">
              {stats.notStarted} Pending
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Days Until Deadline */}
      <Card className="bg-white dark:bg-surface border-slate-200 dark:border-border-subtle">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 dark:text-text-secondary uppercase tracking-wide">
              Master Deadline
            </span>
            <Calendar className="h-5 w-5 text-slate-400 dark:text-text-tertiary" />
          </div>
          <div className={`text-4xl font-bold font-mono ${getDaysLeftColor()}`}>
            {stats.daysLeft > 0 ? stats.daysLeft : 0}
          </div>
          <p className="text-base text-slate-600 dark:text-text-secondary mt-1">
            {stats.daysLeft > 0 ? "days remaining" : "Deadline passed!"}
          </p>
          <p className="text-sm text-slate-500 dark:text-text-tertiary mt-2">
            {formatDate(state.masterDeadline)}
          </p>
        </CardContent>
      </Card>

      {/* This Week's Tasks */}
      <Card className="bg-white dark:bg-surface border-slate-200 dark:border-border-subtle">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-500 dark:text-text-secondary uppercase tracking-wide">
              This Week
            </span>
            <Clock className="h-5 w-5 text-slate-400 dark:text-text-tertiary" />
          </div>
          <div className="text-4xl font-bold text-slate-900 dark:text-text-primary font-mono">
            {stats.thisWeekTasks.length}
          </div>
          <p className="text-base text-slate-600 dark:text-text-secondary mt-1">
            tasks due
          </p>
          {stats.thisWeekTasks.length > 0 && (
            <p className="text-sm text-slate-500 dark:text-text-tertiary mt-2 truncate">
              Next: {stats.thisWeekTasks[0].milestone_name}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
