import type { IA, AIGeneratedMilestone, Milestone } from "../types";
import { generateMilestoneId } from "../lib/utils";
import {
  format,
  addDays,
  parseISO,
  differenceInDays,
  addWeeks,
  startOfWeek,
} from "date-fns";
import {
  checkScheduleFeasibility,
  detectPhase,
  sequenceIAs,
  type ScheduleFeasibility,
} from "./scheduler";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// ============================================
// FEASIBILITY CHECK (Call this FIRST)
// ============================================

export interface GenerationFeasibility extends ScheduleFeasibility {
  canProceed: boolean;
  userActionRequired:
    | "none"
    | "extend_deadline"
    | "reduce_scope"
    | "increase_hours";
  suggestedDeadline?: string;
  suggestedHoursPerWeek?: number;
}

/**
 * Check if generating milestones is feasible before starting.
 * Call this BEFORE generateMilestones or generateAllMilestones.
 */
export function checkGenerationFeasibility(
  ias: IA[],
  masterDeadline: string,
  weeklyHoursBudget: number,
): GenerationFeasibility {
  const feasibility = checkScheduleFeasibility(ias, {
    weeklyHoursBudget,
    masterDeadline,
    bufferMultiplier: 1.2, // 20% buffer for realistic estimates
    respectDraftSequence: true,
    maxIAsPerDay: 2,
  });

  let userActionRequired: GenerationFeasibility["userActionRequired"] = "none";
  let suggestedDeadline: string | undefined;
  let suggestedHoursPerWeek: number | undefined;

  if (!feasibility.isFeasible) {
    // Calculate what would make it feasible
    const hoursPerWeekNeeded =
      feasibility.totalHoursNeeded / feasibility.weeksAvailable;

    if (hoursPerWeekNeeded <= 20) {
      // Increasing hours is feasible
      userActionRequired = "increase_hours";
      suggestedHoursPerWeek = Math.ceil(hoursPerWeekNeeded);
    } else {
      // Need to extend deadline
      userActionRequired = "extend_deadline";
      suggestedDeadline = feasibility.minimumDeadline;
    }
  }

  return {
    ...feasibility,
    canProceed: feasibility.isFeasible,
    userActionRequired,
    suggestedDeadline,
    suggestedHoursPerWeek,
  };
}

// ============================================
// IA-SPECIFIC GUIDANCE
// ============================================

function getIASpecificGuidance(ia: IA): string {
  const isEconomics = ia.id.startsWith("econ");

  if (isEconomics) {
    return `
For Economics commentaries:
- Milestone 1: Find recent news article (sources: Hindu Business Line, Economic Times, Mint, Reuters, BBC News)
- Milestone 2: Diagram creation & key concept identification
- Milestone 3: First draft (800 words with analysis)
- Milestone 4: Revision & strengthen economic theory application
- Milestone 5: Final submission check

Focus on applying economic theory to real-world news. Include at least one relevant diagram.`;
  }

  if (ia.id === "history") {
    return `
For History IA:
- Include primary and secondary source analysis requirements
- Focus on historical investigation methodology
- Ensure evaluation of sources (OPVL)
- Consider historiographical perspectives`;
  }

  if (ia.id === "math") {
    return `
For Math AA HL IA:
- Include criteria for personal engagement
- Focus on mathematical communication standards
- Ensure use of appropriate mathematical notation
- Consider the exploration's reflection component`;
  }

  if (ia.id === "physics") {
    return `
For Physics HL IA:
- Include experimental design and data collection
- Focus on uncertainty analysis and error propagation
- Ensure scientific methodology is followed
- Consider the evaluation and conclusion requirements`;
  }

  if (ia.id === "english") {
    return `
For English Lang & Lit SL IA:
- Focus on literary analysis techniques
- Include textual evidence requirements
- Consider the written and oral components
- Ensure appropriate use of literary terminology`;
  }

  return "";
}

