/**
 * Assistant Integration Component
 * Provides state updaters to the AssistantContext for AI action execution
 */

import { useEffect } from "react";
import { useAssistant } from "../../contexts/AssistantContext";
import type { StateUpdaters } from "../../services/aiActionExecutor";
import type { AppState, IA, Milestone, Blocker, WorkSession } from "../../types";

interface AssistantIntegrationProps {
  state: AppState;
  updateIA: (iaId: string, updates: Partial<IA>) => void;
  setMasterDeadline: (deadline: string) => void;
  setWeeklyHoursBudget: (hours: number) => void;
  addBlocker: (blocker: Blocker) => void;
  replaceBlocker: (blocker: Blocker) => void;
  startTimer: (iaId: string, milestoneId: string) => void;
  stopTimer: (note?: string) => void;
  logManualHours: (iaId: string, milestoneId: string, hours: number, note?: string) => void;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function AssistantIntegration({
  state,
  updateIA,
  setMasterDeadline,
  setWeeklyHoursBudget,
  addBlocker,
  replaceBlocker,
  startTimer,
  stopTimer,
  logManualHours,
  setState,
}: AssistantIntegrationProps) {
  const { setStateUpdaters, updateAppState } = useAssistant();

  // Update app state in context whenever it changes
  useEffect(() => {
    updateAppState(state);
  }, [state, updateAppState]);

  // Set up state updaters for AI action execution
  useEffect(() => {
    const updaters: StateUpdaters = {
      updateIA,

      updateMilestone: (iaId: string, milestoneId: string, updates: Partial<Milestone>) => {
        setState(prev => ({
          ...prev,
          ias: prev.ias.map(ia => {
            if (ia.id !== iaId) return ia;
            return {
              ...ia,
              milestones: ia.milestones.map(m =>
                m.id === milestoneId ? { ...m, ...updates } : m
              ),
            };
          }),
        }));
      },

      addBlocker,

      updateBlocker: (blockerId: string, updates: Partial<Blocker>) => {
        setState(prev => ({
          ...prev,
          blockers: prev.blockers.map(b =>
            b.id === blockerId ? { ...b, ...updates } : b
          ),
        }));
      },

      updateMasterDeadline: setMasterDeadline,

      updateWeeklyBudget: setWeeklyHoursBudget,

      addWorkSession: (session: WorkSession) => {
        setState(prev => {
          // Find the IA and milestone
          const newIas = prev.ias.map(ia => {
            const milestone = ia.milestones.find(m => m.id === session.milestoneId);
            if (!milestone) return ia;

            return {
              ...ia,
              milestones: ia.milestones.map(m => {
                if (m.id !== session.milestoneId) return m;
                const newSessions = [...(m.workSessions || []), session];
                const actualHours = newSessions.reduce((sum, s) => sum + s.duration, 0) / 60;
                return {
                  ...m,
                  workSessions: newSessions,
                  actualHours,
                };
              }),
            };
          });

          return {
            ...prev,
            ias: newIas,
            allWorkSessions: [...prev.allWorkSessions, session],
          };
        });
      },

      startTimer,

      stopTimer,

      refreshState: () => state,
    };

    setStateUpdaters(updaters);
  }, [
    updateIA,
    setMasterDeadline,
    setWeeklyHoursBudget,
    addBlocker,
    replaceBlocker,
    startTimer,
    stopTimer,
    logManualHours,
    setState,
    setStateUpdaters,
    state,
  ]);

  return null;
}
