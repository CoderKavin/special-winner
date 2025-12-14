import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  differenceInDays,
  addDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  isBefore,
  isAfter,
  addWeeks,
} from "date-fns";
import type { IA, Milestone, WeeklyWorkload, Warning, AppState } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d");
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? parseISO(date) : date;
  return differenceInDays(d, new Date());
}

export function daysUntilText(date: string | Date): string {
  const days = daysUntil(date);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

export function getProgressPercentage(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const completed = milestones.filter((m) => m.completed).length;
  return Math.round((completed / milestones.length) * 100);
}

export function getNextMilestone(milestones: Milestone[]): Milestone | null {
  const incomplete = milestones
    .filter((m) => !m.completed)
    .sort((a, b) => parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime());
  return incomplete[0] || null;
}

export function calculateWeeklyWorkload(
  ias: IA[],
  startDate: Date,
  endDate: Date,
  weeklyBudget: number
): WeeklyWorkload[] {
  const workloads: WeeklyWorkload[] = [];
  let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });

  while (isBefore(currentWeekStart, endDate)) {
    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const milestonesThisWeek: Milestone[] = [];

    for (const ia of ias) {
      for (const milestone of ia.milestones) {
        if (!milestone.completed) {
          const milestoneDeadline = parseISO(milestone.deadline);
          if (
            isWithinInterval(milestoneDeadline, {
              start: currentWeekStart,
              end: currentWeekEnd,
            })
          ) {
            milestonesThisWeek.push(milestone);
          }
        }
      }
    }

    const totalHours = milestonesThisWeek.reduce(
      (sum, m) => sum + m.estimated_hours * m.buffer_multiplier,
      0
    );

    workloads.push({
      weekStart: currentWeekStart.toISOString(),
      weekEnd: currentWeekEnd.toISOString(),
      totalHours,
      milestones: milestonesThisWeek,
      isOverloaded: totalHours > weeklyBudget,
    });

    currentWeekStart = addWeeks(currentWeekStart, 1);
  }

  return workloads;
}

export function generateWarnings(state: AppState): Warning[] {
  const warnings: Warning[] = [];
  const now = new Date();
  const masterDeadline = parseISO(state.masterDeadline);

  // Check for overdue milestones
  for (const ia of state.ias) {
    for (const milestone of ia.milestones) {
      if (!milestone.completed && isBefore(parseISO(milestone.deadline), now)) {
        warnings.push({
          type: "overdue",
          message: `${ia.name}: "${milestone.milestone_name}" is overdue`,
          severity: "error",
          affectedIds: [milestone.id],
        });
      }
    }
  }

  // Check for overlapping draft phases
  const draftMilestones: { ia: IA; milestone: Milestone }[] = [];
  for (const ia of state.ias) {
    const draft = ia.milestones.find(
      (m) => m.milestone_name.toLowerCase().includes("draft") && !m.completed
    );
    if (draft) {
      draftMilestones.push({ ia, milestone: draft });
    }
  }

  for (let i = 0; i < draftMilestones.length; i++) {
    for (let j = i + 1; j < draftMilestones.length; j++) {
      const a = draftMilestones[i];
      const b = draftMilestones[j];
      const aStart = parseISO(a.milestone.startDate);
      const aEnd = parseISO(a.milestone.deadline);
      const bStart = parseISO(b.milestone.startDate);
      const bEnd = parseISO(b.milestone.deadline);

      const overlaps =
        isWithinInterval(bStart, { start: aStart, end: aEnd }) ||
        isWithinInterval(bEnd, { start: aStart, end: aEnd }) ||
        isWithinInterval(aStart, { start: bStart, end: bEnd });

      if (overlaps) {
        warnings.push({
          type: "overlap",
          message: `Can't write ${a.ia.name} and ${b.ia.name} simultaneously`,
          severity: "warning",
          affectedIds: [a.milestone.id, b.milestone.id],
        });
      }
    }
  }

  // Check weekly workload
  const workloads = calculateWeeklyWorkload(
    state.ias,
    now,
    addDays(masterDeadline, 7),
    state.weeklyHoursBudget
  );

  for (const week of workloads) {
    if (week.isOverloaded) {
      warnings.push({
        type: "overload",
        message: `Week of ${formatShortDate(week.weekStart)}: ${week.totalHours.toFixed(1)} hours scheduled - exceeds ${state.weeklyHoursBudget} hour budget`,
        severity: "warning",
        affectedIds: week.milestones.map((m) => m.id),
      });
    }
  }

  // Check if master deadline is at risk
  const allMilestones = state.ias.flatMap((ia) => ia.milestones);
  const lastMilestone = allMilestones
    .filter((m) => !m.completed)
    .sort(
      (a, b) => parseISO(b.deadline).getTime() - parseISO(a.deadline).getTime()
    )[0];

  if (lastMilestone && isAfter(parseISO(lastMilestone.deadline), masterDeadline)) {
    const daysLate = differenceInDays(parseISO(lastMilestone.deadline), masterDeadline);
    warnings.push({
      type: "deadline_risk",
      message: `Current pace will finish ${formatDate(lastMilestone.deadline)} - ${daysLate} days late`,
      severity: "error",
      affectedIds: [lastMilestone.id],
    });
  }

  // Check if there's enough time
  const totalRemainingHours = allMilestones
    .filter((m) => !m.completed)
    .reduce((sum, m) => sum + m.estimated_hours * m.buffer_multiplier, 0);

  const weeksRemaining = Math.max(0, differenceInDays(masterDeadline, now) / 7);
  const availableHours = weeksRemaining * state.weeklyHoursBudget;

  if (totalRemainingHours > availableHours && allMilestones.length > 0) {
    warnings.push({
      type: "insufficient_time",
      message: `${totalRemainingHours.toFixed(0)} hours needed, but only ${availableHours.toFixed(0)} hours available at ${state.weeklyHoursBudget} hrs/week`,
      severity: "error",
      affectedIds: [],
    });
  }

  return warnings;
}

export function generateMilestoneId(iaId: string, index: number): string {
  return `${iaId}-milestone-${index + 1}`;
}
