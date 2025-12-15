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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Overall Progress */}
      <Card className="bg-surface border-border-subtle">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption text-text-secondary uppercase tracking-wide">
              Overall Progress
            </span>
            <Target className="h-4 w-4 text-text-tertiary" />
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing
              value={stats.progressPercentage}
              size={56}
              strokeWidth={5}
              color="#5E6AD2"
              showLabel={false}
            />
            <div>
              <div className="text-display font-bold text-text-primary">
                {stats.progressPercentage}%
              </div>
              <div className="text-caption text-text-tertiary">
                {stats.completedMilestones}/{stats.totalMilestones} milestones
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IA Status */}
      <Card className="bg-surface border-border-subtle">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption text-text-secondary uppercase tracking-wide">
              IAs Status
            </span>
            <CheckCircle2 className="h-4 w-4 text-text-tertiary" />
          </div>
          <div className="text-display font-bold text-text-primary mb-2">
            {stats.completed}
            <span className="text-text-tertiary">/{state.ias.length}</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="success" size="sm">
              {stats.completed} Done
            </Badge>
            <Badge variant="warning" size="sm">
              {stats.inProgress} Active
            </Badge>
            <Badge variant="secondary" size="sm">
              {stats.notStarted} Pending
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Days Until Deadline */}
      <Card className="bg-surface border-border-subtle">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption text-text-secondary uppercase tracking-wide">
              Master Deadline
            </span>
            <Calendar className="h-4 w-4 text-text-tertiary" />
          </div>
          <div
            className={`text-display font-bold font-mono ${getDaysLeftColor()}`}
          >
            {stats.daysLeft > 0 ? stats.daysLeft : 0}
          </div>
          <p className="text-body-sm text-text-secondary">
            {stats.daysLeft > 0 ? "days remaining" : "Deadline passed!"}
          </p>
          <p className="text-caption text-text-tertiary mt-1">
            {formatDate(state.masterDeadline)}
          </p>
        </CardContent>
      </Card>

      {/* This Week's Tasks */}
      <Card className="bg-surface border-border-subtle">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-caption text-text-secondary uppercase tracking-wide">
              This Week
            </span>
            <Clock className="h-4 w-4 text-text-tertiary" />
          </div>
          <div className="text-display font-bold text-text-primary font-mono">
            {stats.thisWeekTasks.length}
          </div>
          <p className="text-body-sm text-text-secondary">tasks due</p>
          {stats.thisWeekTasks.length > 0 && (
            <p className="text-caption text-text-tertiary mt-1 truncate">
              Next: {stats.thisWeekTasks[0].milestone_name}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
