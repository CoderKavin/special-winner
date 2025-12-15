import type { IA, Milestone } from "../types";
import {
  parseISO,
  format,
  addDays,
  differenceInDays,
  isBefore,
  isAfter,
} from "date-fns";

export interface RescheduleResult {
  updatedMilestones: Milestone[];
  message: string;
  impactedIAs: string[];
  deadlineAtRisk: boolean;
  newCompletionDate?: string;
}

/**
 * Reschedule remaining milestones when one is completed early or late
 */
export function rescheduleAfterCompletion(
  ia: IA,
  completedMilestoneId: string,
  masterDeadline: string,
): RescheduleResult {
  const milestone = ia.milestones.find((m) => m.id === completedMilestoneId);
  if (!milestone) {
    return {
      updatedMilestones: ia.milestones,
      message: "Milestone not found",
      impactedIAs: [],
      deadlineAtRisk: false,
    };
  }

  const now = new Date();
  const milestoneDeadline = parseISO(milestone.deadline);
  const daysDifference = differenceInDays(milestoneDeadline, now);

  // If completed early (positive days), we can redistribute time
  // If completed late (negative days), we need to compress remaining milestones
  const remainingMilestones = ia.milestones.filter(
    (m) => !m.completed && m.id !== completedMilestoneId,
  );

  if (remainingMilestones.length === 0) {
    return {
      updatedMilestones: ia.milestones,
      message: "All milestones completed!",
      impactedIAs: [],
      deadlineAtRisk: false,
    };
  }

  let updatedMilestones: Milestone[];
  let message: string;

  if (daysDifference > 0) {
    // Completed early - move remaining milestones earlier
    updatedMilestones = ia.milestones.map((m) => {
      if (m.completed || m.id === completedMilestoneId) return m;

      const currentDeadline = parseISO(m.deadline);
      const currentStart = parseISO(m.startDate);

      // Move dates earlier by the saved days
      const newDeadline = addDays(currentDeadline, -daysDifference);
      const newStart = addDays(currentStart, -daysDifference);

      return {
        ...m,
        deadline: format(newDeadline, "yyyy-MM-dd"),
        startDate: format(newStart, "yyyy-MM-dd"),
      };
    });

    message = `Saved ${daysDifference} days - remaining milestones moved earlier`;
  } else if (daysDifference < 0) {
    // Completed late - push remaining milestones back
    const daysLate = Math.abs(daysDifference);

    updatedMilestones = ia.milestones.map((m) => {
      if (m.completed || m.id === completedMilestoneId) return m;

      const currentDeadline = parseISO(m.deadline);
      const currentStart = parseISO(m.startDate);

      // Push dates back by the days we're behind
      const newDeadline = addDays(currentDeadline, daysLate);
      const newStart = addDays(currentStart, daysLate);

      return {
        ...m,
        deadline: format(newDeadline, "yyyy-MM-dd"),
        startDate: format(newStart, "yyyy-MM-dd"),
      };
    });

    message = `${daysLate} days behind schedule - remaining milestones pushed back`;
  } else {
    // Completed on time
    updatedMilestones = ia.milestones;
    message = "Completed on time!";
  }

  // Check if master deadline is at risk
  const lastMilestone = updatedMilestones
    .filter((m) => !m.completed)
    .sort(
      (a, b) => parseISO(b.deadline).getTime() - parseISO(a.deadline).getTime(),
    )[0];

  const deadlineAtRisk =
    lastMilestone &&
    isAfter(parseISO(lastMilestone.deadline), parseISO(masterDeadline));

  const newCompletionDate = lastMilestone?.deadline;

  return {
    updatedMilestones,
    message,
    impactedIAs: [ia.id],
    deadlineAtRisk,
    newCompletionDate,
  };
}

/**
 * Reschedule milestones when a deadline is manually changed
 */
