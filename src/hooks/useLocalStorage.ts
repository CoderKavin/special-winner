import { useState, useEffect, useCallback } from "react";
import type {
  AppState,
  IA,
  Milestone,
  WorkSession,
  LearnedMultipliers,
  DeepWorkSettings,
  EnergySettings,
  Blocker,
  Risk,
  BlockerSettings,
} from "../types";
import { INITIAL_STATE } from "../types";

const STORAGE_KEY = "ib-deadline-manager";

export function useLocalStorage() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with initial state to handle new fields
        return { ...INITIAL_STATE, ...parsed };
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    return INITIAL_STATE;
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }, [state]);

  // Update a single IA
  const updateIA = useCallback((iaId: string, updates: Partial<IA>) => {
    setState((prev) => ({
      ...prev,
      ias: prev.ias.map((ia) => (ia.id === iaId ? { ...ia, ...updates } : ia)),
    }));
  }, []);

  // Set milestones for an IA
  const setMilestones = useCallback((iaId: string, milestones: Milestone[]) => {
    setState((prev) => ({
      ...prev,
      ias: prev.ias.map((ia) =>
        ia.id === iaId
          ? {
              ...ia,
              milestones,
              status: milestones.length > 0 ? "in_progress" : ia.status,
            }
          : ia,
      ),
    }));
  }, []);

  // Toggle milestone completion
  const toggleMilestone = useCallback((iaId: string, milestoneId: string) => {
    setState((prev) => {
      const now = new Date().toISOString();
      const newIas = prev.ias.map((ia) => {
        if (ia.id !== iaId) return ia;

        const newMilestones = ia.milestones.map((m) =>
          m.id === milestoneId
            ? {
                ...m,
                completed: !m.completed,
                completedAt: !m.completed ? now : undefined,
              }
            : m,
        );

        // Update IA status based on milestones
        const allComplete = newMilestones.every((m) => m.completed);
        const anyComplete = newMilestones.some((m) => m.completed);

        const newStatus = allComplete
          ? ("completed" as const)
          : anyComplete
            ? ("in_progress" as const)
            : ("not_started" as const);

        return {
          ...ia,
          milestones: newMilestones,
          status: newStatus,
        };
      });

      // Update completedMilestones list
      const milestone = prev.ias
        .find((ia) => ia.id === iaId)
        ?.milestones.find((m) => m.id === milestoneId);

      const newCompletedMilestones = milestone?.completed
        ? prev.completedMilestones.filter((id) => id !== milestoneId)
        : [...prev.completedMilestones, milestoneId];

      return {
        ...prev,
        ias: newIas,
        completedMilestones: newCompletedMilestones,
      };
    });
  }, []);

  // Update milestone deadline
  const updateMilestoneDeadline = useCallback(
    (iaId: string, milestoneId: string, newDeadline: string) => {
      setState((prev) => ({
        ...prev,
        ias: prev.ias.map((ia) => {
          if (ia.id !== iaId) return ia;
          return {
            ...ia,
            milestones: ia.milestones.map((m) =>
              m.id === milestoneId ? { ...m, deadline: newDeadline } : m,
            ),
          };
        }),
      }));
    },
    [],
  );

  // Update master deadline
  const setMasterDeadline = useCallback((deadline: string) => {
    setState((prev) => ({ ...prev, masterDeadline: deadline }));
  }, []);

  // Update weekly hours budget
  const setWeeklyHoursBudget = useCallback((hours: number) => {
    setState((prev) => ({ ...prev, weeklyHoursBudget: hours }));
  }, []);

  // Store Google Calendar event ID
  const setGoogleEventId = useCallback(
    (milestoneId: string, eventId: string) => {
      setState((prev) => ({
        ...prev,
        googleCalendarEventIds: {
          ...prev.googleCalendarEventIds,
          [milestoneId]: eventId,
        },
      }));
    },
    [],
  );

  // Update last sync timestamp
  const setLastCalendarSync = useCallback((timestamp: string) => {
    setState((prev) => ({ ...prev, lastCalendarSync: timestamp }));
  }, []);

  // Reset to initial state
  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // === TIME TRACKING FUNCTIONS ===

  // Start timer for a milestone
  const startTimer = useCallback((iaId: string, milestoneId: string) => {
    setState((prev) => ({
      ...prev,
      activeTimer: {
        milestoneId,
        iaId,
        startTime: new Date().toISOString(),
        accumulatedMinutes: 0,
      },
    }));
  }, []);

  // Pause the active timer
  const pauseTimer = useCallback(() => {
    setState((prev) => {
      if (!prev.activeTimer || prev.activeTimer.pausedAt) return prev;

      const now = new Date();
      const startTime = new Date(prev.activeTimer.startTime);
      const sessionMinutes = (now.getTime() - startTime.getTime()) / 60000;

      return {
        ...prev,
        activeTimer: {
          ...prev.activeTimer,
          pausedAt: now.toISOString(),
          accumulatedMinutes:
            prev.activeTimer.accumulatedMinutes + sessionMinutes,
        },
      };
    });
  }, []);

  // Resume a paused timer
  const resumeTimer = useCallback(() => {
    setState((prev) => {
      if (!prev.activeTimer || !prev.activeTimer.pausedAt) return prev;

      return {
        ...prev,
        activeTimer: {
          ...prev.activeTimer,
          startTime: new Date().toISOString(),
          pausedAt: undefined,
        },
      };
    });
  }, []);

  // Stop timer and log the session
  const stopTimer = useCallback((note?: string) => {
    setState((prev) => {
      if (!prev.activeTimer) return prev;

      const now = new Date();
      let totalMinutes = prev.activeTimer.accumulatedMinutes;

      // Add current session time if not paused
      if (!prev.activeTimer.pausedAt) {
        const startTime = new Date(prev.activeTimer.startTime);
        totalMinutes += (now.getTime() - startTime.getTime()) / 60000;
      }

      // Create work session
      const session: WorkSession = {
        id: `session-${Date.now()}`,
        milestoneId: prev.activeTimer.milestoneId,
        startTime: prev.activeTimer.startTime,
        endTime: now.toISOString(),
        duration: Math.round(totalMinutes),
        note,
      };

      // Update milestone with new session
      const newIas = prev.ias.map((ia) => {
        if (ia.id !== prev.activeTimer!.iaId) return ia;

        return {
          ...ia,
          milestones: ia.milestones.map((m) => {
            if (m.id !== prev.activeTimer!.milestoneId) return m;

            const newSessions = [...(m.workSessions || []), session];
            const actualHours =
              newSessions.reduce((sum, s) => sum + s.duration, 0) / 60;

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
        activeTimer: null,
        allWorkSessions: [...prev.allWorkSessions, session],
      };
    });
  }, []);

  // Cancel timer without logging
  const cancelTimer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeTimer: null,
    }));
  }, []);

  // Manually log hours for a milestone
  const logManualHours = useCallback(
    (iaId: string, milestoneId: string, hours: number, note?: string) => {
      setState((prev) => {
        const now = new Date();
        const session: WorkSession = {
          id: `session-${Date.now()}`,
          milestoneId,
          startTime: now.toISOString(),
          endTime: now.toISOString(),
          duration: Math.round(hours * 60),
          note: note || "Manually logged",
        };

        const newIas = prev.ias.map((ia) => {
          if (ia.id !== iaId) return ia;

          return {
            ...ia,
            milestones: ia.milestones.map((m) => {
              if (m.id !== milestoneId) return m;

              const newSessions = [...(m.workSessions || []), session];
              const actualHours =
                newSessions.reduce((sum, s) => sum + s.duration, 0) / 60;

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
    [],
  );

  // Update learned multipliers
  const updateLearnedMultipliers = useCallback(
    (multipliers: LearnedMultipliers) => {
      setState((prev) => ({
        ...prev,
        learnedMultipliers: multipliers,
      }));
    },
    [],
  );

  // Update deep work settings
  const updateDeepWorkSettings = useCallback((settings: DeepWorkSettings) => {
    setState((prev) => ({
      ...prev,
      deepWorkSettings: settings,
    }));
  }, []);

  // Update energy settings
  const updateEnergySettings = useCallback((settings: EnergySettings) => {
    setState((prev) => ({
      ...prev,
      energySettings: settings,
    }));
  }, []);

  // === BLOCKER MANAGEMENT ===

  // Add a new blocker
  const addBlocker = useCallback((blocker: Blocker) => {
    setState((prev) => ({
      ...prev,
      blockers: [...prev.blockers, blocker],
    }));
  }, []);

  // Update an existing blocker
  const updateBlocker = useCallback(
    (blockerId: string, updates: Partial<Blocker>) => {
      setState((prev) => ({
        ...prev,
        blockers: prev.blockers.map((b) =>
          b.id === blockerId ? { ...b, ...updates } : b,
        ),
      }));
    },
    [],
  );

  // Replace a blocker entirely (for complex updates)
  const replaceBlocker = useCallback((blocker: Blocker) => {
    setState((prev) => ({
      ...prev,
      blockers: prev.blockers.map((b) => (b.id === blocker.id ? blocker : b)),
    }));
  }, []);

  // Remove a blocker
  const removeBlocker = useCallback((blockerId: string) => {
    setState((prev) => ({
      ...prev,
      blockers: prev.blockers.filter((b) => b.id !== blockerId),
    }));
  }, []);

  // Update all blockers (for batch operations like auto-escalation)
  const setBlockers = useCallback((blockers: Blocker[]) => {
    setState((prev) => ({
      ...prev,
      blockers,
    }));
  }, []);

  // === RISK MANAGEMENT ===

  // Add a new risk
  const addRisk = useCallback((risk: Risk) => {
    setState((prev) => ({
      ...prev,
      risks: [...prev.risks, risk],
    }));
  }, []);

  // Update an existing risk
  const updateRisk = useCallback((riskId: string, updates: Partial<Risk>) => {
    setState((prev) => ({
      ...prev,
      risks: prev.risks.map((r) =>
        r.id === riskId ? { ...r, ...updates } : r,
      ),
    }));
  }, []);

  // Remove a risk
  const removeRisk = useCallback((riskId: string) => {
    setState((prev) => ({
      ...prev,
      risks: prev.risks.filter((r) => r.id !== riskId),
    }));
  }, []);

  // Dismiss a risk (mark as not relevant)
  const dismissRisk = useCallback((riskId: string) => {
    setState((prev) => ({
      ...prev,
      risks: prev.risks.map((r) =>
        r.id === riskId ? { ...r, isDismissed: true } : r,
      ),
    }));
  }, []);

  // Update blocker settings
  const updateBlockerSettings = useCallback((settings: BlockerSettings) => {
    setState((prev) => ({
      ...prev,
      blockerSettings: settings,
    }));
  }, []);

  return {
    state,
    setState,
    updateIA,
    setMilestones,
    toggleMilestone,
    updateMilestoneDeadline,
    setMasterDeadline,
    setWeeklyHoursBudget,
    setGoogleEventId,
    setLastCalendarSync,
    resetState,
    // Time tracking
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
    updateBlocker,
    replaceBlocker,
    removeBlocker,
    setBlockers,
    // Risk management
    addRisk,
    updateRisk,
    removeRisk,
    dismissRisk,
    updateBlockerSettings,
  };
}
