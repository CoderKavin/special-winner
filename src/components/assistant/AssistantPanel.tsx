import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useAssistant } from "../../contexts/AssistantContext";
import { cn } from "../../lib/utils";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import type { ConversationMessage } from "../../types";

// ============================================
// MESSAGE COMPONENT
// ============================================

interface MessageBubbleProps {
  message: ConversationMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex gap-3 p-3 rounded-lg",
        isUser
          ? "bg-primary/10 border border-primary/20 ml-8"
          : isSystem
            ? "bg-warning/10 border border-warning/20"
            : "bg-surface-hover border border-border-subtle mr-8",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-primary/20"
            : isSystem
              ? "bg-warning/20"
              : "bg-[#A855F7]/20",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary" />
        ) : isSystem ? (
          <AlertTriangle className="h-4 w-4 text-warning" />
        ) : (
          <Bot className="h-4 w-4 text-[#A855F7]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-caption font-medium text-text-secondary">
            {isUser ? "You" : isSystem ? "System" : "Assistant"}
          </span>
          <span className="text-caption text-text-tertiary">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="text-body-sm text-text-primary whitespace-pre-wrap">
          <MessageContent content={message.content} />
        </div>

        {/* Show executed actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.actions.map((action) => (
              <div
                key={action.id}
                className={cn(
                  "flex items-center gap-2 text-caption px-2 py-1 rounded",
                  action.success
                    ? "bg-success/10 text-success"
                    : "bg-critical/10 text-critical",
                )}
              >
                {action.success ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                <span>{action.payload.type.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// MARKDOWN-LIKE CONTENT RENDERER
// ============================================

// Escape HTML to prevent XSS attacks
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

// Safe markdown-like parsing that escapes HTML first
function parseMarkdownLine(line: string): React.ReactNode[] {
  const escaped = escapeHtml(line);
  const parts: React.ReactNode[] = [];
  const remaining = escaped;
  let keyIndex = 0;

  // Process bold (**text**) and code (`text`) patterns
  const pattern = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(remaining)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold text
      parts.push(
        <strong key={keyIndex++} className="text-text-primary font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // Code text
      parts.push(
        <code
          key={keyIndex++}
          className="bg-surface-hover px-1 py-0.5 rounded text-caption font-mono"
        >
          {match[3]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [escaped];
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <>
      {lines.map((line, i) => {
        // List items
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-text-tertiary">•</span>
              <span>{parseMarkdownLine(line.slice(2))}</span>
            </div>
          );
        }

        // Empty lines
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }

        return <div key={i}>{parseMarkdownLine(line)}</div>;
      })}
    </>
  );
}

// ============================================
// QUICK ACTIONS
// ============================================

interface QuickActionsProps {
  onSelect: (message: string) => void;
}

function QuickActions({ onSelect }: QuickActionsProps) {
  const actions = [
    { label: "Status", message: "How am I doing?", icon: "📊" },
    { label: "Due Soon", message: "What's due this week?", icon: "📅" },
    { label: "Blockers", message: "Show my blockers", icon: "🚧" },
    { label: "Next Task", message: "What should I work on?", icon: "🎯" },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-3 border-t border-border-subtle">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(action.message)}
          className="text-caption gap-1.5"
        >
          <span>{action.icon}</span>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================
// CONTEXT SUMMARY
// ============================================

function ContextSummary() {
  const { contextSnapshot } = useAssistant();
  const [expanded, setExpanded] = useState(false);

  if (!contextSnapshot) return null;

  const { summary, activeWarnings, daysUntilMasterDeadline } = contextSnapshot;

  return (
    <div className="p-3 bg-surface-hover border-b border-border-subtle">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-caption"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              summary.projectHealthScore >= 70
                ? "bg-success"
                : summary.projectHealthScore >= 40
                  ? "bg-warning"
                  : "bg-critical",
            )}
          />
          <span className="text-text-secondary">
            {summary.completedMilestones}/{summary.totalMilestones} milestones •{" "}
            {daysUntilMasterDeadline}d remaining
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-tertiary transition-transform duration-normal",
            expanded && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 mt-3 text-caption">
              <div className="p-2 bg-surface rounded-md">
                <div className="text-text-tertiary">IAs</div>
                <div className="text-text-secondary">
                  {summary.completedIAs} done, {summary.inProgressIAs} active
                </div>
              </div>
              <div className="p-2 bg-surface rounded-md">
                <div className="text-text-tertiary">This Week</div>
                <div className="text-text-secondary">
                  {summary.hoursLoggedThisWeek}h / {summary.weeklyBudget}h
                </div>
              </div>
              <div className="p-2 bg-surface rounded-md">
                <div className="text-text-tertiary">Blockers</div>
                <div className="text-text-secondary">
                  {summary.activeBlockers} active
                  {summary.criticalBlockers > 0 && (
                    <span className="text-critical ml-1">
                      ({summary.criticalBlockers} critical)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-surface rounded-md">
                <div className="text-text-tertiary">Health Score</div>
                <div
                  className={cn(
                    summary.projectHealthScore >= 70
                      ? "text-success"
                      : summary.projectHealthScore >= 40
                        ? "text-warning"
                        : "text-critical",
                  )}
                >
                  {summary.projectHealthScore}%
                </div>
              </div>
            </div>

            {activeWarnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {activeWarnings.slice(0, 3).map((warning, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 text-caption px-2 py-1 rounded",
                      warning.severity === "error"
                        ? "bg-critical/10 text-critical"
                        : "bg-warning/10 text-warning",
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {warning.message}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// MAIN PANEL COMPONENT
// ============================================

export function AssistantPanel() {
  const { state, closePanel, sendMessage, clearConversation } = useAssistant();

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.conversation?.messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (state.isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || state.isProcessing) return;

    const message = inputValue;
    setInputValue("");
    await sendMessage(message);
  };

  const handleQuickAction = async (message: string) => {
    await sendMessage(message);
  };

  const messages = state.conversation?.messages || [];

  return (
    <AnimatePresence>
      {state.isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={closePanel}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface border-l border-border z-50 flex flex-col shadow-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A855F7] to-primary flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-body font-semibold text-text-primary">
                    IB Assistant
                  </h2>
                  <p className="text-caption text-text-tertiary">
                    Ask me anything about your IAs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={clearConversation}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={closePanel}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Context Summary */}
            <ContextSummary />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-text-tertiary" />
                  </div>
                  <h3 className="text-h3 text-text-secondary mb-2">
                    How can I help?
                  </h3>
                  <p className="text-body-sm text-text-tertiary max-w-[250px]">
                    Ask me about your progress, upcoming deadlines, blockers, or
                    what you should work on next.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {state.isProcessing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2 p-3 bg-surface-hover rounded-lg mr-8"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-[#A855F7]" />
                      <span className="text-body-sm text-text-tertiary">
                        Thinking...
                      </span>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Quick Actions */}
            {messages.length === 0 && (
              <QuickActions onSelect={handleQuickAction} />
            )}

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-border-subtle"
            >
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={state.isProcessing}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || state.isProcessing}
                  className="bg-[#A855F7] hover:bg-[#9333EA]"
                >
                  {state.isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-caption text-text-tertiary mt-2 text-center">
                Press{" "}
                <kbd className="px-1.5 py-0.5 bg-surface-hover rounded text-text-secondary font-mono">
                  ⌘K
                </kbd>{" "}
                to toggle
              </p>
            </form>

            {/* Error Display */}
            <AnimatePresence>
              {state.lastError && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-20 left-4 right-4 p-3 bg-critical/10 border border-critical/30 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-body-sm text-critical">
                    <AlertTriangle className="h-4 w-4" />
                    {state.lastError}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// FLOATING TRIGGER BUTTON
// ============================================

export function AssistantTrigger() {
  const { state, togglePanel, contextSnapshot } = useAssistant();

  const hasWarnings =
    contextSnapshot && contextSnapshot.activeWarnings.length > 0;
  const criticalCount = contextSnapshot?.summary.criticalBlockers || 0;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={togglePanel}
      className={cn(
        "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-3 z-30",
        "bg-gradient-to-br from-[#A855F7] to-primary",
        "flex items-center justify-center",
        "hover:from-[#9333EA] hover:to-primary-hover",
        "transition-all duration-normal",
        state.isOpen && "opacity-0 pointer-events-none",
      )}
    >
      <Sparkles className="h-6 w-6 text-white" />

      {/* Notification badge */}
      {(hasWarnings || criticalCount > 0) && (
        <div
          className={cn(
            "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-caption font-bold",
            criticalCount > 0
              ? "bg-critical text-white"
              : "bg-warning text-black",
          )}
        >
          {criticalCount > 0 ? criticalCount : "!"}
        </div>
      )}
    </motion.button>
  );
}

// ============================================
// HEADER BUTTON
// ============================================

export function AssistantHeaderButton() {
  const { togglePanel, contextSnapshot } = useAssistant();

  const healthScore = contextSnapshot?.summary.projectHealthScore || 100;

  return (
    <Button variant="ghost" size="sm" onClick={togglePanel} className="gap-2">
      <Sparkles
        className={cn(
          "h-4 w-4",
          healthScore >= 70
            ? "text-[#A855F7]"
            : healthScore >= 40
              ? "text-warning"
              : "text-critical",
        )}
      />
      <span className="hidden sm:inline text-text-secondary">Assistant</span>
      <Badge
        variant={
          healthScore >= 70
            ? "success"
            : healthScore >= 40
              ? "warning"
              : "error"
        }
        className="text-caption"
      >
        {healthScore}%
      </Badge>
    </Button>
  );
}