// ============================================
// MILESTONE GENERATION
// ============================================

export async function generateMilestones(
  ia: IA,
  masterDeadline: string,
  weeklyHoursBudget: number = 6,
): Promise<Milestone[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("No API key found, using fallback milestones");
    return generateFallbackMilestones(ia, masterDeadline, weeklyHoursBudget);
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const iaSpecificGuidance = getIASpecificGuidance(ia);

  const prompt = `You are helping a 17-year-old IB Diploma student plan their Internal Assessment for ${ia.name}.

IA Details:
- Subject: ${ia.name}
- Type: ${ia.type}
- Word Count: ${ia.wordCount}
- Target Completion: ${masterDeadline}
- Current Date: ${today}

${iaSpecificGuidance}

Generate exactly 5 milestones following IB assessment criteria. Each milestone must have:
- Clear deliverable (what gets completed)
- Realistic time estimate in hours
- IB-specific guidance (reference rubric criteria)

The milestone distribution should be approximately:
- Milestone 1: Research & Topic Selection (10% of timeline)
- Milestone 2: Outline & Structure (15% of timeline)
- Milestone 3: First Draft (40% of timeline)
- Milestone 4: Revision & Refinement (25% of timeline)
- Milestone 5: Final Polish & Submission Prep (10% of timeline)

Return ONLY valid JSON array, no markdown or other text:
[
  {
    "milestone_name": "Research & Topic Selection",
    "description": "Identify research question that meets IB criteria...",
    "estimated_hours": 8,
    "dependencies": []
  },
  ...
]`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anthropic API error:", error);
      return generateFallbackMilestones(ia, masterDeadline, weeklyHoursBudget);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response
    const aiMilestones: AIGeneratedMilestone[] = JSON.parse(content);

    // Convert AI milestones to our Milestone format with PROPER dates
    return assignMilestoneDatesWithConstraints(
      ia,
      aiMilestones,
      masterDeadline,
      weeklyHoursBudget,
    );
  } catch (error) {
    console.error("Error generating milestones:", error);
    return generateFallbackMilestones(ia, masterDeadline, weeklyHoursBudget);
  }
}

/**
 * Assign milestone dates respecting weekly hours budget constraint.
 * Each milestone is allocated to complete weeks based on hours needed.
 */
function assignMilestoneDatesWithConstraints(
  ia: IA,
  aiMilestones: AIGeneratedMilestone[],
  masterDeadline: string,
  weeklyHoursBudget: number,
): Milestone[] {
  const now = new Date();
  const deadline = parseISO(masterDeadline);
  const totalWeeks = Math.ceil(differenceInDays(deadline, now) / 7);

  // Calculate total hours needed
  const totalHoursNeeded = aiMilestones.reduce(
    (sum, m) => sum + m.estimated_hours * 1.5, // 1.5x buffer
    0,
  );

  // Calculate weeks needed for this IA
  const weeksNeeded = Math.ceil(totalHoursNeeded / weeklyHoursBudget);

  // If not enough weeks, compress proportionally (but warn)
  const weeksAvailable = Math.min(totalWeeks, weeksNeeded);
  const compressionFactor = weeksAvailable / weeksNeeded;

  let currentWeek = 0;
  const milestones: Milestone[] = [];

  for (let index = 0; index < aiMilestones.length; index++) {
    const am = aiMilestones[index];
    const bufferedHours = am.estimated_hours * 1.5;

    // Calculate how many weeks this milestone needs
    let weeksForMilestone = Math.ceil(bufferedHours / weeklyHoursBudget);

    // Apply compression if necessary
    weeksForMilestone = Math.max(
      1,
      Math.round(weeksForMilestone * compressionFactor),
    );

    // Calculate dates
    const startWeek = startOfWeek(addWeeks(now, currentWeek), {
      weekStartsOn: 1,
    });
    const endWeek = addWeeks(startWeek, weeksForMilestone);

    const phase = detectPhase(am.milestone_name);

    milestones.push({
      id: generateMilestoneId(ia.id, index),
      iaId: ia.id,
      milestone_name: am.milestone_name,
      description: am.description,
      estimated_hours: am.estimated_hours,
      buffer_multiplier: 1.2,
      dependencies: am.dependencies,
      deadline: format(addDays(endWeek, -1), "yyyy-MM-dd"), // End of last day of week
      startDate: format(startWeek, "yyyy-MM-dd"),
      completed: false,
      phase,
      workSessions: [],
    });

    currentWeek += weeksForMilestone;
  }

  return milestones;
}

