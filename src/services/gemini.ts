/**
 * Gemini AI Service for the IB Assistant
 */

import type { ContextSnapshot, AppState } from "../types";

const GEMINI_API_KEY = "AIzaSyDmt5bvI8mXsFarINPQwpIwFVsaA5wGEXc";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: {
    message: string;
  };
}

/**
 * Build system context for the AI
 */
function buildSystemContext(context: ContextSnapshot | null, appState: AppState): string {
  if (!context) {
    return "You are an IB Deadline Manager assistant. Help students manage their Internal Assessments and Extended Essay deadlines.";
  }

  const { summary, activeWarnings, daysUntilMasterDeadline } = context;

  // Build IA details
  const iaDetails = appState.ias.map((ia) => {
    const completed = ia.milestones.filter((m) => m.completed).length;
    const total = ia.milestones.length;
    const nextMilestone = ia.milestones.find((m) => !m.completed);
    return `- ${ia.name} (${ia.subjectColor}): ${completed}/${total} milestones, status: ${ia.status}${nextMilestone ? `, next: "${nextMilestone.milestone_name}" due ${nextMilestone.deadline}` : ""}`;
  }).join("\n");

  // Build blocker details
  const blockerDetails = appState.blockers
    .filter((b) => b.status === "active")
    .map((b) => `- [${b.severity.toUpperCase()}] ${b.title}: ${b.description}`)
    .join("\n") || "No active blockers";

  // Build upcoming milestones
  const upcomingDetails = summary.upcomingMilestones
    .map((m) => `- ${m.name} (${m.iaName}): due in ${m.daysUntilDeadline} days, ${m.hoursRemaining.toFixed(1)}h remaining`)
    .join("\n") || "No upcoming milestones in the next 7 days";

  // Build overdue milestones
  const overdueDetails = summary.overdueMilestones
    .map((m) => `- ${m.name} (${m.iaName}): ${Math.abs(m.daysUntilDeadline)} days overdue`)
    .join("\n") || "No overdue milestones";

  // Build warnings
  const warningDetails = activeWarnings
    .map((w) => `- [${w.severity.toUpperCase()}] ${w.message}`)
    .join("\n") || "No active warnings";

  return `You are an intelligent IB Deadline Manager assistant. You help IB students manage their Internal Assessments (IAs) and Extended Essay deadlines effectively.

CURRENT DATE: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
MASTER DEADLINE: ${appState.masterDeadline} (${daysUntilMasterDeadline} days remaining)

PROJECT STATUS:
- Overall Progress: ${summary.completedMilestones}/${summary.totalMilestones} milestones completed (${summary.onTrackPercentage}% on track)
- Project Health Score: ${summary.projectHealthScore}/100
- IAs: ${summary.completedIAs} completed, ${summary.inProgressIAs} in progress, ${summary.overdueIAs} overdue
- This Week: ${summary.hoursLoggedThisWeek}h logged out of ${summary.weeklyBudget}h budget
- Active Blockers: ${summary.activeBlockers} (${summary.criticalBlockers} critical)
- High Priority Risks: ${summary.highPriorityRisks}

IAs OVERVIEW:
${iaDetails}

UPCOMING MILESTONES (next 7 days):
${upcomingDetails}

OVERDUE MILESTONES:
${overdueDetails}

ACTIVE BLOCKERS:
${blockerDetails}

WARNINGS:
${warningDetails}

INSTRUCTIONS:
1. Be concise and helpful. Use markdown formatting for clarity (bold for emphasis, bullet points for lists).
2. When asked about status/progress, provide a clear summary with specific numbers.
3. When asked what to work on, prioritize: overdue items > critical blockers > upcoming deadlines.
4. Be encouraging but realistic about deadlines and workload.
5. If the user seems stressed, acknowledge it and help break down tasks into manageable pieces.
6. Reference specific IAs and milestones by name when relevant.
7. Keep responses focused and actionable - students are busy!`;
}

/**
 * Generate a response using Gemini AI
 */
export async function generateGeminiResponse(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  context: ContextSnapshot | null,
  appState: AppState
): Promise<string> {
  try {
    // Build conversation history for Gemini
    const messages: GeminiMessage[] = [];

    // Add system context as first user message (Gemini doesn't have system role)
    const systemContext = buildSystemContext(context, appState);
    messages.push({
      role: "user",
      parts: [{ text: `[SYSTEM CONTEXT - DO NOT REPEAT THIS TO USER]\n${systemContext}\n\n[END SYSTEM CONTEXT]\n\nPlease acknowledge you understand the context and are ready to help.` }],
    });
    messages.push({
      role: "model",
      parts: [{ text: "I understand the context. I'm ready to help you manage your IB deadlines. What would you like to know?" }],
    });

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    // Add current user message
    messages.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response generated");
    }

    const generatedText = data.candidates[0].content.parts
      .map((part) => part.text)
      .join("");

    return generatedText;
  } catch (error) {
    console.error("Gemini AI error:", error);

    // Fallback to basic response
    return generateFallbackResponse(userMessage, context, appState);
  }
}

