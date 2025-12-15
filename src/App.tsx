import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { ProgressSummary } from "./components/dashboard/ProgressSummary";
import { IACard } from "./components/dashboard/IACard";
import { WarningsPanel } from "./components/dashboard/WarningsPanel";
import { ActiveTimerBanner } from "./components/dashboard/ActiveTimerBanner";
import { WeeklyHoursWidget } from "./components/dashboard/WeeklyHoursWidget";
import { LearningInsightsWidget } from "./components/dashboard/LearningInsightsWidget";
import { EnergyAnalysisWidget } from "./components/dashboard/EnergyAnalysisWidget";
import { ActiveBlockersWidget } from "./components/dashboard/ActiveBlockersWidget";
import { RiskRegistryWidget } from "./components/dashboard/RiskRegistryWidget";
import { TimelineView } from "./components/timeline/TimelineView";
import { IADetailModal } from "./components/modals/IADetailModal";
import { BlockerLogModal } from "./components/modals/BlockerLogModal";
import { BlockerResolveModal } from "./components/modals/BlockerResolveModal";
import { Settings } from "./components/Settings";
import { AssistantProvider } from "./contexts/AssistantContext";
import {
  AssistantPanel,
  AssistantTrigger,
  AssistantHeaderButton,
} from "./components/assistant/AssistantPanel";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { generateMilestones, generateAllMilestones } from "./services/ai";
import {
  rescheduleAfterCompletion,
  rescheduleAfterDeadlineChange,
} from "./services/reschedule";
import { calculateLearnedMultipliers } from "./services/learning";
import type { IA, Blocker, Risk } from "./types";
import { INITIAL_LEARNED_MULTIPLIERS } from "./types";
import {
  LayoutDashboard,
  Calendar,
  Settings as SettingsIcon,
  Sparkles,
  Zap,
} from "lucide-react";

