import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { StatusDot } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import type { IA } from "../../types";
import {
  getProgressPercentage,
  getNextMilestone,
  daysUntilText,
  formatShortDate,
  cn,
} from "../../lib/utils";
import {
  FileText,
  Sparkles,
  ChevronRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { parseISO, isBefore } from "date-fns";

interface IACardProps {
  ia: IA;
  onClick: () => void;
  onGeneratePlan: () => void;
  isGenerating?: boolean;
}

// Map subject colors to Tailwind classes
const SUBJECT_COLOR_MAP: Record<
  string,
  { border: string; bg: string; text: string; progress: string }
> = {
  math: {
    border: "border-l-math",
    bg: "bg-math",
    text: "text-math",
    progress: "bg-math",
  },
  physics: {
    border: "border-l-physics",
    bg: "bg-physics",
    text: "text-physics",
    progress: "bg-physics",
  },
  economics: {
    border: "border-l-economics",
    bg: "bg-economics",
    text: "text-economics",
    progress: "bg-economics",
  },
  english: {
    border: "border-l-english",
    bg: "bg-english",
    text: "text-english",
    progress: "bg-english",
  },
  history: {
    border: "border-l-history",
    bg: "bg-history",
    text: "text-history",
    progress: "bg-history",
  },
};

export function IACard({
  ia,
  onClick,
  onGeneratePlan,
  isGenerating = false,
}: IACardProps) {
  const subjectStyles =
    SUBJECT_COLOR_MAP[ia.subjectColor] || SUBJECT_COLOR_MAP.math;
  const progress = getProgressPercentage(ia.milestones);
  const nextMilestone = getNextMilestone(ia.milestones);
  const hasMilestones = ia.milestones.length > 0;

  const isOverdue =
    nextMilestone && isBefore(parseISO(nextMilestone.deadline), new Date());

  const getStatusDot = () => {
    switch (ia.status) {
      case "completed":
        return "success";
      case "in_progress":
        return "warning";
      case "overdue":
        return "error";
      default:
        return "neutral";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden cursor-pointer",
          "bg-white dark:bg-surface",
          "border-slate-200 dark:border-border-subtle",
          "hover:border-slate-300 dark:hover:border-border-emphasis hover:shadow-lg dark:hover:shadow-card-hover",
          "transition-all duration-200",
          // Subject color left border
          "border-l-4",
          subjectStyles.border,
          isOverdue && "border-l-critical",
        )}
        onClick={onClick}
      >
        {/* Status indicator dot */}
        <div className="absolute top-5 right-5">
          <StatusDot
            status={
              getStatusDot() as "success" | "warning" | "error" | "neutral"
            }
            size="lg"
          />
        </div>

        <CardHeader className="pb-3 pr-12">
          <div className="flex items-start gap-3">
            <FileText
              className={cn("h-5 w-5 mt-0.5 shrink-0", subjectStyles.text)}
            />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-text-primary truncate">
                {ia.name}
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-text-tertiary mt-1">
                {ia.type}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Word count */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-text-secondary">
              Word Count
            </span>
            <span className="text-base font-semibold text-slate-900 dark:text-text-primary font-mono">
              {ia.wordCount.toLocaleString()}
            </span>
          </div>

          {/* Progress section */}
          {hasMilestones ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-text-secondary">
                    Progress
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold font-mono",
                      subjectStyles.text,
                    )}
                  >
                    {progress}%
                  </span>
                </div>
                <Progress
                  value={progress}
                  size="default"
                  className="bg-slate-100 dark:bg-white/5"
                  indicatorClassName={cn(subjectStyles.progress, "opacity-90")}
                />
              </div>

              {/* Next milestone */}
              {nextMilestone && (
                <div
                  className={cn(
                    "p-4 rounded-lg",
                    isOverdue
                      ? "bg-red-50 dark:bg-critical/10 border border-red-200 dark:border-critical/20"
                      : "bg-slate-50 dark:bg-surface-hover border border-slate-200 dark:border-border-subtle",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isOverdue ? (
                      <AlertCircle className="h-4 w-4 text-critical shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-slate-400 dark:text-text-tertiary shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-semibold truncate",
                        isOverdue
                          ? "text-critical"
                          : "text-slate-900 dark:text-text-primary",
                      )}
                    >
                      {nextMilestone.milestone_name}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-text-tertiary">
                      Due {formatShortDate(nextMilestone.deadline)}
                    </span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        isOverdue
                          ? "text-critical"
                          : "text-slate-700 dark:text-text-secondary",
                      )}
                    >
                      {daysUntilText(nextMilestone.deadline)}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Generate plan button */
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={(e) => {
                e.stopPropagation();
                onGeneratePlan();
              }}
              disabled={isGenerating}
              isLoading={isGenerating}
            >
              {!isGenerating && <Sparkles className="h-4 w-4" />}
              {isGenerating ? "Generating..." : "Generate Plan"}
            </Button>
          )}

          {/* View details hint */}
          {hasMilestones && (
            <div className="flex items-center justify-end text-sm text-slate-500 dark:text-text-tertiary hover:text-slate-700 dark:hover:text-text-secondary transition-colors">
              <span>View details</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