// ============================================
// SUBJECT-SPECIFIC MILESTONE TEMPLATES
// ============================================

/**
 * Get realistic milestone estimates for each subject's IA
 * Based on actual IB student experience and word count requirements
 */
function getSubjectSpecificMilestones(ia: IA): AIGeneratedMilestone[] {
  switch (ia.id) {
    case "math":
      // Math AA HL IA: 12-20 pages exploration, ~19 hours total
      return [
        {
          milestone_name: "Research & Topic Selection",
          description:
            "Explore potential topics, find an area of personal interest that allows for mathematical exploration. Choose topic with appropriate complexity for HL.",
          estimated_hours: 3,
          dependencies: [],
        },
        {
          milestone_name: "Outline & Mathematical Planning",
          description:
            "Plan the structure, identify key mathematical concepts to explore, and outline the methodology.",
          estimated_hours: 2,
          dependencies: ["Research & Topic Selection"],
        },
        {
          milestone_name: "First Draft & Calculations",
          description:
            "Write the exploration with all calculations, graphs, and mathematical reasoning. Focus on personal engagement and reflection.",
          estimated_hours: 8,
          dependencies: ["Outline & Mathematical Planning"],
        },
        {
          milestone_name: "Revision & Refinement",
          description:
            "Check calculations, improve mathematical communication, strengthen personal engagement, and verify criterion alignment.",
          estimated_hours: 4,
          dependencies: ["First Draft & Calculations"],
        },
        {
          milestone_name: "Final Polish",
          description:
            "Format check, notation consistency, final proofread, and submission preparation.",
          estimated_hours: 2,
          dependencies: ["Revision & Refinement"],
        },
      ];

    case "physics":
      // Physics HL IA: Lab-based investigation, ~18 hours total
      return [
        {
          milestone_name: "Research & Planning",
          description:
            "Choose research question, plan experimental methodology, identify variables and controls.",
          estimated_hours: 2,
          dependencies: [],
        },
        {
          milestone_name: "Experimental Design",
          description:
            "Design detailed procedure, prepare materials list, create data tables, plan safety considerations.",
          estimated_hours: 2,
          dependencies: ["Research & Planning"],
        },
        {
          milestone_name: "Data Collection & Analysis",
          description:
            "Conduct experiment, collect data with uncertainties, perform calculations, create graphs with error bars.",
          estimated_hours: 5,
          dependencies: ["Experimental Design"],
        },
        {
          milestone_name: "First Draft",
          description:
            "Write up all sections: introduction, methodology, data analysis, conclusion, and evaluation.",
          estimated_hours: 5,
          dependencies: ["Data Collection & Analysis"],
        },
        {
          milestone_name: "Revision & Evaluation",
          description:
            "Strengthen evaluation, check uncertainty analysis, improve scientific communication.",
          estimated_hours: 3,
          dependencies: ["First Draft"],
        },
        {
          milestone_name: "Final Polish",
          description:
            "Final formatting, check all graphs and tables, verify rubric alignment, submission prep.",
          estimated_hours: 1,
          dependencies: ["Revision & Evaluation"],
        },
      ];

    case "history":
      // History SL IA: 2200 words, ~15 hours total
      return [
        {
          milestone_name: "Research & Question Development",
          description:
            "Develop focused research question, gather primary and secondary sources, create annotated bibliography.",
          estimated_hours: 4,
          dependencies: [],
        },
        {
          milestone_name: "Outline & Source Analysis",
          description:
            "Create detailed outline, complete source evaluation (OPVL), plan argument structure.",
          estimated_hours: 2,
          dependencies: ["Research & Question Development"],
        },
        {
          milestone_name: "First Draft",
          description:
            "Write the 2200-word investigation with clear sections: identification, evaluation of sources, investigation, and reflection.",
          estimated_hours: 5,
          dependencies: ["Outline & Source Analysis"],
        },
        {
          milestone_name: "Revision & Argument Strengthening",
          description:
            "Strengthen historical analysis, improve source integration, check word count and section balance.",
          estimated_hours: 3,
          dependencies: ["First Draft"],
        },
        {
          milestone_name: "Final Polish",
          description:
            "Final proofread, citation check, format verification, and submission preparation.",
          estimated_hours: 1,
          dependencies: ["Revision & Argument Strengthening"],
        },
      ];

    case "english":
      // English Lang & Lit SL IA: ~12 hours total
      return [
        {
          milestone_name: "Text Selection & Analysis",
          description:
            "Select texts for comparison, identify key literary/linguistic features, develop thesis.",
          estimated_hours: 2,
          dependencies: [],
        },
        {
          milestone_name: "Outline & Planning",
          description:
            "Create detailed outline, plan textual evidence, structure comparative analysis.",
          estimated_hours: 1.5,
          dependencies: ["Text Selection & Analysis"],
        },
        {
          milestone_name: "First Draft",
          description:
            "Write the complete analysis with clear thesis, textual evidence, and literary terminology.",
          estimated_hours: 4,
          dependencies: ["Outline & Planning"],
        },
        {
          milestone_name: "Revision & Refinement",
          description:
            "Strengthen analysis, improve literary terminology usage, check argument flow.",
          estimated_hours: 3,
          dependencies: ["First Draft"],
        },
        {
          milestone_name: "Final Polish",
          description:
            "Final proofread, citation formatting, and submission preparation.",
          estimated_hours: 1.5,
          dependencies: ["Revision & Refinement"],
        },
      ];

    default:
      // Generic IA template: ~15 hours total
      return [
        {
          milestone_name: "Research & Topic Selection",
          description:
            "Conduct preliminary research and identify a focused research question that meets IB criteria.",
          estimated_hours: 3,
          dependencies: [],
        },
        {
          milestone_name: "Outline & Structure",
          description:
            "Create detailed outline with clear argument structure. Plan section allocation.",
          estimated_hours: 2,
          dependencies: ["Research & Topic Selection"],
        },
        {
          milestone_name: "First Draft",
          description: `Write the complete first draft (${ia.wordCount} words). Focus on content and argument flow.`,
          estimated_hours: 5,
          dependencies: ["Outline & Structure"],
        },
        {
          milestone_name: "Revision & Refinement",
          description:
            "Revise for clarity, strengthen arguments, check citations, and ensure rubric alignment.",
          estimated_hours: 3,
          dependencies: ["First Draft"],
        },
        {
          milestone_name: "Final Polish",
          description:
            "Final proofreading, format verification, and submission preparation.",
          estimated_hours: 2,
          dependencies: ["Revision & Refinement"],
        },
      ];
  }
}

