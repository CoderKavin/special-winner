import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import type { IA } from "../../types";
import { SUBJECT_COLORS } from "../../types";
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

export function IACard({
  ia,
  onClick,
  onGeneratePlan,
  isGenerating = false,
}: IACardProps) {
  const colors = SUBJECT_COLORS[ia.subjectColor];
  const progress = getProgressPercentage(ia.milestones);
  const nextMilestone = getNextMilestone(ia.milestones);
  const hasMilestones = ia.milestones.length > 0;

  const isOverdue =
    nextMilestone && isBefore(parseISO(nextMilestone.deadline), new Date());

  const getStatusBadge = () => {
    switch (ia.status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "in_progress":
        return <Badge variant="warning">In Progress</Badge>;
      case "overdue":
        return <Badge variant="error">Overdue</Badge>;
      default:
        return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden cursor-pointer transition-all",
          "bg-slate-900/50 border-slate-800 hover:border-slate-700",
          isOverdue && "border-red-500/50"
        )}
        onClick={onClick}
      >
        {/* Subject color indicator */}
        <div
          className={cn("absolute top-0 left-0 w-1 h-full", colors.border)}
          style={{ backgroundColor: colors.border.replace("border-", "") }}
        />

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <FileText className={cn("h-4 w-4", colors.text)} />
                {ia.name}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">{ia.type}</p>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Word count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Word Count</span>
            <span className="font-medium text-slate-200">
              {ia.wordCount.toLocaleString()} words
            </span>
          </div>

          {/* Progress section */}
          {hasMilestones ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Progress</span>
                  <span className={cn("font-medium", colors.text)}>
                    {progress}%
                  </span>
                </div>
                <Progress
                  value={progress}
                  className="h-2 bg-slate-800"
                  indicatorClassName={colors.border.replace("border", "bg")}
                />
              </div>

              {/* Next milestone */}
              {nextMilestone && (
                <div
                  className={cn(
                    "p-3 rounded-lg",
                    isOverdue
                      ? "bg-red-500/10 border border-red-500/20"
                      : "bg-slate-800/50"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    {isOverdue ? (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-slate-400" />
                    )}
                    <span
                      className={cn(
                        "font-medium",
                        isOverdue ? "text-red-400" : "text-slate-300"
                      )}
                    >
                      {nextMilestone.milestone_name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Due {formatShortDate(nextMilestone.deadline)}
                    </span>
                    <span
                      className={cn(
                        isOverdue ? "text-red-400" : "text-slate-400"
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
              className="w-full gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                onGeneratePlan();
              }}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Plan
                </>
              )}
            </Button>
          )}

          {/* View details hint */}
          {hasMilestones && (
            <div className="flex items-center justify-end text-xs text-slate-500">
              <span>View details</span>
              <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
