import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

import { Timer } from "../timer/Timer";
import type {
  IA,
  Milestone,
  ActiveTimer,
  LearnedMultipliers,
} from "../../types";
import { SUBJECT_COLORS } from "../../types";
import {
  cn,
  formatShortDate,
  daysUntilText,
  getProgressPercentage,
} from "../../lib/utils";
import {
  Clock,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  Sparkles,
  Edit2,
  Save,
  X,
  Timer as TimerIcon,
  Plus,
  History,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { parseISO, isBefore, format } from "date-fns";
import confetti from "canvas-confetti";
import {
  getAdjustedEstimate,
  detectMilestonePhase,
} from "../../services/learning";

interface IADetailModalProps {
  ia: IA;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleMilestone: (milestoneId: string) => void;
  onUpdateDeadline: (milestoneId: string, newDeadline: string) => void;
  onGeneratePlan: () => void;
  isGenerating?: boolean;
  // Time tracking props
  activeTimer: ActiveTimer | null;
  learnedMultipliers: LearnedMultipliers;
  onStartTimer: (iaId: string, milestoneId: string) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onStopTimer: (note?: string) => void;
  onCancelTimer: () => void;
  onLogManualHours: (
    iaId: string,
    milestoneId: string,
    hours: number,
    note?: string,
  ) => void;
}

export function IADetailModal({
  ia,
  open,
  onOpenChange,
  onToggleMilestone,
  onUpdateDeadline,
  onGeneratePlan,
  isGenerating = false,
  activeTimer,
  learnedMultipliers,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onStopTimer,
  onCancelTimer,
  onLogManualHours,
}: IADetailModalProps) {
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(
    null,
  );
  const [manualHours, setManualHours] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [showManualLog, setShowManualLog] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set(),
  );

  const colors = SUBJECT_COLORS[ia.subjectColor];
  const progress = getProgressPercentage(ia.milestones);
  const totalHours = ia.milestones.reduce(
    (sum, m) => sum + m.estimated_hours * m.buffer_multiplier,
    0,
  );
  const totalActualHours = ia.milestones.reduce(
    (sum, m) => sum + (m.actualHours || 0),
    0,
  );

  const handleCheckMilestone = (milestone: Milestone) => {
    if (!milestone.completed) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ef4444"],
      });
    }
    onToggleMilestone(milestone.id);
  };

  const startEditingDeadline = (milestone: Milestone) => {
    setEditingMilestone(milestone.id);
    setEditDate(milestone.deadline);
  };

  const saveDeadline = (milestoneId: string) => {
    onUpdateDeadline(milestoneId, editDate);
    setEditingMilestone(null);
    setEditDate("");
  };

  const cancelEditing = () => {
    setEditingMilestone(null);
    setEditDate("");
  };

  const handleLogManualHours = (milestoneId: string) => {
    const hours = parseFloat(manualHours);
    if (isNaN(hours) || hours <= 0) return;

    onLogManualHours(ia.id, milestoneId, hours, manualNote || undefined);
    setManualHours("");
    setManualNote("");
    setShowManualLog(false);
  };

  const toggleSessionExpanded = (milestoneId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const isTimerActiveForMilestone = (milestoneId: string) => {
    return activeTimer?.milestoneId === milestoneId;
  };

  const getMilestoneForTimer = () => {
    if (!activeTimer) return undefined;
    return ia.milestones.find((m) => m.id === activeTimer.milestoneId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                colors.border.replace("border", "bg"),
              )}
            />
            {ia.name}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {ia.type} • {ia.wordCount.toLocaleString()} words
          </DialogDescription>
        </DialogHeader>

        {/* Progress overview */}
        <div className="space-y-3 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Overall Progress</span>
            <span className={cn("font-medium", colors.text)}>{progress}%</span>
          </div>
          <Progress
            value={progress}
            className="h-2 bg-slate-800"
            indicatorClassName={colors.border.replace("border", "bg")}
          />
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {ia.milestones.filter((m) => m.completed).length} of{" "}
              {ia.milestones.length} milestones completed
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {totalHours.toFixed(1)} hrs estimated
              </span>
              {totalActualHours > 0 && (
                <span className="flex items-center gap-1 text-blue-400">
                  <TimerIcon className="h-3 w-3" />
                  {totalActualHours.toFixed(1)} hrs logged
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Active Timer Banner */}
        {activeTimer && activeTimer.iaId === ia.id && (
          <div className="py-4 border-b border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <TimerIcon className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">
                Timer Active: {getMilestoneForTimer()?.milestone_name}
              </span>
            </div>
            <Timer
              activeTimer={activeTimer}
              milestone={getMilestoneForTimer()}
              onStart={() => {}}
              onPause={onPauseTimer}
              onResume={onResumeTimer}
              onStop={onStopTimer}
              onCancel={onCancelTimer}
            />
          </div>
        )}

        {/* Milestones list */}
        {ia.milestones.length > 0 ? (
          <div className="space-y-3 py-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Milestones
            </h3>
            <AnimatePresence>
              {ia.milestones.map((milestone, index) => {
                const isOverdue =
                  !milestone.completed &&
                  isBefore(parseISO(milestone.deadline), new Date());
                const isEditing = editingMilestone === milestone.id;
                const isTimerActive = isTimerActiveForMilestone(milestone.id);
                const hasTimer = activeTimer !== null;
                const sessionsExpanded = expandedSessions.has(milestone.id);
                const sessions = milestone.workSessions || [];

                // Get adjusted estimate
                const adjustedEstimate = getAdjustedEstimate(
                  milestone,
                  ia.subjectColor,
                  learnedMultipliers,
                );
                const phase =
                  milestone.phase ||
                  detectMilestonePhase(milestone.milestone_name);

                return (
                  <motion.div
                    key={milestone.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      milestone.completed
                        ? "bg-green-500/5 border-green-500/20"
                        : isOverdue
                          ? "bg-red-500/5 border-red-500/20"
                          : isTimerActive
                            ? "bg-blue-500/5 border-blue-500/30"
                            : "bg-slate-800/50 border-slate-700",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <Checkbox
                          checked={milestone.completed}
                          onCheckedChange={() =>
                            handleCheckMilestone(milestone)
                          }
                          className={cn(
                            milestone.completed &&
                              "bg-green-500 border-green-500",
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "font-medium",
                              milestone.completed
                                ? "text-green-400 line-through"
                                : isOverdue
                                  ? "text-red-300"
                                  : "text-slate-200",
                            )}
                          >
                            {milestone.milestone_name}
                          </span>
                          {milestone.completed && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {isOverdue && !milestone.completed && (
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          )}
                          {isTimerActive && (
                            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                              Recording
                            </span>
                          )}
                          <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                            {phase}
                          </span>
                        </div>

                        <p className="text-sm text-slate-400 mb-2">
                          {milestone.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          {/* Deadline */}
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="h-7 w-36 text-xs bg-slate-900 border-slate-600"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => saveDeadline(milestone.id)}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={cancelEditing}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingDeadline(milestone)}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/50 transition-colors",
                                isOverdue ? "text-red-400" : "text-slate-400",
                              )}
                            >
                              <Calendar className="h-3 w-3" />
                              <span>{formatShortDate(milestone.deadline)}</span>
                              <Edit2 className="h-2.5 w-2.5 ml-1 opacity-50" />
                            </button>
                          )}

                          {/* Days indicator */}
                          {!milestone.completed && !isEditing && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full",
                                isOverdue
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-slate-700 text-slate-400",
                              )}
                            >
                              {daysUntilText(milestone.deadline)}
                            </span>
                          )}

                          {/* Estimated hours with adjusted estimate */}
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3" />
                            {adjustedEstimate.appliedMultiplier !== 1 ? (
                              <span className="flex items-center gap-1">
                                <span className="line-through opacity-50">
                                  {adjustedEstimate.originalHours.toFixed(1)}
                                </span>
                                <span
                                  className={cn(
                                    adjustedEstimate.appliedMultiplier > 1
                                      ? "text-orange-400"
                                      : "text-green-400",
                                  )}
                                >
                                  {adjustedEstimate.adjustedHours.toFixed(1)}{" "}
                                  hrs
                                </span>
                                {adjustedEstimate.appliedMultiplier > 1 ? (
                                  <TrendingUp className="h-3 w-3 text-orange-400" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 text-green-400" />
                                )}
                              </span>
                            ) : (
                              <span>
                                {adjustedEstimate.originalHours.toFixed(1)} hrs
                              </span>
                            )}
                          </span>

                          {/* Actual hours logged */}
                          {milestone.actualHours &&
                            milestone.actualHours > 0 && (
                              <span className="flex items-center gap-1 text-blue-400">
                                <TimerIcon className="h-3 w-3" />
                                {milestone.actualHours.toFixed(1)} hrs logged
                              </span>
                            )}

                          {/* Completed date */}
                          {milestone.completed && milestone.completedAt && (
                            <span className="text-green-400/70">
                              Completed {formatShortDate(milestone.completedAt)}
                            </span>
                          )}
                        </div>

                        {/* Timer and Session Controls */}
                        {!milestone.completed && (
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Start Timer Button */}
                              {!isTimerActive && !hasTimer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    onStartTimer(ia.id, milestone.id)
                                  }
                                >
                                  <TimerIcon className="h-3 w-3" />
                                  Start Timer
                                </Button>
                              )}

                              {/* Manual Log Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  setSelectedMilestone(milestone.id);
                                  setShowManualLog(true);
                                }}
                              >
                                <Plus className="h-3 w-3" />
                                Log Hours
                              </Button>

                              {/* View Sessions Button */}
                              {sessions.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    toggleSessionExpanded(milestone.id)
                                  }
                                >
                                  <History className="h-3 w-3" />
                                  {sessions.length} session
                                  {sessions.length !== 1 ? "s" : ""}
                                  {sessionsExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>

                            {/* Manual Hour Logging Form */}
                            {showManualLog &&
                              selectedMilestone === milestone.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-3 p-3 bg-slate-800 rounded-lg"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <Input
                                      type="number"
                                      step="0.25"
                                      min="0.25"
                                      placeholder="Hours"
                                      value={manualHours}
                                      onChange={(e) =>
                                        setManualHours(e.target.value)
                                      }
                                      className="w-20 h-8 text-sm"
                                    />
                                    <Input
                                      placeholder="Note (optional)"
                                      value={manualNote}
                                      onChange={(e) =>
                                        setManualNote(e.target.value)
                                      }
                                      className="flex-1 h-8 text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleLogManualHours(milestone.id)
                                      }
                                      disabled={
                                        !manualHours ||
                                        parseFloat(manualHours) <= 0
                                      }
                                    >
                                      Log
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setShowManualLog(false);
                                        setManualHours("");
                                        setManualNote("");
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </motion.div>
                              )}

                            {/* Work Sessions History */}
                            <AnimatePresence>
                              {sessionsExpanded && sessions.length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-3 space-y-2"
                                >
                                  {sessions.map((session) => (
                                    <div
                                      key={session.id}
                                      className="flex items-center justify-between p-2 bg-slate-800/50 rounded text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3 text-slate-500" />
                                        <span className="text-slate-300">
                                          {format(
                                            parseISO(session.startTime),
                                            "MMM d, h:mm a",
                                          )}
                                        </span>
                                        {session.note && (
                                          <span className="text-slate-500">
                                            – {session.note}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-blue-400 font-medium">
                                        {formatDuration(session.duration)}
                                      </span>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Completed milestone sessions summary */}
                        {milestone.completed && sessions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() =>
                                toggleSessionExpanded(milestone.id)
                              }
                            >
                              <History className="h-3 w-3" />
                              {sessions.length} session
                              {sessions.length !== 1 ? "s" : ""} logged
                              {sessionsExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>

                            <AnimatePresence>
                              {sessionsExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2 space-y-2"
                                >
                                  {sessions.map((session) => (
                                    <div
                                      key={session.id}
                                      className="flex items-center justify-between p-2 bg-slate-800/50 rounded text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3 text-slate-500" />
                                        <span className="text-slate-300">
                                          {format(
                                            parseISO(session.startTime),
                                            "MMM d, h:mm a",
                                          )}
                                        </span>
                                        {session.note && (
                                          <span className="text-slate-500">
                                            – {session.note}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-green-400 font-medium">
                                        {formatDuration(session.duration)}
                                      </span>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* No milestones - show generate button */
          <div className="py-8 text-center">
            <Circle className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              No milestones yet
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              Generate a personalized plan with AI-powered milestones tailored
              to IB assessment criteria.
            </p>
            <Button
              onClick={onGeneratePlan}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Plan
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