// ============================================
// FALLBACK MILESTONES
// ============================================

function generateFallbackMilestones(
  ia: IA,
  masterDeadline: string,
  weeklyHoursBudget: number = 6,
): Milestone[] {
  const isEconomics = ia.id.startsWith("econ");

  // REALISTIC IB IA hour estimates based on actual student experience
  const fallbackMilestones: AIGeneratedMilestone[] = isEconomics
    ? [
        // Economics Commentary: 800 words, ~7 hours total
        {
          milestone_name: "Find News Article",
          description:
            "Find a recent news article from Hindu Business Line, Economic Times, Mint, Reuters, or BBC News that relates to economic concepts. Save article with source and date.",
          estimated_hours: 1,
          dependencies: [],
        },
        {
          milestone_name: "Diagram & Key Concepts",
          description:
            "Create relevant economic diagrams (supply/demand, market structures, etc.) and identify the key economic concepts and theories to apply.",
          estimated_hours: 1,
          dependencies: ["Find News Article"],
        },
        {
          milestone_name: "First Draft",
          description:
            "Write the 800-word commentary with clear economic analysis, diagram integration, and theory application.",
          estimated_hours: 3,
          dependencies: ["Diagram & Key Concepts"],
        },
        {
          milestone_name: "Revision & Theory",
          description:
            "Strengthen economic theory application, check diagram accuracy, and ensure all IB criteria are met.",
          estimated_hours: 1.5,
          dependencies: ["First Draft"],
        },
        {
          milestone_name: "Final Submission",
          description:
            "Final proofreading, format check, bibliography verification, and submission preparation.",
          estimated_hours: 0.5,
          dependencies: ["Revision & Theory"],
        },
      ]
    : getSubjectSpecificMilestones(ia);

  return assignMilestoneDatesWithConstraints(
    ia,
    fallbackMilestones,
    masterDeadline,
    weeklyHoursBudget,
  );
}

