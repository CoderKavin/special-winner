import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import type { AppState, CognitiveLoad } from "../../types";
import { DEFAULT_ENERGY_SETTINGS } from "../../types";
import {
  analyzeWeeklyEnergy,
  getCognitiveLoad,
  getCognitiveLoadLabel,
  getOptimizationSummary,
  generateOptimizationSuggestions,
} from "../../services/energy";
import { detectMilestonePhase } from "../../services/learning";
import {
  Zap,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { parseISO, isBefore, addDays } from "date-fns";

interface EnergyAnalysisWidgetProps {
  state: AppState;
}

export function EnergyAnalysisWidget({ state }: EnergyAnalysisWidgetProps) {
  const energySettings = state.energySettings || DEFAULT_ENERGY_SETTINGS;

  const analysis = useMemo(() => {
    const today = new Date();
    const nextWeek = addDays(today, 7);

    // Get upcoming milestones (next 7 days)
    const upcomingMilestones = state.ias.flatMap((ia) =>
      ia.milestones
        .filter((m) => {
          if (m.completed) return false;
          const deadline = parseISO(m.deadline);
          return isBefore(deadline, nextWeek);
        })
        .map((m) => {
          const phase = m.phase || detectMilestonePhase(m.milestone_name);
          const cognitiveLoad = getCognitiveLoad(ia.subjectColor, phase);
          return {
            ...m,
            ia,
            phase,
            cognitiveLoad,
          };
        }),
    );

    // Count by cognitive load
    const loadCounts: Record<CognitiveLoad, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    const loadHours: Record<CognitiveLoad, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    upcomingMilestones.forEach((m) => {
      loadCounts[m.cognitiveLoad]++;
      loadHours[m.cognitiveLoad] += m.estimated_hours * m.buffer_multiplier;
    });

    // Calculate weekly energy analysis
    const weeklyAnalysis = analyzeWeeklyEnergy(state);

    // Check if high-load tasks can fit in high-energy windows
    const weekdayHighEnergyHours = energySettings.profile.weekdayPattern.windows
      .filter((w) => w.level === "high")
      .reduce((sum, w) => sum + (w.endHour - w.startHour), 0);

    const availableHighEnergyHoursPerWeek = weekdayHighEnergyHours * 5;
    const highLoadHoursNeeded = loadHours.high;
    const highEnergyUtilization =
      availableHighEnergyHoursPerWeek > 0
        ? (highLoadHoursNeeded / availableHighEnergyHoursPerWeek) * 100
        : 0;

    // Get optimization suggestions
    const optimizationSummary = getOptimizationSummary(state);
    const optimizationSuggestions = generateOptimizationSuggestions(state);

    return {
      upcomingMilestones,
      loadCounts,
      loadHours,
      weeklyAnalysis,
      availableHighEnergyHoursPerWeek,
      highLoadHoursNeeded,
      highEnergyUtilization,
      isOverloaded: highEnergyUtilization > 100,
      isOptimal: highEnergyUtilization > 50 && highEnergyUtilization <= 100,
      optimizationSummary,
      optimizationSuggestions,
    };
  }, [state, energySettings]);

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

  const getCognitiveLoadColor = (load: CognitiveLoad) => {
    switch (load) {
      case "high":
        return "text-success";
      case "medium":
        return "text-warning";
      case "low":
        return "text-critical";
    }
  };

  const getCognitiveLoadBg = (load: CognitiveLoad) => {
    switch (load) {
      case "high":
        return "bg-success/10 border-success/20";
      case "medium":
        return "bg-warning/10 border-warning/20";
      case "low":
        return "bg-critical/10 border-critical/20";
    }
  };

  return (
    <Card className="bg-surface border-border-subtle">
      <CardHeader className="pb-2">
        <CardTitle className="text-h3 font-semibold flex items-center gap-2 text-text-primary">
          <Zap className="h-5 w-5 text-warning" />
          Energy Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Energy Utilization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-text-secondary">Peak Energy Utilization</span>
            <Badge
              variant={
                analysis.isOverloaded
                  ? "error"
                  : analysis.isOptimal
                    ? "success"
                    : "secondary"
              }
              size="sm"
            >
              {Math.round(analysis.highEnergyUtilization)}%
            </Badge>
          </div>
          <Progress
            value={Math.min(analysis.highEnergyUtilization, 100)}
            size="default"
            variant={
              analysis.isOverloaded
                ? "error"
                : analysis.isOptimal
                  ? "success"
                  : "warning"
            }
          />
          <p className="text-caption text-text-tertiary">
            {analysis.isOverloaded
              ? `High-load tasks (${analysis.highLoadHoursNeeded.toFixed(1)}h) exceed your peak energy capacity (${analysis.availableHighEnergyHoursPerWeek}h/week)`
              : analysis.isOptimal
                ? "Your high-load tasks fit well within your peak energy windows"
                : `You have ${(analysis.availableHighEnergyHoursPerWeek - analysis.highLoadHoursNeeded).toFixed(1)}h of unused peak energy capacity`}
          </p>
        </div>

        {/* Upcoming Task Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-secondary uppercase tracking-wide">
              Next 7 Days by Cognitive Load
            </span>
            <span className="text-caption text-text-tertiary">
              {analysis.upcomingMilestones.length} tasks
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["high", "medium", "low"] as CognitiveLoad[]).map((load) => {
              const LoadIcon = getCognitiveLoadIcon(load);
              const count = analysis.loadCounts[load];
              const hours = analysis.loadHours[load];

              return (
                <motion.div
                  key={load}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 rounded-md text-center border",
                    getCognitiveLoadBg(load),
                  )}
                >
                  <LoadIcon
                    className={cn(
                      "h-5 w-5 mx-auto mb-1",
                      getCognitiveLoadColor(load),
                    )}
                  />
                  <div
                    className={cn(
                      "text-h2 font-bold font-mono",
                      getCognitiveLoadColor(load),
                    )}
                  >
                    {count}
                  </div>
                  <div className="text-caption text-text-tertiary">
                    {getCognitiveLoadLabel(load)}
                  </div>
                  <div className="text-caption text-text-secondary mt-1 font-mono">
                    {hours.toFixed(1)}h
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Weekly Summary */}
        {analysis.weeklyAnalysis && (
          <div className="space-y-2 pt-3 border-t border-border-subtle">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-text-tertiary" />
              <span className="text-body-sm text-text-primary">
                Weekly Summary
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 bg-surface-hover rounded-md border border-border-subtle">
                <div className="text-caption text-text-tertiary">
                  Well Matched
                </div>
                <div className="text-body-sm font-medium text-success font-mono">
                  {analysis.weeklyAnalysis.wellMatchedSessions} sessions
                </div>
              </div>
              <div className="p-2 bg-surface-hover rounded-md border border-border-subtle">
                <div className="text-caption text-text-tertiary">
                  Mismatched
                </div>
                <div className="text-body-sm font-medium text-warning font-mono">
                  {analysis.weeklyAnalysis.mismatchedSessions} sessions
                </div>
              </div>
            </div>

            {/* Efficiency indicator */}
            <div className="flex items-center gap-2 p-2 bg-surface-hover rounded-md border border-border-subtle">
              {analysis.weeklyAnalysis.overallEnergyScore >= 90 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-caption text-success">
                    Excellent energy alignment (
                    {Math.round(analysis.weeklyAnalysis.overallEnergyScore)}%
                    score)
                  </span>
                </>
              ) : analysis.weeklyAnalysis.overallEnergyScore >= 70 ? (
                <>
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="text-caption text-warning">
                    Good alignment (
                    {Math.round(analysis.weeklyAnalysis.overallEnergyScore)}%
                    score)
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-caption text-warning">
                    Consider rescheduling (
                    {Math.round(analysis.weeklyAnalysis.overallEnergyScore)}%
                    score)
                  </span>
                </>
              )}
            </div>

            {/* Wasted energy warning */}
            {analysis.weeklyAnalysis.lowLoadInHighEnergy > 0 && (
              <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/20 rounded-md text-caption text-warning">
                <Zap className="h-3 w-3" />
                {analysis.weeklyAnalysis.lowLoadInHighEnergy} low-load tasks
                scheduled during peak energy (consider swapping)
              </div>
            )}
          </div>
        )}

        {/* Auto-Optimization Suggestions */}
        {analysis.optimizationSuggestions.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-body-sm text-text-primary">
                  Optimization Suggestions
                </span>
              </div>
              <span className="text-caption text-primary font-mono">
                +{analysis.optimizationSummary.potentialProductivityGain}%
                potential gain
              </span>
            </div>

            {/* Top 2 suggestions */}
            {analysis.optimizationSuggestions.slice(0, 2).map((suggestion) => (
              <motion.div
                key={suggestion.milestoneId}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2 bg-primary/10 border border-primary/20 rounded-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-caption text-primary truncate">
                      {suggestion.milestoneName}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-caption text-text-tertiary">
                      <span
                        className={cn(
                          suggestion.currentEnergyLevel === "low"
                            ? "text-critical"
                            : "text-warning",
                        )}
                      >
                        {suggestion.currentEnergyLevel}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-success">
                        {suggestion.suggestedEnergyLevel}
                      </span>
                    </div>
                  </div>
                  <span className="text-caption font-medium text-success ml-2 font-mono">
                    +{suggestion.expectedProductivityGain}%
                  </span>
                </div>
              </motion.div>
            ))}

            {analysis.optimizationSuggestions.length > 2 && (
              <p className="text-caption text-text-tertiary text-center">
                +{analysis.optimizationSuggestions.length - 2} more suggestions
              </p>
            )}
          </div>
        )}

        {/* No optimization needed */}
        {analysis.optimizationSuggestions.length === 0 &&
          analysis.upcomingMilestones.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-md">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-caption text-success">
                All tasks are optimally scheduled for your energy levels
              </span>
            </div>
          )}

        {/* No upcoming tasks */}
        {analysis.upcomingMilestones.length === 0 && (
          <div className="text-center py-4 text-text-tertiary text-body-sm">
            No upcoming milestones in the next 7 days
          </div>
        )}
      </CardContent>
    </Card>
  );
}
