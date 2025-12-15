import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tooltip } from "../ui/tooltip";
import type {
  AppState,
  MilestonePhase,
  CognitiveLoad,
  Milestone,
  IA,
} from "../../types";
import {
  SUBJECT_COLORS,
  DEFAULT_DEEP_WORK_SETTINGS,
  DEFAULT_ENERGY_SETTINGS,
} from "../../types";
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
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Focus,
  Shuffle,
  Lock,
  Zap,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
} from "lucide-react";
import { Button } from "../ui/button";
import { detectMilestonePhase } from "../../services/learning";
import {
  isDeepWorkPhase,
  getMinimumSessionHours,
} from "../../services/deepwork";
import {
  getCognitiveLoad,
  isEnergyMatch,
  getEnergyMismatchPenalty,
  getCognitiveLoadColor,
  getCognitiveLoadLabel,
} from "../../services/energy";

interface TimelineViewProps {
  state: AppState;
  onMilestoneClick: (iaId: string) => void;
}

export function TimelineView({ state, onMilestoneClick }: TimelineViewProps) {
  const [viewYear, setViewYear] = useState(2025);
  const [showEnergyOverlay, setShowEnergyOverlay] = useState(true);

  const settings = state.deepWorkSettings || DEFAULT_DEEP_WORK_SETTINGS;
  const energySettings = state.energySettings || DEFAULT_ENERGY_SETTINGS;

  const timelineData = useMemo<{
    months: Date[];
    todayPosition: number;
    deadlinePosition: number;
    milestones: Array<
      Milestone & {
        ia: IA;
        startPos: number;
        endPos: number;
        width: number;
        phase: MilestonePhase;
        isDeepWork: boolean;
        isDraft: boolean;
        isOverdue: boolean;
        isBelowMinimum: boolean;
        minimumHours: number;
        scheduledHours: number;
        cognitiveLoad: CognitiveLoad;
        energyMatched: boolean;
        energyPenalty: number;
        isVisible: boolean;
      }
    >;
    overlappingDrafts: Set<string>;
    contextSwitchDays: Set<string>;
    yearStart: Date;
    yearEnd: Date;
  }>(() => {
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

        const phase = m.phase || detectMilestonePhase(m.milestone_name);
        const isDeepWork = isDeepWorkPhase(phase);
        const isDraft = phase === "draft";
        const isOverdue = !m.completed && isBefore(endDate, today);
        const scheduledHours = m.estimated_hours * m.buffer_multiplier;
        const minimumHours = getMinimumSessionHours(phase, settings);
        const isBelowMinimum = scheduledHours < minimumHours && isDeepWork;

        // Energy/cognitive load analysis
        const cognitiveLoad = getCognitiveLoad(ia.subjectColor, phase);
        // For now, assume average energy level is "medium" for scheduling analysis
        // In a real scenario, this would check specific scheduled times
        const assumedEnergyLevel = cognitiveLoad === "high" ? "high" : "medium";
        const energyMatched = isEnergyMatch(cognitiveLoad, assumedEnergyLevel);
        const energyPenalty = energyMatched
          ? 0
          : getEnergyMismatchPenalty(cognitiveLoad, "medium", energySettings);

        return {
          ...m,
          ia,
          startPos,
          endPos,
          width: Math.max(endPos - startPos, 1),
          phase,
          isDeepWork,
          isDraft,
          isOverdue,
          isBelowMinimum,
          minimumHours,
          scheduledHours,
          cognitiveLoad,
          energyMatched,
          energyPenalty,
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

    // Check for context switches (same day, different IAs)
    const contextSwitchDays = new Set<string>();
    const dateGroups = new Map<string, Set<string>>();

    for (const m of milestonesData) {
      if (m.completed) continue;
      const start = parseISO(m.startDate);
      const end = parseISO(m.deadline);
      const dayCount = differenceInDays(end, start) + 1;

      for (let d = 0; d < dayCount; d++) {
        const date = format(
          new Date(start.getTime() + d * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd",
        );
        const existing = dateGroups.get(date) || new Set();
        existing.add(m.ia.id);
        dateGroups.set(date, existing);

        if (existing.size > settings.maxIAsPerDay) {
          contextSwitchDays.add(date);
        }
      }
    }

    return {
      months,
      todayPosition,
      deadlinePosition,
      milestones: milestonesData,
      overlappingDrafts,
      contextSwitchDays,
      yearStart,
      yearEnd,
    };
  }, [state, viewYear, settings, energySettings]);

  // Group milestones by IA
  const iaRows = useMemo(() => {
    return state.ias.map((ia) => ({
      ia,
      milestones: timelineData.milestones.filter(
        (m) => m.ia.id === ia.id && m.isVisible,
      ),
    }));
  }, [state.ias, timelineData.milestones]);

  const getPhaseLabel = (phase: MilestonePhase): string => {
    const labels: Record<MilestonePhase, string> = {
      research: "Research",
      outline: "Outline",
      draft: "Draft",
      revision: "Revision",
      polish: "Polish",
    };
    return labels[phase];
  };

  const getCognitiveLoadIcon = (load: CognitiveLoad) => {
    switch (load) {
      case "high":
        return BatteryFull;
      case "medium":
        return BatteryMedium;
      case "low":
        return BatteryLow;
    }
  };

  return (
    <Card variant="elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-h3">Timeline View</CardTitle>
        <div className="flex items-center gap-3">
          {/* Energy overlay toggle */}
          <Button
            variant={showEnergyOverlay ? "default" : "outline"}
            size="sm"
            onClick={() => setShowEnergyOverlay(!showEnergyOverlay)}
            className={cn(
              "gap-2",
              showEnergyOverlay && "bg-warning hover:bg-warning/90",
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            Energy
          </Button>

          {/* Year navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewYear((y) => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-body-sm font-medium w-12 text-center text-text-primary">
              {viewYear}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewYear((y) => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Month headers */}
        <div className="relative mb-3">
          <div className="flex border-b border-border-subtle">
            {timelineData.months.map((month, index) => (
              <div
                key={index}
                className="flex-1 text-center text-caption text-text-tertiary py-2 border-r border-border-subtle last:border-r-0"
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
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
                style={{ left: `${timelineData.todayPosition}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-white text-caption px-2 py-0.5 rounded whitespace-nowrap">
                  Today
                </div>
              </div>
            )}

          {/* Master deadline indicator */}
          {timelineData.deadlinePosition > 0 &&
            timelineData.deadlinePosition < 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-critical z-20"
                style={{ left: `${timelineData.deadlinePosition}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-critical text-white text-caption px-2 py-0.5 rounded whitespace-nowrap">
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
                      <span className="text-caption text-text-secondary truncate">
                        {ia.name.split(" ")[0]}
                      </span>
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-10 bg-surface-hover rounded-md">
                    {milestones.map((milestone) => {
                      const isOverlapping = timelineData.overlappingDrafts.has(
                        milestone.id,
                      );
                      const hasIssue =
                        isOverlapping || milestone.isBelowMinimum;

                      // Determine background color and style based on state
                      const bgColor = milestone.completed
                        ? "bg-success/60"
                        : milestone.isOverdue
                          ? "bg-critical/60"
                          : isOverlapping
                            ? "bg-critical/40"
                            : milestone.isBelowMinimum
                              ? "bg-warning/40"
                              : colors.border
                                  .replace("border", "bg")
                                  .replace("500", "500/60");

                      // Deep work milestones get thicker bars and special styling
                      const barHeight = milestone.isDeepWork
                        ? "top-0.5 bottom-0.5"
                        : "top-1.5 bottom-1.5";
                      const borderStyle = milestone.isDeepWork
                        ? "border-l-2 border-[#A855F7]"
                        : "";

                      return (
                        <Tooltip
                          key={milestone.id}
                          content={
                            <div className="space-y-2 max-w-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-text-primary">
                                  {milestone.milestone_name}
                                </span>
                                {milestone.isDeepWork && (
                                  <span className="text-caption bg-[#A855F7]/20 text-[#A855F7] px-1.5 py-0.5 rounded">
                                    <Focus className="h-3 w-3 inline mr-1" />
                                    Deep Work
                                  </span>
                                )}
                              </div>

                              <div className="text-caption text-text-tertiary">
                                {formatShortDate(milestone.startDate)} →{" "}
                                {formatShortDate(milestone.deadline)}
                              </div>

                              <div className="text-caption flex items-center gap-2 text-text-secondary">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {milestone.scheduledHours.toFixed(1)} hours
                                </span>
                                <span className="text-text-tertiary">
                                  ({getPhaseLabel(milestone.phase)})
                                </span>
                              </div>

                              {/* Cognitive Load indicator */}
                              {showEnergyOverlay && (
                                <div
                                  className={cn(
                                    "text-caption flex items-center gap-1 px-2 py-1 rounded",
                                    getCognitiveLoadColor(
                                      milestone.cognitiveLoad,
                                    ),
                                  )}
                                >
                                  {(() => {
                                    const LoadIcon = getCognitiveLoadIcon(
                                      milestone.cognitiveLoad,
                                    );
                                    return <LoadIcon className="h-3 w-3" />;
                                  })()}
                                  {getCognitiveLoadLabel(
                                    milestone.cognitiveLoad,
                                  )}{" "}
                                  Cognitive Load
                                  {milestone.energyPenalty > 0 && (
                                    <span className="ml-1 text-critical">
                                      (-{milestone.energyPenalty}% if
                                      mismatched)
                                    </span>
                                  )}
                                </div>
                              )}

                              {milestone.isBelowMinimum && (
                                <div className="text-caption text-warning flex items-center gap-1 bg-warning/10 px-2 py-1 rounded">
                                  <AlertTriangle className="h-3 w-3" />
                                  Below minimum ({milestone.minimumHours}h
                                  needed for {milestone.phase})
                                </div>
                              )}

                              {isOverlapping && (
                                <div className="text-caption text-critical flex items-center gap-1 bg-critical/10 px-2 py-1 rounded">
                                  <Shuffle className="h-3 w-3" />
                                  Overlaps with another draft phase
                                </div>
                              )}

                              {milestone.isDeepWork && !hasIssue && (
                                <div className="text-caption text-[#A855F7] flex items-center gap-1">
                                  <Lock className="h-3 w-3" />
                                  Protected focus time
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
                              "absolute rounded cursor-pointer transition-all duration-normal",
                              "hover:ring-2 hover:ring-white/20",
                              barHeight,
                              bgColor,
                              borderStyle,
                              milestone.completed && "opacity-60",
                              isOverlapping &&
                                "ring-2 ring-critical ring-offset-1 ring-offset-surface",
                              milestone.isBelowMinimum &&
                                !isOverlapping &&
                                "ring-2 ring-warning/50 ring-offset-1 ring-offset-surface",
                              milestone.isDeepWork &&
                                !hasIssue &&
                                !milestone.completed &&
                                "ring-1 ring-[#A855F7]/30",
                            )}
                            onClick={() => onMilestoneClick(ia.id)}
                          >
                            {/* Cognitive load indicator when energy overlay is on */}
                            {showEnergyOverlay &&
                              !milestone.completed &&
                              milestone.width > 2 && (
                                <div
                                  className={cn(
                                    "absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center",
                                    milestone.cognitiveLoad === "high"
                                      ? "bg-success"
                                      : milestone.cognitiveLoad === "medium"
                                        ? "bg-warning"
                                        : "bg-critical",
                                  )}
                                >
                                  {(() => {
                                    const LoadIcon = getCognitiveLoadIcon(
                                      milestone.cognitiveLoad,
                                    );
                                    return (
                                      <LoadIcon className="h-2.5 w-2.5 text-white" />
                                    );
                                  })()}
                                </div>
                              )}

                            {/* Deep work indicator icon */}
                            {milestone.isDeepWork &&
                              !milestone.completed &&
                              milestone.width > 3 && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#A855F7] rounded-full flex items-center justify-center">
                                  <Focus className="h-2 w-2 text-white" />
                                </div>
                              )}

                            {/* Warning indicator */}
                            {hasIssue && milestone.width > 3 && (
                              <div className="absolute -top-1 -left-1 w-3 h-3 bg-warning rounded-full flex items-center justify-center">
                                <AlertTriangle className="h-2 w-2 text-white" />
                              </div>
                            )}

                            {milestone.width > 8 && (
                              <span className="absolute inset-0 flex items-center justify-center text-caption text-white/80 truncate px-1">
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
          <div className="flex flex-wrap items-center justify-end gap-4 mt-6 pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <div className="w-3 h-3 rounded bg-primary" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <div className="w-3 h-3 rounded bg-critical" />
              <span>Deadline</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <div className="w-3 h-3 rounded bg-success/60" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <div className="w-3 h-4 rounded bg-surface-hover border-l-2 border-[#A855F7]" />
              <span>Deep Work</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <div className="w-3 h-3 rounded ring-2 ring-warning bg-transparent" />
              <span>Below Minimum</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <div className="w-3 h-3 rounded ring-2 ring-critical bg-transparent" />
              <span>Conflict</span>
            </div>
          </div>

          {/* Energy Legend - shown when energy overlay is active */}
          {showEnergyOverlay && (
            <div className="flex flex-wrap items-center justify-end gap-4 mt-3 pt-3 border-t border-border-subtle/50">
              <span className="text-caption text-warning font-medium">
                Cognitive Load:
              </span>
              <div className="flex items-center gap-2 text-caption text-text-tertiary">
                <div className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
                  <BatteryFull className="h-2.5 w-2.5 text-white" />
                </div>
                <span>High (needs peak energy)</span>
              </div>
              <div className="flex items-center gap-2 text-caption text-text-tertiary">
                <div className="w-4 h-4 rounded-full bg-warning flex items-center justify-center">
                  <BatteryMedium className="h-2.5 w-2.5 text-white" />
                </div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2 text-caption text-text-tertiary">
                <div className="w-4 h-4 rounded-full bg-critical flex items-center justify-center">
                  <BatteryLow className="h-2.5 w-2.5 text-white" />
                </div>
                <span>Low</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