/**
 * Fallback response when Gemini fails
 */
function generateFallbackResponse(
  userMessage: string,
  context: ContextSnapshot | null,
  appState: AppState
): string {
  const message = userMessage.toLowerCase();

  // Status queries
  if (
    message.includes("status") ||
    message.includes("how am i doing") ||
    message.includes("progress")
  ) {
    if (!context) return "I don't have context about your current state.";

    const { summary } = context;
    return `Here's your current status:

**Overall Progress:** ${summary.completedMilestones}/${summary.totalMilestones} milestones completed (${summary.onTrackPercentage}% on track)

**IAs:** ${summary.completedIAs} completed, ${summary.inProgressIAs} in progress, ${summary.overdueIAs} overdue

**This Week:** ${summary.hoursLoggedThisWeek}h logged of ${summary.weeklyBudget}h budget

**Blockers:** ${summary.activeBlockers} active (${summary.criticalBlockers} critical)

**Days until deadline:** ${context.daysUntilMasterDeadline}

${summary.overdueMilestones.length > 0 ? `\n**Overdue:** ${summary.overdueMilestones.map((m) => m.name).join(", ")}` : ""}`;
  }

  // Schedule queries
  if (
    message.includes("due") ||
    message.includes("upcoming") ||
    message.includes("schedule") ||
    message.includes("this week")
  ) {
    if (!context) return "I don't have context about your schedule.";

    const { summary } = context;
    if (summary.upcomingMilestones.length === 0) {
      return "You have no milestones due in the next 7 days. Great job staying ahead!";
    }

    const upcoming = summary.upcomingMilestones
      .map(
        (m) =>
          `- **${m.name}** (${m.iaName}): ${m.daysUntilDeadline === 0 ? "Today!" : m.daysUntilDeadline === 1 ? "Tomorrow" : `in ${m.daysUntilDeadline} days`}`
      )
      .join("\n");

    return `**Upcoming Milestones:**\n${upcoming}`;
  }

  // Blocker queries
  if (message.includes("blocker") || message.includes("stuck") || message.includes("blocking")) {
    const activeBlockers = appState.blockers.filter((b) => b.status === "active");
    if (activeBlockers.length === 0) {
      return "You don't have any active blockers. Keep up the momentum!";
    }

    const blockerList = activeBlockers
      .map((b) => `- **${b.title}** (${b.severity}): ${b.description}`)
      .join("\n");

    return `**Active Blockers (${activeBlockers.length}):**\n${blockerList}\n\nWould you like me to help resolve any of these?`;
  }

  // Help
  if (message.includes("help") || message.includes("what can you do")) {
    return `I'm your IB deadline assistant powered by AI! Here's what I can help with:

**Status & Progress**
- "How am I doing?" - Get overall progress summary
- "What's overdue?" - See overdue milestones
- "Show my blockers" - View active blockers

**Schedule**
- "What's due this week?" - Upcoming deadlines
- "When is [IA] due?" - Specific deadline info

**Planning**
- "What should I work on?" - Get prioritized recommendations
- "How can I catch up?" - Strategies for getting back on track

Ask me anything about your IB work!`;
  }

  // What should I work on
  if (
    message.includes("what should i") ||
    message.includes("prioritize") ||
    message.includes("work on")
  ) {
    if (!context) return "I need more context to give you a recommendation.";

    const { summary } = context;

    if (summary.overdueMilestones.length > 0) {
      const first = summary.overdueMilestones[0];
      return `**Priority:** You should focus on **${first.name}** (${first.iaName}) - it's ${Math.abs(first.daysUntilDeadline)} days overdue.${first.hasBlocker ? " Note: This has an active blocker that may need resolution first." : ""}`;
    }

    if (summary.criticalBlockers > 0) {
      return `**Priority:** You have ${summary.criticalBlockers} critical blocker(s) that should be resolved first. Would you like me to show them?`;
    }

    if (summary.upcomingMilestones.length > 0) {
      const first = summary.upcomingMilestones[0];
      return `**Suggested:** Work on **${first.name}** (${first.iaName}) - due ${first.daysUntilDeadline === 0 ? "today" : first.daysUntilDeadline === 1 ? "tomorrow" : `in ${first.daysUntilDeadline} days`}. You have about ${first.hoursRemaining.toFixed(1)}h of work remaining.`;
    }

    return "Great job! You're all caught up. Consider reviewing upcoming milestones or doing some planning.";
  }

  // Default
  return `I'm here to help with your IB deadlines! Try asking me:
- "How am I doing?"
- "What's due this week?"
- "What should I work on?"
- "Show my blockers"`;
}
