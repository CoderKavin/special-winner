import type { IA, AIGeneratedMilestone, Milestone } from "../types";
import { generateMilestoneId } from "../lib/utils";
import { format, addDays, parseISO, differenceInDays } from "date-fns";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

export async function generateMilestones(
  ia: IA,
  masterDeadline: string,
): Promise<Milestone[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("No API key found, using fallback milestones");
    return generateFallbackMilestones(ia, masterDeadline);
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
      return generateFallbackMilestones(ia, masterDeadline);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response
    const aiMilestones: AIGeneratedMilestone[] = JSON.parse(content);

    // Convert AI milestones to our Milestone format with dates
    return assignMilestoneDates(ia, aiMilestones, masterDeadline);
  } catch (error) {
    console.error("Error generating milestones:", error);
    return generateFallbackMilestones(ia, masterDeadline);
  }
}

function assignMilestoneDates(
  ia: IA,
  aiMilestones: AIGeneratedMilestone[],
  masterDeadline: string,
): Milestone[] {
  const deadline = parseISO(masterDeadline);
  const now = new Date();
  const totalDays = differenceInDays(deadline, now);

  // Timeline distribution percentages
  const distribution = [0.1, 0.15, 0.4, 0.25, 0.1];

  let currentDay = 0;
  const milestones: Milestone[] = aiMilestones.map((am, index) => {
    const daysForMilestone = Math.round(totalDays * distribution[index]);
    const startDate = addDays(now, currentDay);
    currentDay += daysForMilestone;
    const milestoneDeadline = addDays(now, currentDay);

    return {
      id: generateMilestoneId(ia.id, index),
      iaId: ia.id,
      milestone_name: am.milestone_name,
      description: am.description,
      estimated_hours: am.estimated_hours,
      buffer_multiplier: 1.5,
      dependencies: am.dependencies,
      deadline: format(milestoneDeadline, "yyyy-MM-dd"),
      startDate: format(startDate, "yyyy-MM-dd"),
      completed: false,
      phase: undefined,
      workSessions: [],
    };
  });

  return milestones;
}

function generateFallbackMilestones(
  ia: IA,
  masterDeadline: string,
): Milestone[] {
  const isEconomics = ia.id.startsWith("econ");

  const fallbackMilestones: AIGeneratedMilestone[] = isEconomics
    ? [
        {
          milestone_name: "Find News Article",
          description:
            "Find a recent news article from Hindu Business Line, Economic Times, Mint, Reuters, or BBC News that relates to economic concepts. Save article with source and date.",
          estimated_hours: 3,
          dependencies: [],
        },
        {
          milestone_name: "Diagram & Key Concepts",
          description:
            "Create relevant economic diagrams (supply/demand, market structures, etc.) and identify the key economic concepts and theories to apply.",
          estimated_hours: 4,
          dependencies: ["Find News Article"],
        },
        {
          milestone_name: "First Draft",
          description:
            "Write the 800-word commentary with clear economic analysis, diagram integration, and theory application.",
          estimated_hours: 6,
          dependencies: ["Diagram & Key Concepts"],
        },
        {
          milestone_name: "Revision & Theory",
          description:
            "Strengthen economic theory application, check diagram accuracy, and ensure all IB criteria are met.",
          estimated_hours: 4,
          dependencies: ["First Draft"],
        },
        {
          milestone_name: "Final Submission",
          description:
            "Final proofreading, format check, bibliography verification, and submission preparation.",
          estimated_hours: 2,
          dependencies: ["Revision & Theory"],
        },
      ]
    : [
        {
          milestone_name: "Research & Topic Selection",
          description:
            "Conduct preliminary research and identify a focused research question that meets IB criteria. Document sources and create research log.",
          estimated_hours: 8,
          dependencies: [],
        },
        {
          milestone_name: "Outline & Structure",
          description:
            "Create detailed outline with clear argument structure. Plan word count allocation for each section.",
          estimated_hours: 5,
          dependencies: ["Research & Topic Selection"],
        },
        {
          milestone_name: "First Draft",
          description: `Write the complete first draft (${ia.wordCount} words). Focus on content and argument flow rather than perfection.`,
          estimated_hours: 15,
          dependencies: ["Outline & Structure"],
        },
        {
          milestone_name: "Revision & Refinement",
          description:
            "Revise for clarity, strengthen arguments, check citations, and ensure rubric criteria alignment.",
          estimated_hours: 8,
          dependencies: ["First Draft"],
        },
        {
          milestone_name: "Final Polish",
          description:
            "Final proofreading, format verification, bibliography check, and submission preparation.",
          estimated_hours: 4,
          dependencies: ["Revision & Refinement"],
        },
      ];

  return assignMilestoneDates(ia, fallbackMilestones, masterDeadline);
}

export async function generateAllMilestones(
  ias: IA[],
  masterDeadline: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<string, Milestone[]>> {
  const results = new Map<string, Milestone[]>();
  const iasToGenerate = ias.filter((ia) => ia.milestones.length === 0);

  for (let i = 0; i < iasToGenerate.length; i++) {
    const ia = iasToGenerate[i];
    onProgress?.(i, iasToGenerate.length);

    const milestones = await generateMilestones(ia, masterDeadline);
    results.set(ia.id, milestones);

    // Add a small delay to avoid rate limiting
    if (i < iasToGenerate.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  onProgress?.(iasToGenerate.length, iasToGenerate.length);
  return results;
}