function App() {
  const {
    state,
    setState,
    updateIA,
    setMilestones,
    toggleMilestone,
    setMasterDeadline,
    setWeeklyHoursBudget,
    setLastCalendarSync,
    resetState,
    // Time tracking functions
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    cancelTimer,
    logManualHours,
    updateLearnedMultipliers,
    updateDeepWorkSettings,
    updateEnergySettings,
    // Blocker management
    addBlocker,
    replaceBlocker,
    setBlockers,
    // Risk management
    addRisk,
    updateRisk,
  } = useLocalStorage();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedIA, setSelectedIA] = useState<IA | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingIAs, setGeneratingIAs] = useState<Set<string>>(new Set());
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Blocker modal state
  const [isBlockerLogModalOpen, setIsBlockerLogModalOpen] = useState(false);
  const [isBlockerResolveModalOpen, setIsBlockerResolveModalOpen] =
    useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState<Blocker | null>(null);

  // Recalculate learned multipliers when milestones change
  useEffect(() => {
    const hasCompletedMilestonesWithData = state.ias.some((ia) =>
      ia.milestones.some(
        (m) => m.completed && m.actualHours && m.actualHours > 0,
      ),
    );

    if (hasCompletedMilestonesWithData) {
      const newMultipliers = calculateLearnedMultipliers(state.ias);
      // Only update if there's a meaningful change
      if (
        newMultipliers.overall.sampleCount !==
        state.learnedMultipliers.overall.sampleCount
      ) {
        updateLearnedMultipliers(newMultipliers);
      }
    }
  }, [
    state.ias,
    state.learnedMultipliers.overall.sampleCount,
    updateLearnedMultipliers,
  ]);

  // Handle single IA plan generation
  const handleGeneratePlan = useCallback(
    async (iaId: string) => {
      const ia = state.ias.find((i) => i.id === iaId);
      if (!ia) return;

      setGeneratingIAs((prev) => new Set(prev).add(iaId));

      try {
        const milestones = await generateMilestones(ia, state.masterDeadline);
        setMilestones(iaId, milestones);
      } catch (error) {
        console.error("Failed to generate milestones:", error);
      } finally {
        setGeneratingIAs((prev) => {
          const next = new Set(prev);
          next.delete(iaId);
          return next;
        });
      }
    },
    [state.ias, state.masterDeadline, setMilestones],
  );

  // Handle generating all plans
  const handleGenerateAllPlans = useCallback(async () => {
    setIsGeneratingAll(true);

    try {
      const results = await generateAllMilestones(
        state.ias,
        state.masterDeadline,
      );

      results.forEach((milestones, iaId) => {
        setMilestones(iaId, milestones);
      });
    } catch (error) {
      console.error("Failed to generate all milestones:", error);
    } finally {
      setIsGeneratingAll(false);
    }
  }, [state.ias, state.masterDeadline, setMilestones]);

  // Handle milestone toggle with rescheduling
  const handleToggleMilestone = useCallback(
    (iaId: string, milestoneId: string) => {
      const ia = state.ias.find((i) => i.id === iaId);
      if (!ia) return;

      const milestone = ia.milestones.find((m) => m.id === milestoneId);
      if (!milestone) return;

      // If completing (not uncompleting), apply reschedule logic
      if (!milestone.completed) {
        const result = rescheduleAfterCompletion(
          ia,
          milestoneId,
          state.masterDeadline,
        );

        // Update the IA with rescheduled milestones
        updateIA(iaId, {
          milestones: result.updatedMilestones.map((m) =>
            m.id === milestoneId
              ? { ...m, completed: true, completedAt: new Date().toISOString() }
              : m,
          ),
        });

        // Update status
        const allComplete = result.updatedMilestones.every(
          (m) => m.completed || m.id === milestoneId,
        );
        if (allComplete) {
          updateIA(iaId, { status: "completed" });
        }
      } else {
        // Just toggle without rescheduling
        toggleMilestone(iaId, milestoneId);
      }
    },
    [state.ias, state.masterDeadline, updateIA, toggleMilestone],
  );

  // Handle deadline change with rescheduling
  const handleUpdateDeadline = useCallback(
    (iaId: string, milestoneId: string, newDeadline: string) => {
      const ia = state.ias.find((i) => i.id === iaId);
      if (!ia) return;

      const result = rescheduleAfterDeadlineChange(
        ia,
        milestoneId,
        newDeadline,
        state.masterDeadline,
      );

      updateIA(iaId, { milestones: result.updatedMilestones });
    },
    [state.ias, state.masterDeadline, updateIA],
  );

  // Handle card click
  const handleCardClick = useCallback((ia: IA) => {
    setSelectedIA(ia);
    setIsModalOpen(true);
  }, []);

  // Handle timeline milestone click
  const handleTimelineMilestoneClick = useCallback(
    (iaId: string) => {
      const ia = state.ias.find((i) => i.id === iaId);
      if (ia) {
        setSelectedIA(ia);
        setIsModalOpen(true);
      }
    },
    [state.ias],
  );

  // Handle calendar sync
  const handleCalendarSync = useCallback(
    (eventIds: Record<string, string>) => {
      setState((prev) => ({
        ...prev,
        googleCalendarEventIds: eventIds,
      }));
    },
    [setState],
  );

  // Timer handlers
  const handleStartTimer = useCallback(
    (iaId: string, milestoneId: string) => {
      startTimer(iaId, milestoneId);
    },
    [startTimer],
  );

  const handlePauseTimer = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  const handleResumeTimer = useCallback(() => {
    resumeTimer();
  }, [resumeTimer]);

  const handleStopTimer = useCallback(
    (note?: string) => {
      stopTimer(note);
    },
    [stopTimer],
  );

  const handleCancelTimer = useCallback(() => {
    cancelTimer();
  }, [cancelTimer]);

  const handleLogManualHours = useCallback(
    (iaId: string, milestoneId: string, hours: number, note?: string) => {
      logManualHours(iaId, milestoneId, hours, note);
    },
    [logManualHours],
  );

  // Blocker handlers
  const handleLogBlocker = useCallback(() => {
    setIsBlockerLogModalOpen(true);
  }, []);

  const handleViewBlocker = useCallback((blocker: Blocker) => {
    setSelectedBlocker(blocker);
    // For now, viewing a blocker opens the resolve modal
    // In a full implementation, you might have a separate detail modal
    setIsBlockerResolveModalOpen(true);
  }, []);

  const handleResolveBlocker = useCallback((blocker: Blocker) => {
    setSelectedBlocker(blocker);
    setIsBlockerResolveModalOpen(true);
  }, []);

  const handleSaveBlocker = useCallback(
    (blocker: Blocker) => {
      addBlocker(blocker);
    },
    [addBlocker],
  );

  const handleBlockerResolved = useCallback(
    (resolvedBlocker: Blocker) => {
      replaceBlocker(resolvedBlocker);
      setSelectedBlocker(null);
    },
    [replaceBlocker],
  );

  const handleBlockersUpdated = useCallback(
    (blockers: Blocker[]) => {
      setBlockers(blockers);
    },
    [setBlockers],
  );

  // Risk handlers
  const handleAddRisk = useCallback(
    (risk: Risk) => {
      addRisk(risk);
    },
    [addRisk],
  );

  const handleUpdateRisk = useCallback(
    (riskId: string, updates: Partial<Risk>) => {
      updateRisk(riskId, updates);
    },
    [updateRisk],
  );

  const handleMaterializeRisk = useCallback(
    (risk: Risk, blocker: Blocker) => {
      updateRisk(risk.id, { status: "materialized", blockerId: blocker.id });
      addBlocker(blocker);
    },
    [updateRisk, addBlocker],
  );

  // Keep selectedIA in sync with state
  useEffect(() => {
    if (selectedIA) {
      const updatedIA = state.ias.find((ia) => ia.id === selectedIA.id);
      if (
        updatedIA &&
        JSON.stringify(updatedIA) !== JSON.stringify(selectedIA)
      ) {
        setSelectedIA(updatedIA);
      }
    }
  }, [state.ias, selectedIA]);

  // Count IAs without milestones
  const iasWithoutPlans = state.ias.filter(
    (ia) => ia.milestones.length === 0,
  ).length;

  return (
    <AssistantProvider
      initialAppState={state}
      initialView={{ view: activeTab as "dashboard" | "timeline" | "settings" }}
    >
      <div className="min-h-screen bg-background text-text-primary">
        {/* Header */}
        <header className="border-b border-border-subtle bg-surface/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-h3 font-semibold text-text-primary">
                  IB Deadline Manager
                </h1>
              </div>

              <div className="flex items-center gap-3">
                {/* AI Assistant Button */}
                <AssistantHeaderButton />

                {/* Generate All Plans Button */}
                {iasWithoutPlans > 0 && (
                  <Button
                    onClick={handleGenerateAllPlans}
                    disabled={isGeneratingAll}
                    isLoading={isGeneratingAll}
                  >
                    {!isGeneratingAll && <Sparkles className="h-4 w-4" />}
                    {isGeneratingAll
                      ? "Generating..."
                      : `Generate All Plans (${iasWithoutPlans})`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <Calendar className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="settings">
                <SettingsIcon className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Active Timer Banner */}
                <AnimatePresence>
                  {state.activeTimer && (
                    <ActiveTimerBanner
                      activeTimer={state.activeTimer}
                      ias={state.ias}
                      onPause={handlePauseTimer}
                      onResume={handleResumeTimer}
                      onStop={handleStopTimer}
                      onCancel={handleCancelTimer}
                    />
                  )}
                </AnimatePresence>

                {/* Progress Summary */}
                <ProgressSummary state={state} />

                {/* Warnings */}
                <WarningsPanel
                  state={state}
                  onViewBlocker={handleViewBlocker}
                />

                {/* Blockers & Risks Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  <ActiveBlockersWidget
                    state={state}
                    onLogBlocker={handleLogBlocker}
                    onViewBlocker={handleViewBlocker}
                    onResolveBlocker={handleResolveBlocker}
                    onBlockersUpdated={handleBlockersUpdated}
                  />
                  <RiskRegistryWidget
                    state={state}
                    onAddRisk={handleAddRisk}
                    onUpdateRisk={handleUpdateRisk}
                    onMaterializeRisk={handleMaterializeRisk}
                  />
                </div>

                {/* Time Tracking Widgets Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <WeeklyHoursWidget state={state} />
                  <LearningInsightsWidget state={state} />
                  <EnergyAnalysisWidget state={state} />
                </div>

                {/* IA Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {state.ias.map((ia) => (
                      <IACard
                        key={ia.id}
                        ia={ia}
                        onClick={() => handleCardClick(ia)}
                        onGeneratePlan={() => handleGeneratePlan(ia.id)}
                        isGenerating={generatingIAs.has(ia.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Extended Essay Card - Special treatment */}
                <div className="mt-8">
                  <h2 className="text-h3 font-semibold text-text-secondary mb-4">
                    Extended Essay
                  </h2>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface border border-border-subtle rounded-lg p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-h2 font-semibold text-text-primary">
                          {state.ee.name}
                        </h3>
                        <p className="text-body-sm text-text-secondary mt-1">
                          {state.ee.wordCount.toLocaleString()} words • Subject:{" "}
                          {state.ee.subject}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-caption text-text-tertiary">
                          Target Deadline
                        </p>
                        <p className="text-body-lg font-medium text-text-primary">
                          {new Date(state.ee.targetDeadline).toLocaleDateString(
                            "en-US",
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <p className="text-body-sm text-text-tertiary">
                        Extended Essay planning will be enabled closer to the
                        deadline. Focus on IAs first!
                      </p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <TimelineView
                  state={state}
                  onMilestoneClick={handleTimelineMilestoneClick}
                />
              </motion.div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Settings
                  state={state}
                  onMasterDeadlineChange={setMasterDeadline}
                  onWeeklyHoursChange={setWeeklyHoursBudget}
                  onCalendarSync={handleCalendarSync}
                  onLastSyncUpdate={setLastCalendarSync}
                  onDeepWorkSettingsChange={updateDeepWorkSettings}
                  onEnergySettingsChange={updateEnergySettings}
                  onReset={resetState}
                />
              </motion.div>
            </TabsContent>
          </Tabs>
        </main>

        {/* IA Detail Modal */}
        {selectedIA && (
          <IADetailModal
            ia={selectedIA}
            open={isModalOpen}
            onOpenChange={(open) => {
              setIsModalOpen(open);
              if (!open) {
                // Refresh selected IA from state when closing
                setTimeout(() => setSelectedIA(null), 200);
              }
            }}
            onToggleMilestone={(milestoneId) =>
              handleToggleMilestone(selectedIA.id, milestoneId)
            }
            onUpdateDeadline={(milestoneId, newDeadline) =>
              handleUpdateDeadline(selectedIA.id, milestoneId, newDeadline)
            }
            onGeneratePlan={() => handleGeneratePlan(selectedIA.id)}
            isGenerating={generatingIAs.has(selectedIA.id)}
            // Time tracking props
            activeTimer={state.activeTimer}
            learnedMultipliers={
              state.learnedMultipliers || INITIAL_LEARNED_MULTIPLIERS
            }
            onStartTimer={handleStartTimer}
            onPauseTimer={handlePauseTimer}
            onResumeTimer={handleResumeTimer}
            onStopTimer={handleStopTimer}
            onCancelTimer={handleCancelTimer}
            onLogManualHours={handleLogManualHours}
          />
        )}

        {/* Blocker Log Modal */}
        <BlockerLogModal
          open={isBlockerLogModalOpen}
          onOpenChange={setIsBlockerLogModalOpen}
          ias={state.ias}
          onSaveBlocker={handleSaveBlocker}
        />

        {/* Blocker Resolve Modal */}
        <BlockerResolveModal
          open={isBlockerResolveModalOpen}
          onOpenChange={(open) => {
            setIsBlockerResolveModalOpen(open);
            if (!open) {
              setSelectedBlocker(null);
            }
          }}
          blocker={selectedBlocker}
          ias={state.ias}
          onResolve={handleBlockerResolved}
        />

        {/* AI Assistant */}
        <AssistantPanel />
        <AssistantTrigger />
      </div>
    </AssistantProvider>
  );
}

export default App;
