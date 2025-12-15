import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import type { AppState, MilestonePhase, SubjectColor } from "../../types";
import {
  getMultiplierExplanation,
  MIN_SAMPLES_FOR_CONFIDENCE,
} from "../../services/learning";
import { Brain, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "../../lib/utils";

interface LearningInsightsWidgetProps {
  state: AppState;
}

const PHASE_LABELS: Record<MilestonePhase, string> = {
  research: "Research",
  outline: "Outline",
  draft: "First Draft",
  revision: "Revision",
  polish: "Final Polish",
};

// Map subject colors to dot classes
const SUBJECT_DOT_COLORS: Record<string, string> = {
  math: "bg-math",
  physics: "bg-physics",
  economics: "bg-economics",
  english: "bg-english",
  history: "bg-history",
};

export function LearningInsightsWidget({ state }: LearningInsightsWidgetProps) {
  const { multipliers } = useMemo(() => {
    return {
      multipliers: state.learnedMultipliers,
    };
  }, [state.learnedMultipliers]);

  const hasEnoughData =
    multipliers.overall.sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE;
  const confidenceProgress =
    (multipliers.overall.sampleCount / MIN_SAMPLES_FOR_CONFIDENCE) * 100;

  const getMultiplierIcon = (multiplier: number) => {
    if (multiplier < 0.9)
      return <TrendingDown className="h-3 w-3 text-success" />;
    if (multiplier > 1.1)
      return <TrendingUp className="h-3 w-3 text-warning" />;
    return <Minus className="h-3 w-3 text-text-tertiary" />;
  };

  const formatMultiplier = (multiplier: number) => {
    if (multiplier < 1) {
      return `-${Math.round((1 - multiplier) * 100)}%`;
    } else if (multiplier > 1) {
      return `+${Math.round((multiplier - 1) * 100)}%`;
    }
    return "On pace";
  };

  // Get significant multipliers to show
  const significantPhases = Object.entries(multipliers.phases)
    .filter(
      (entry) =>
        entry[1].sampleCount >= 1 && Math.abs(entry[1].multiplier - 1) > 0.1,
    )
    .sort((a, b) => b[1].sampleCount - a[1].sampleCount)
    .slice(0, 3);

  const significantSubjects = Object.entries(multipliers.subjects)
    .filter(
      (entry) =>
        entry[1].sampleCount >= 1 && Math.abs(entry[1].multiplier - 1) > 0.1,
    )
    .sort((a, b) => b[1].sampleCount - a[1].sampleCount)
    .slice(0, 3);

  return (
    <Card className="bg-surface border-border-subtle">
      <CardHeader className="pb-2">
        <CardTitle className="text-h3 font-semibold flex items-center gap-2 text-text-primary">
          <Brain className="h-5 w-5 text-primary" />
          Learning Your Pace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-text-secondary">Data confidence</span>
            <Badge
              variant={
                hasEnoughData
                  ? multipliers.overall.sampleCount >=
                    MIN_SAMPLES_FOR_CONFIDENCE * 2
                    ? "success"
                    : "warning"
                  : "secondary"
              }
              size="sm"
            >
              {multipliers.overall.sampleCount} / {MIN_SAMPLES_FOR_CONFIDENCE}{" "}
              milestones
            </Badge>
          </div>
          <Progress
            value={Math.min(confidenceProgress, 100)}
            size="sm"
            indicatorClassName={
              hasEnoughData ? "bg-primary" : "bg-text-tertiary"
            }
          />
          <p className="text-caption text-text-tertiary">
            {hasEnoughData
              ? "Estimates are now personalized based on your actual work patterns"
              : `Complete ${MIN_SAMPLES_FOR_CONFIDENCE - multipliers.overall.sampleCount} more milestone${MIN_SAMPLES_FOR_CONFIDENCE - multipliers.overall.sampleCount !== 1 ? "s" : ""} with time tracking to unlock personalized estimates`}
          </p>
        </div>

        {/* Overall multiplier */}
        {multipliers.overall.sampleCount > 0 && (
          <div className="p-3 bg-surface-hover rounded-md border border-border-subtle">
            <div className="flex items-center justify-between mb-1">
              <span className="text-body-sm text-text-primary">
                Overall Pace
              </span>
              <div className="flex items-center gap-2">
                {getMultiplierIcon(multipliers.overall.multiplier)}
                <span
                  className={cn(
                    "font-medium font-mono",
                    multipliers.overall.multiplier < 0.9
                      ? "text-success"
                      : multipliers.overall.multiplier > 1.1
                        ? "text-warning"
                        : "text-text-primary",
                  )}
                >
                  {formatMultiplier(multipliers.overall.multiplier)}
                </span>
              </div>
            </div>
            <p className="text-caption text-text-tertiary">
              {getMultiplierExplanation(multipliers.overall.multiplier)}
            </p>
          </div>
        )}

        {/* Phase multipliers */}
        {significantPhases.length > 0 && (
          <div className="space-y-2">
            <span className="text-caption text-text-secondary uppercase tracking-wide">
              By Phase
            </span>
            <div className="space-y-1">
              {significantPhases.map(([phase, data]) => (
                <motion.div
                  key={phase}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between text-body-sm py-1"
                >
                  <span className="text-text-secondary">
                    {PHASE_LABELS[phase as MilestonePhase]}
                  </span>
                  <div className="flex items-center gap-2">
                    {getMultiplierIcon(data.multiplier)}
                    <span
                      className={cn(
                        "text-caption font-medium font-mono",
                        data.multiplier < 0.9
                          ? "text-success"
                          : data.multiplier > 1.1
                            ? "text-warning"
                            : "text-text-secondary",
                      )}
                    >
                      {formatMultiplier(data.multiplier)}
                    </span>
                    <span className="text-caption text-text-tertiary">
                      ({data.sampleCount})
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Subject multipliers */}
        {significantSubjects.length > 0 && (
          <div className="space-y-2">
            <span className="text-caption text-text-secondary uppercase tracking-wide">
              By Subject
            </span>
            <div className="space-y-1">
              {significantSubjects.map(([subject, data]) => {
                const dotColor =
                  SUBJECT_DOT_COLORS[subject as SubjectColor] || "bg-primary";
                return (
                  <motion.div
                    key={subject}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between text-body-sm py-1"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", dotColor)} />
                      <span className="text-text-secondary capitalize">
                        {subject}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getMultiplierIcon(data.multiplier)}
                      <span
                        className={cn(
                          "text-caption font-medium font-mono",
                          data.multiplier < 0.9
                            ? "text-success"
                            : data.multiplier > 1.1
                              ? "text-warning"
                              : "text-text-secondary",
                        )}
                      >
                        {formatMultiplier(data.multiplier)}
                      </span>
                      <span className="text-caption text-text-tertiary">
                        ({data.sampleCount})
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* No data state */}
        {multipliers.overall.sampleCount === 0 && (
          <div className="flex items-start gap-3 p-3 bg-surface-hover rounded-md border border-border-subtle">
            <Info className="h-4 w-4 text-text-tertiary shrink-0 mt-0.5" />
            <p className="text-caption text-text-tertiary">
              Start tracking your work time using the timer in milestone
              details. After completing a few milestones with time data, the app
              will learn your pace and adjust estimates automatically.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