// ============================================
// GENERATE ALL MILESTONES
// ============================================

export interface GenerateAllResult {
  milestones: Map<string, Milestone[]>;
  feasibility: GenerationFeasibility;
  warnings: string[];
}

export async function generateAllMilestones(
  ias: IA[],
  masterDeadline: string,
  weeklyHoursBudget: number = 6,
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<string, Milestone[]>> {
  const results = new Map<string, Milestone[]>();

  // Sequence IAs optimally before generating
  const sequencedIAs = sequenceIAs(ias);
  const iasToGenerate = sequencedIAs.filter((ia) => ia.milestones.length === 0);

  // Track cumulative week offset for sequential scheduling
  let weekOffset = 0;

  for (let i = 0; i < iasToGenerate.length; i++) {
    const ia = iasToGenerate[i];
    onProgress?.(i, iasToGenerate.length);

    // Generate milestones for this IA
    const milestones = await generateMilestones(
      ia,
      masterDeadline,
      weeklyHoursBudget,
    );

    // Offset the milestones based on previous IAs
    const offsetMilestones = offsetMilestonesByWeeks(milestones, weekOffset);
    results.set(ia.id, offsetMilestones);

    // Calculate how many weeks this IA takes
    const iaWeeks = calculateIAWeeks(offsetMilestones, weeklyHoursBudget);
    weekOffset += iaWeeks;

    // Add a small delay to avoid rate limiting
    if (i < iasToGenerate.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  onProgress?.(iasToGenerate.length, iasToGenerate.length);
  return results;
}

/**
 * Offset all milestone dates by a number of weeks
 */
function offsetMilestonesByWeeks(
  milestones: Milestone[],
  weeks: number,
): Milestone[] {
  if (weeks === 0) return milestones;

  return milestones.map((m) => ({
    ...m,
    startDate: format(addWeeks(parseISO(m.startDate), weeks), "yyyy-MM-dd"),
    deadline: format(addWeeks(parseISO(m.deadline), weeks), "yyyy-MM-dd"),
  }));
}

/**
 * Calculate how many weeks an IA's milestones span
 */
function calculateIAWeeks(
  milestones: Milestone[],
  weeklyHoursBudget: number,
): number {
  const totalHours = milestones.reduce(
    (sum, m) => sum + m.estimated_hours * m.buffer_multiplier,
    0,
  );
  return Math.ceil(totalHours / weeklyHoursBudget);
}
