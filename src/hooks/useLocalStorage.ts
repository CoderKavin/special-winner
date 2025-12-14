import { useState, useEffect, useCallback } from "react";
import type { AppState, IA, Milestone } from "../types";
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
  };
}
