import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { ProgressSummary } from "./components/dashboard/ProgressSummary";
import { IACard } from "./components/dashboard/IACard";
import { WarningsPanel } from "./components/dashboard/WarningsPanel";
import { TimelineView } from "./components/timeline/TimelineView";
import { IADetailModal } from "./components/modals/IADetailModal";
import { Settings } from "./components/Settings";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { generateMilestones, generateAllMilestones } from "./services/ai";
import {
  rescheduleAfterCompletion,
  rescheduleAfterDeadlineChange,
} from "./services/reschedule";
import type { IA } from "./types";
import {
  LayoutDashboard,
  Calendar,
  Settings as SettingsIcon,
  Sparkles,
  BookOpen,
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
  } = useLocalStorage();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedIA, setSelectedIA] = useState<IA | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingIAs, setGeneratingIAs] = useState<Set<string>>(new Set());
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

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
          state.ias,
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
    (iaId: string, _milestoneId: string) => {
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

  // Count IAs without milestones
  const iasWithoutPlans = state.ias.filter(
    (ia) => ia.milestones.length === 0,
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-blue-400" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                IB Deadline Manager
              </h1>
            </div>

            {/* Generate All Plans Button */}
            {iasWithoutPlans > 0 && (
              <Button
                onClick={handleGenerateAllPlans}
                disabled={isGeneratingAll}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
              >
                {isGeneratingAll ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate All Plans ({iasWithoutPlans})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Progress Summary */}
              <ProgressSummary state={state} />

              {/* Warnings */}
              <WarningsPanel state={state} />

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
                <h2 className="text-lg font-semibold text-slate-300 mb-4">
                  Extended Essay
                </h2>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-lg p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-100">
                        {state.ee.name}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {state.ee.wordCount.toLocaleString()} words • Subject:{" "}
                        {state.ee.subject}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Target Deadline</p>
                      <p className="text-lg font-medium text-slate-200">
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
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-sm text-slate-500">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Settings
                state={state}
                onMasterDeadlineChange={setMasterDeadline}
                onWeeklyHoursChange={setWeeklyHoursBudget}
                onCalendarSync={handleCalendarSync}
                onLastSyncUpdate={setLastCalendarSync}
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
        />
      )}
    </div>
  );
}

export default App;
