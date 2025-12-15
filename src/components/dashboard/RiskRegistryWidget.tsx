import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import type { AppState, Risk, RiskStatus, IA, Blocker } from "../../types";
import { RISK_SUGGESTIONS, calculateRiskScore } from "../../types";
import {
  getHighPriorityRisks,
  createRisk,
  materializeRisk,
  getCategoryLabel,
} from "../../services/blocker";
import { cn } from "../../lib/utils";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Lightbulb,
  Target,
  Zap,
} from "lucide-react";

interface RiskRegistryWidgetProps {
  state: AppState;
  onAddRisk: (risk: Risk) => void;
  onUpdateRisk: (riskId: string, updates: Partial<Risk>) => void;
  onDismissRisk: (riskId: string) => void;
  onMaterializeRisk: (risk: Risk, blocker: Blocker) => void;
}

export function RiskRegistryWidget({
  state,
  onAddRisk,
  onUpdateRisk,
  onMaterializeRisk,
}: Omit<RiskRegistryWidgetProps, "onDismissRisk">) {
  const [expanded, setExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const activeRisks = state.risks.filter(
    (r) => !r.isDismissed && r.status !== "avoided",
  );
  const highPriorityRisks = getHighPriorityRisks(state.risks);

  const suggestedRisks = useMemo(() => {
    const allSuggestions: Array<{
      suggestion: (typeof RISK_SUGGESTIONS)[0];
      ia: IA;
    }> = [];

    state.ias.forEach((ia) => {
      const suggestions = RISK_SUGGESTIONS.filter(
        (s) => s.forSubject === ia.subjectColor,
      );
      suggestions.forEach((suggestion) => {
        const alreadyAdded = state.risks.some(
          (r) =>
            r.title === suggestion.title && r.iaId === ia.id && !r.isDismissed,
        );
        if (!alreadyAdded) {
          allSuggestions.push({ suggestion, ia });
        }
      });
    });

    return allSuggestions;
  }, [state.ias, state.risks]);

  const getStatusColor = (status: RiskStatus) => {
    switch (status) {
      case "identified":
        return "text-info";
      case "mitigating":
        return "text-warning";
      case "materialized":
        return "text-critical";
      case "avoided":
        return "text-success";
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 12) return "text-critical bg-critical/20";
    if (score >= 8) return "text-warning bg-warning/20";
    if (score >= 4) return "text-warning bg-warning/20";
    return "text-success bg-success/20";
  };

  const handleAddSuggestedRisk = (
    suggestion: (typeof RISK_SUGGESTIONS)[0],
    ia: IA,
  ) => {
    const risk = createRisk(
      suggestion.title,
      suggestion.description,
      suggestion.category,
      suggestion.defaultProbability,
      suggestion.defaultImpact,
      ia.id,
      undefined,
      suggestion.mitigationSuggestion,
      suggestion.contingencySuggestion,
      true,
    );
    onAddRisk(risk);
  };

  const handleMaterialize = (risk: Risk) => {
    const ia = state.ias.find((i) => i.id === risk.iaId);
    if (!ia) return;

    const milestone = ia.milestones.find((m) => !m.completed);
    if (!milestone) return;

    const estimatedDelayDays =
      risk.riskScore >= 9 ? 7 : risk.riskScore >= 6 ? 5 : 3;

    const { risk: updatedRisk, blocker } = materializeRisk(
      risk,
      milestone.id,
      ia.id,
      estimatedDelayDays,
    );
    onMaterializeRisk(updatedRisk, blocker);
  };

  const overallRiskScore = useMemo(() => {
    if (activeRisks.length === 0) return 0;
    const totalScore = activeRisks.reduce((sum, r) => sum + r.riskScore, 0);
    return Math.round(totalScore / activeRisks.length);
  }, [activeRisks]);

  const displayRisks = expanded ? activeRisks : activeRisks.slice(0, 3);

  return (
    <Card className="bg-surface border-border-subtle">
      <CardHeader className="pb-2">
        <CardTitle className="text-h3 font-semibold flex items-center justify-between text-text-primary">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-info" />
            Risk Registry
            {activeRisks.length > 0 && (
              <span className="text-body-sm font-normal text-text-tertiary">
                ({activeRisks.length})
              </span>
            )}
          </div>
          {activeRisks.length > 0 && (
            <span
              className={cn(
                "text-caption px-2 py-1 rounded-md font-medium",
                getRiskScoreColor(overallRiskScore),
              )}
            >
              <Target className="h-3 w-3 inline mr-1" />
              Risk Score: {overallRiskScore}/16
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Priority Alert */}
        {highPriorityRisks.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-critical/10 border border-critical/30">
            <ShieldAlert className="h-5 w-5 text-critical shrink-0" />
            <div className="flex-1">
              <p className="text-body-sm font-medium text-critical">
                {highPriorityRisks.length} High Priority Risk
                {highPriorityRisks.length !== 1 ? "s" : ""}
              </p>
              <p className="text-caption text-critical/70">
                Consider implementing mitigation strategies
              </p>
            </div>
          </div>
        )}

        {/* Active Risks List */}
        {activeRisks.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence>
              {displayRisks.map((risk, index) => {
                const ia = state.ias.find((i) => i.id === risk.iaId);
                return (
                  <motion.div
                    key={risk.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "p-3 rounded-md border transition-all duration-fast",
                      risk.riskScore >= 12
                        ? "bg-critical/5 border-critical/30"
                        : risk.riskScore >= 8
                          ? "bg-warning/5 border-warning/30"
                          : "bg-surface-hover border-border-subtle",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "px-2 py-1 rounded text-caption font-medium font-mono",
                          getRiskScoreColor(risk.riskScore),
                        )}
                      >
                        {risk.riskScore}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-body-sm text-text-primary truncate">
                            {risk.title}
                          </span>
                          <span
                            className={cn(
                              "text-caption px-1.5 py-0.5 rounded",
                              getStatusColor(risk.status),
                            )}
                          >
                            {risk.status}
                          </span>
                        </div>

                        {ia && (
                          <p className="text-caption text-text-tertiary mt-1">
                            {ia.name}
                          </p>
                        )}

                        {/* Mitigation Progress */}
                        {risk.status === "mitigating" &&
                          risk.mitigationProgress !== undefined && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-caption mb-1">
                                <span className="text-text-secondary">
                                  Mitigation Progress
                                </span>
                                <span className="text-warning font-mono">
                                  {risk.mitigationProgress}%
                                </span>
                              </div>
                              <Progress
                                value={risk.mitigationProgress}
                                size="sm"
                                variant="warning"
                              />
                            </div>
                          )}

                        {/* Mitigation Strategy */}
                        {risk.mitigationStrategy && (
                          <p className="text-caption text-text-tertiary mt-2 flex items-start gap-1">
                            <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-warning" />
                            {risk.mitigationStrategy}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {risk.status === "identified" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-caption text-warning hover:text-warning hover:bg-warning/10"
                            onClick={() =>
                              onUpdateRisk(risk.id, {
                                status: "mitigating",
                                mitigationProgress: 0,
                              })
                            }
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            Mitigate
                          </Button>
                        )}
                        {risk.status !== "materialized" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-caption text-critical hover:text-critical hover:bg-critical/10"
                            onClick={() => handleMaterialize(risk)}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Materialized
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Show More/Less */}
            {activeRisks.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-caption text-text-tertiary"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show {activeRisks.length - 3} More
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Suggested Risks */}
        {suggestedRisks.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border-subtle">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="w-full flex items-center justify-between text-body-sm"
            >
              <div className="flex items-center gap-2 text-info">
                <Zap className="h-4 w-4" />
                <span>Suggested Risks ({suggestedRisks.length})</span>
              </div>
              {showSuggestions ? (
                <ChevronUp className="h-4 w-4 text-text-tertiary" />
              ) : (
                <ChevronDown className="h-4 w-4 text-text-tertiary" />
              )}
            </button>

            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {suggestedRisks.slice(0, 5).map(({ suggestion, ia }) => (
                    <div
                      key={`${suggestion.id}-${ia.id}`}
                      className="p-3 rounded-md bg-info/5 border border-info/20"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "px-2 py-1 rounded text-caption font-medium font-mono",
                            getRiskScoreColor(
                              calculateRiskScore(
                                suggestion.defaultProbability,
                                suggestion.defaultImpact,
                              ),
                            ),
                          )}
                        >
                          {calculateRiskScore(
                            suggestion.defaultProbability,
                            suggestion.defaultImpact,
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-body-sm text-info">
                            {suggestion.title}
                          </p>
                          <p className="text-caption text-info/70 mt-0.5">
                            {ia.name} • {getCategoryLabel(suggestion.category)}
                          </p>
                          <p className="text-caption text-text-tertiary mt-1">
                            {suggestion.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-success hover:text-success hover:bg-success/10"
                            onClick={() =>
                              handleAddSuggestedRisk(suggestion, ia)
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-text-tertiary hover:text-text-secondary"
                            onClick={() => {
                              const risk = createRisk(
                                suggestion.title,
                                suggestion.description,
                                suggestion.category,
                                suggestion.defaultProbability,
                                suggestion.defaultImpact,
                                ia.id,
                                undefined,
                                undefined,
                                undefined,
                                true,
                              );
                              onAddRisk({ ...risk, isDismissed: true });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {suggestedRisks.length > 5 && (
                    <p className="text-caption text-center text-text-tertiary">
                      +{suggestedRisks.length - 5} more suggestions available
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Empty State */}
        {activeRisks.length === 0 && suggestedRisks.length === 0 && (
          <div className="flex items-center gap-3 p-4 rounded-md bg-success/10 border border-success/20">
            <ShieldCheck className="h-5 w-5 text-success" />
            <div>
              <p className="text-body-sm text-success">No risks identified</p>
              <p className="text-caption text-success/70">
                Proactively identify potential risks to stay ahead
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
