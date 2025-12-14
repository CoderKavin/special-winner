import { useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Overall Progress */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Overall Progress</span>
            <Target className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-3xl font-bold mb-2">
            {stats.progressPercentage}%
          </div>
          <Progress
            value={stats.progressPercentage}
            className="h-2 bg-slate-800"
            indicatorClassName="bg-gradient-to-r from-blue-500 to-purple-500"
          />
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{stats.completedMilestones} completed</span>
            <span>{stats.totalMilestones} total milestones</span>
          </div>
        </CardContent>
      </Card>

      {/* IA Status */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">IAs Status</span>
            <CheckCircle2 className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-3xl font-bold mb-3">
            {stats.completed}/{state.ias.length}
          </div>
          <div className="flex gap-2">
            <Badge variant="success" className="text-xs">
              {stats.completed} Done
            </Badge>
            <Badge variant="warning" className="text-xs">
              {stats.inProgress} Active
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {stats.notStarted} Pending
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Days Until Deadline */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Master Deadline</span>
            <Calendar className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-3xl font-bold mb-1">
            {stats.daysLeft > 0 ? stats.daysLeft : 0}
          </div>
          <p className="text-sm text-slate-500">
            {stats.daysLeft > 0 ? "days remaining" : "Deadline passed!"}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {formatDate(state.masterDeadline)}
          </p>
        </CardContent>
      </Card>

      {/* This Week's Tasks */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">This Week</span>
            <Clock className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-3xl font-bold mb-2">
            {stats.thisWeekTasks.length}
          </div>
          <p className="text-sm text-slate-500">tasks due</p>
          {stats.thisWeekTasks.length > 0 && (
            <div className="mt-2 text-xs text-slate-400 truncate">
              Next: {stats.thisWeekTasks[0].milestone_name}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