export function rescheduleAfterDeadlineChange(
  ia: IA,
  changedMilestoneId: string,
  newDeadline: string,
  masterDeadline: string,
): RescheduleResult {
  const milestoneIndex = ia.milestones.findIndex(
    (m) => m.id === changedMilestoneId,
  );
  if (milestoneIndex === -1) {
    return {
      updatedMilestones: ia.milestones,
      message: "Milestone not found",
      impactedIAs: [],
      deadlineAtRisk: false,
    };
  }

  const milestone = ia.milestones[milestoneIndex];
  const oldDeadline = parseISO(milestone.deadline);
  const newDeadlineDate = parseISO(newDeadline);
  const daysDifference = differenceInDays(newDeadlineDate, oldDeadline);

  if (daysDifference === 0) {
    return {
      updatedMilestones: ia.milestones,
      message: "No change in deadline",
      impactedIAs: [],
      deadlineAtRisk: false,
    };
  }

  // Update the changed milestone and all downstream milestones
  const updatedMilestones = ia.milestones.map((m, index) => {
    if (index < milestoneIndex) return m; // Don't change earlier milestones

    if (index === milestoneIndex) {
      // Update the changed milestone
      const currentStart = parseISO(m.startDate);
      const newStart = addDays(currentStart, daysDifference);

      return {
        ...m,
        deadline: newDeadline,
        startDate: format(newStart, "yyyy-MM-dd"),
      };
    }

    // Update downstream milestones
    const currentDeadline = parseISO(m.deadline);
    const currentStart = parseISO(m.startDate);

    return {
      ...m,
      deadline: format(addDays(currentDeadline, daysDifference), "yyyy-MM-dd"),
      startDate: format(addDays(currentStart, daysDifference), "yyyy-MM-dd"),
    };
  });

  // Check for conflicts
  const lastMilestone = updatedMilestones
    .filter((m) => !m.completed)
    .sort(
      (a, b) => parseISO(b.deadline).getTime() - parseISO(a.deadline).getTime(),
    )[0];

  const deadlineAtRisk =
    lastMilestone &&
    isAfter(parseISO(lastMilestone.deadline), parseISO(masterDeadline));

  const direction = daysDifference > 0 ? "back" : "forward";
  const message = `Deadline moved ${Math.abs(daysDifference)} days ${direction}. ${
    updatedMilestones.length - milestoneIndex - 1
  } downstream milestones updated.`;

  return {
    updatedMilestones,
    message,
    impactedIAs: [ia.id],
    deadlineAtRisk,
    newCompletionDate: lastMilestone?.deadline,
  };
}

/**
 * Calculate optimal distribution of IAs across the timeline
 * Ensures draft phases don't overlap
 */
export function optimizeIADistribution(
  ias: IA[],
  masterDeadline: string,
): IA[] {
  const now = new Date();
  const deadline = parseISO(masterDeadline);
  // Calculate days remaining for future use
  void differenceInDays(deadline, now);

  // Sort IAs by current priority (those with earlier next milestones first)
  const sortedIAs = [...ias].sort((a, b) => {
    const aNext = a.milestones.find((m) => !m.completed);
    const bNext = b.milestones.find((m) => !m.completed);

    if (!aNext) return 1;
    if (!bNext) return -1;

    return (
      parseISO(aNext.deadline).getTime() - parseISO(bNext.deadline).getTime()
    );
  });

  // Find draft milestones and check for overlaps
  const draftMilestones: Array<{
    ia: IA;
    milestone: Milestone;
    index: number;
  }> = [];

  sortedIAs.forEach((ia, iaIndex) => {
    ia.milestones.forEach((m) => {
      if (m.milestone_name.toLowerCase().includes("draft") && !m.completed) {
        draftMilestones.push({ ia, milestone: m, index: iaIndex });
      }
    });
  });

  // Sort drafts by start date
  draftMilestones.sort(
    (a, b) =>
      parseISO(a.milestone.startDate).getTime() -
      parseISO(b.milestone.startDate).getTime(),
  );

  // Resolve overlaps by shifting later drafts
  for (let i = 1; i < draftMilestones.length; i++) {
    const prev = draftMilestones[i - 1];
    const curr = draftMilestones[i];

    const prevEnd = parseISO(prev.milestone.deadline);
    const currStart = parseISO(curr.milestone.startDate);

    if (isBefore(currStart, prevEnd)) {
      // There's an overlap - shift the current IA's milestones
      const overlapDays = differenceInDays(prevEnd, currStart) + 1; // Add 1 day buffer

      // Find the IA and update all its milestones
      const iaToUpdate = sortedIAs.find((ia) => ia.id === curr.ia.id);
      if (iaToUpdate) {
        iaToUpdate.milestones = iaToUpdate.milestones.map((m) => ({
          ...m,
          startDate: format(
            addDays(parseISO(m.startDate), overlapDays),
            "yyyy-MM-dd",
          ),
          deadline: format(
            addDays(parseISO(m.deadline), overlapDays),
            "yyyy-MM-dd",
          ),
        }));

        // Update the current draft reference
        curr.milestone = iaToUpdate.milestones.find(
          (m) => m.id === curr.milestone.id,
        )!;
      }
    }
  }

  return sortedIAs;
}
