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
import type { IA, Milestone } from "../../types";
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
} from "lucide-react";
import { parseISO, isBefore } from "date-fns";
import confetti from "canvas-confetti";

interface IADetailModalProps {
  ia: IA;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleMilestone: (milestoneId: string) => void;
  onUpdateDeadline: (milestoneId: string, newDeadline: string) => void;
  onGeneratePlan: () => void;
  isGenerating?: boolean;
}

export function IADetailModal({
  ia,
  open,
  onOpenChange,
  onToggleMilestone,
  onUpdateDeadline,
  onGeneratePlan,
  isGenerating = false,
}: IADetailModalProps) {
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  const colors = SUBJECT_COLORS[ia.subjectColor];
  const progress = getProgressPercentage(ia.milestones);
  const totalHours = ia.milestones.reduce(
    (sum, m) => sum + m.estimated_hours * m.buffer_multiplier,
    0,
  );

  const handleCheckMilestone = (milestone: Milestone) => {
    if (!milestone.completed) {
      // Trigger confetti when completing a milestone
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
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalHours.toFixed(1)} hours total
            </span>
          </div>
        </div>

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

                          {/* Estimated hours */}
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3" />
                            {(
                              milestone.estimated_hours *
                              milestone.buffer_multiplier
                            ).toFixed(1)}{" "}
                            hrs
                          </span>

                          {/* Completed date */}
                          {milestone.completed && milestone.completedAt && (
                            <span className="text-green-400/70">
                              Completed {formatShortDate(milestone.completedAt)}
                            </span>
                          )}
                        </div>
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
