import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tooltip } from "../ui/tooltip";
import type { AppState } from "../../types";
import { SUBJECT_COLORS } from "../../types";
import { cn, formatShortDate } from "../../lib/utils";
import {
  format,
  parseISO,
  eachMonthOfInterval,
  differenceInDays,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

interface TimelineViewProps {
  state: AppState;
  onMilestoneClick: (iaId: string, milestoneId: string) => void;
}

export function TimelineView({ state, onMilestoneClick }: TimelineViewProps) {
  const [viewYear, setViewYear] = useState(2025);

  const timelineData = useMemo(() => {
    const yearStart = new Date(viewYear, 0, 1);
    const yearEnd = new Date(viewYear, 11, 31);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    const masterDeadline = parseISO(state.masterDeadline);
    const today = new Date();

    // Calculate position of today and master deadline
    const totalDays = differenceInDays(yearEnd, yearStart);
    const todayPosition = isWithinInterval(today, {
      start: yearStart,
      end: yearEnd,
    })
      ? (differenceInDays(today, yearStart) / totalDays) * 100
      : today < yearStart
        ? 0
        : 100;

    const deadlinePosition = isWithinInterval(masterDeadline, {
      start: yearStart,
      end: yearEnd,
    })
      ? (differenceInDays(masterDeadline, yearStart) / totalDays) * 100
      : masterDeadline < yearStart
        ? 0
        : 100;

    // Get all milestones with their positions
    const milestonesData = state.ias.flatMap((ia) =>
      ia.milestones.map((m) => {
        const startDate = parseISO(m.startDate);
        const endDate = parseISO(m.deadline);
        const startPos = isWithinInterval(startDate, {
          start: yearStart,
          end: yearEnd,
        })
          ? (differenceInDays(startDate, yearStart) / totalDays) * 100
          : startDate < yearStart
            ? 0
            : 100;
        const endPos = isWithinInterval(endDate, {
          start: yearStart,
          end: yearEnd,
        })
          ? (differenceInDays(endDate, yearStart) / totalDays) * 100
          : endDate < yearStart
            ? 0
            : 100;

        const isDraft = m.milestone_name.toLowerCase().includes("draft");
        const isOverdue = !m.completed && isBefore(endDate, today);

        return {
          ...m,
          ia,
          startPos,
          endPos,
          width: Math.max(endPos - startPos, 1),
          isDraft,
          isOverdue,
          isVisible:
            isWithinInterval(startDate, { start: yearStart, end: yearEnd }) ||
            isWithinInterval(endDate, { start: yearStart, end: yearEnd }) ||
            (isBefore(startDate, yearStart) && isAfter(endDate, yearEnd)),
        };
      }),
    );

    // Check for draft overlaps
    const draftMilestones = milestonesData.filter(
      (m) => m.isDraft && !m.completed,
    );
    const overlappingDrafts = new Set<string>();

    for (let i = 0; i < draftMilestones.length; i++) {
      for (let j = i + 1; j < draftMilestones.length; j++) {
        const a = draftMilestones[i];
        const b = draftMilestones[j];
        if (a.startPos < b.endPos && b.startPos < a.endPos) {
          overlappingDrafts.add(a.id);
          overlappingDrafts.add(b.id);
        }
      }
    }

    return {
      months,
      todayPosition,
      deadlinePosition,
      milestones: milestonesData,
      overlappingDrafts,
      yearStart,
      yearEnd,
    };
  }, [state, viewYear]);

  // Group milestones by IA
  const iaRows = useMemo(() => {
    return state.ias.map((ia) => ({
      ia,
      milestones: timelineData.milestones.filter(
        (m) => m.ia.id === ia.id && m.isVisible,
      ),
    }));
  }, [state.ias, timelineData.milestones]);

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Timeline View</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-12 text-center">
            {viewYear}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Month headers */}
        <div className="relative mb-2">
          <div className="flex border-b border-slate-700">
            {timelineData.months.map((month, index) => (
              <div
                key={index}
                className="flex-1 text-center text-xs text-slate-400 py-2 border-r border-slate-800 last:border-r-0"
              >
                {format(month, "MMM")}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline container */}
        <div className="relative">
          {/* Today indicator */}
          {timelineData.todayPosition > 0 &&
            timelineData.todayPosition < 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20"
                style={{ left: `${timelineData.todayPosition}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                  Today
                </div>
              </div>
            )}

          {/* Master deadline indicator */}
          {timelineData.deadlinePosition > 0 &&
            timelineData.deadlinePosition < 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                style={{ left: `${timelineData.deadlinePosition}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                  Deadline
                </div>
              </div>
            )}

          {/* IA rows */}
          <div className="space-y-2 pt-6">
            {iaRows.map(({ ia, milestones }) => {
              const colors = SUBJECT_COLORS[ia.subjectColor];

              return (
                <div key={ia.id} className="flex items-center gap-3">
                  {/* IA label */}
                  <div className="w-32 shrink-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          colors.border.replace("border", "bg"),
                        )}
                      />
                      <span className="text-xs text-slate-400 truncate">
                        {ia.name.split(" ")[0]}
                      </span>
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-8 bg-slate-800/50 rounded">
                    {milestones.map((milestone) => {
                      const isOverlapping = timelineData.overlappingDrafts.has(
                        milestone.id,
                      );
                      const bgColor = milestone.completed
                        ? "bg-green-500/60"
                        : milestone.isOverdue
                          ? "bg-red-500/60"
                          : isOverlapping
                            ? "bg-red-500/40"
                            : colors.border
                                .replace("border", "bg")
                                .replace("500", "500/60");

                      return (
                        <Tooltip
                          key={milestone.id}
                          content={
                            <div className="space-y-1">
                              <div className="font-medium">
                                {milestone.milestone_name}
                              </div>
                              <div className="text-xs text-slate-400">
                                {formatShortDate(milestone.startDate)} →{" "}
                                {formatShortDate(milestone.deadline)}
                              </div>
                              <div className="text-xs flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(
                                  milestone.estimated_hours *
                                  milestone.buffer_multiplier
                                ).toFixed(1)}{" "}
                                hours
                              </div>
                              {isOverlapping && (
                                <div className="text-xs text-red-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Overlaps with another draft phase
                                </div>
                              )}
                            </div>
                          }
                          side="top"
                        >
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            style={{
                              left: `${milestone.startPos}%`,
                              width: `${milestone.width}%`,
                            }}
                            className={cn(
                              "absolute top-1 bottom-1 rounded cursor-pointer transition-all",
                              "hover:ring-2 hover:ring-white/30",
                              bgColor,
                              milestone.completed && "opacity-60",
                              isOverlapping &&
                                "ring-2 ring-red-500 ring-offset-1 ring-offset-slate-900",
                            )}
                            onClick={() =>
                              onMilestoneClick(ia.id, milestone.id)
                            }
                          >
                            {milestone.width > 8 && (
                              <span className="absolute inset-0 flex items-center justify-center text-xs text-white/80 truncate px-1">
                                {milestone.milestone_name.split(" ")[0]}
                              </span>
                            )}
                          </motion.div>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>Master Deadline</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 rounded bg-green-500/60" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 rounded ring-2 ring-red-500 bg-transparent" />
              <span>Conflict</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
