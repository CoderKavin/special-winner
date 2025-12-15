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
  Maximize2,
  Minimize2,
  Eye,
  Check,
  XCircle,
  Zap,
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
        "flex gap-3 p-3 rounded-xl",
        isUser
          ? "bg-primary/10 dark:bg-primary/10 border border-primary/20 ml-8"
          : isSystem
            ? "bg-amber-50 dark:bg-warning/10 border border-amber-200 dark:border-warning/20"
            : "bg-slate-50 dark:bg-surface-hover border border-slate-200 dark:border-border-subtle mr-8",
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
          <span className="text-xs font-semibold text-slate-600 dark:text-text-secondary">
            {isUser ? "You" : isSystem ? "System" : "Assistant"}
          </span>
          <span className="text-xs text-slate-400 dark:text-text-tertiary">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="text-sm text-slate-800 dark:text-text-primary whitespace-pre-wrap leading-relaxed">
          <MessageContent content={message.content} />
        </div>

        {/* Show executed actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.actions.map((action) => (
              <div
                key={action.id}
                className={cn(
                  "flex items-center gap-2 text-xs px-2 py-1 rounded",
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
        <strong
          key={keyIndex++}
          className="text-slate-900 dark:text-text-primary font-semibold"
        >
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // Code text
      parts.push(
        <code
          key={keyIndex++}
          className="bg-slate-200 dark:bg-surface-hover px-1.5 py-0.5 rounded text-xs font-mono"
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
              <span className="text-slate-400 dark:text-text-tertiary">•</span>
              <span>{parseMarkdownLine(line.slice(2))}</span>
            </div>
          );
        }

        // Numbered list items
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 ml-2">
                <span className="text-slate-400 dark:text-text-tertiary min-w-[1.5rem]">
                  {match[1]}.
                </span>
                <span>{parseMarkdownLine(match[2])}</span>
              </div>
            );
          }
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
// ACTION CONFIRMATION PANEL
// ============================================

function ActionConfirmationPanel() {
  const { state, confirmPendingActions, cancelPendingActions } = useAssistant();

  if (!state.awaitingConfirmation || state.pendingActions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="mx-4 mb-3 p-4 bg-amber-50 dark:bg-warning/10 border border-amber-200 dark:border-warning/30 rounded-xl"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-warning mb-2">
            Confirm Actions
          </h4>
          <div className="space-y-2 mb-3">
            {state.pendingActions.map((preview, index) => (
              <div
                key={index}
                className="text-sm text-amber-700 dark:text-warning/80 flex items-start gap-2"
              >
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">{preview.description}</span>
                  {preview.warnings && preview.warnings.length > 0 && (
                    <div className="text-xs text-amber-600 dark:text-warning/60 mt-0.5">
                      {preview.warnings.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={confirmPendingActions}
              disabled={state.isProcessing}
              className="bg-warning hover:bg-warning/90 text-black"
            >
              {state.isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancelPendingActions}
              disabled={state.isProcessing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
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
    <div className="flex flex-wrap gap-2 p-3 border-t border-slate-200 dark:border-border-subtle">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(action.message)}
          className="text-sm gap-1.5 h-9"
        >
          <span>{action.icon}</span>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================
// CONTEXT SUMMARY (Compact for floating chat)
// ============================================

function ContextSummary() {
  const { contextSnapshot } = useAssistant();
  const [expanded, setExpanded] = useState(false);

  if (!contextSnapshot) return null;

  const { summary, activeWarnings, daysUntilMasterDeadline } = contextSnapshot;

  return (
    <div className="px-4 py-3 bg-slate-50 dark:bg-surface-hover border-b border-slate-200 dark:border-border-subtle">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full",
              summary.projectHealthScore >= 70
                ? "bg-success"
                : summary.projectHealthScore >= 40
                  ? "bg-warning"
                  : "bg-critical",
            )}
          />
          <span className="text-slate-600 dark:text-text-secondary font-medium">
            {summary.completedMilestones}/{summary.totalMilestones} milestones •{" "}
            {daysUntilMasterDeadline}d left
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 dark:text-text-tertiary transition-transform duration-150",
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
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div className="p-2.5 bg-white dark:bg-surface rounded-lg border border-slate-200 dark:border-border-subtle">
                <div className="text-slate-500 dark:text-text-tertiary text-xs">
                  IAs
                </div>
                <div className="text-slate-800 dark:text-text-secondary font-medium">
                  {summary.completedIAs} done, {summary.inProgressIAs} active
                </div>
              </div>
              <div className="p-2.5 bg-white dark:bg-surface rounded-lg border border-slate-200 dark:border-border-subtle">
                <div className="text-slate-500 dark:text-text-tertiary text-xs">
                  This Week
                </div>
                <div className="text-slate-800 dark:text-text-secondary font-medium">
                  {summary.hoursLoggedThisWeek}h / {summary.weeklyBudget}h
                </div>
              </div>
              <div className="p-2.5 bg-white dark:bg-surface rounded-lg border border-slate-200 dark:border-border-subtle">
                <div className="text-slate-500 dark:text-text-tertiary text-xs">
                  Blockers
                </div>
                <div className="text-slate-800 dark:text-text-secondary font-medium">
                  {summary.activeBlockers} active
                  {summary.criticalBlockers > 0 && (
                    <span className="text-critical ml-1">
                      ({summary.criticalBlockers} critical)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2.5 bg-white dark:bg-surface rounded-lg border border-slate-200 dark:border-border-subtle">
                <div className="text-slate-500 dark:text-text-tertiary text-xs">
                  Health
                </div>
                <div
                  className={cn(
                    "font-semibold",
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
              <div className="mt-3 space-y-1.5">
                {activeWarnings.slice(0, 2).map((warning, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg",
                      warning.severity === "error"
                        ? "bg-red-50 dark:bg-critical/10 text-red-700 dark:text-critical"
                        : "bg-amber-50 dark:bg-warning/10 text-amber-700 dark:text-warning",
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{warning.message}</span>
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
// SCREEN CONTEXT INDICATOR
// ============================================

function ScreenContextIndicator() {
  const { currentView, contextSnapshot } = useAssistant();

  const getViewLabel = () => {
    switch (currentView.view) {
      case "dashboard":
        return "Viewing Dashboard";
      case "timeline":
        return "Viewing Timeline";
      case "settings":
        return "Viewing Settings";
      case "ia_detail": {
        const ia = contextSnapshot?.summary.upcomingMilestones.find(
          (m) => m.iaId === currentView.focusedIAId,
        );
        return ia ? `Viewing ${ia.iaName}` : "Viewing IA Details";
      }
      default:
        return "Viewing App";
    }
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 dark:bg-primary/10 rounded text-xs font-medium text-primary">
      <Eye className="h-3 w-3" />
      <span>{getViewLabel()}</span>
    </div>
  );
}

// ============================================
// PROACTIVE NOTIFICATIONS
// ============================================

function ProactiveNotifications() {
  const { state, dismissNotification, sendMessage } = useAssistant();

  const activeNotifications = state.notifications.filter((n) => !n.dismissed);

  if (activeNotifications.length === 0) return null;

  return (
    <div className="px-4 py-2 space-y-2 border-b border-slate-200 dark:border-border-subtle">
      {activeNotifications.slice(0, 2).map((notification) => (
        <motion.div
          key={notification.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className={cn(
            "p-3 rounded-lg flex items-start gap-3",
            notification.priority === "urgent"
              ? "bg-critical/10 border border-critical/30"
              : notification.priority === "high"
                ? "bg-warning/10 border border-warning/30"
                : "bg-slate-100 dark:bg-surface-hover border border-slate-200 dark:border-border-subtle",
          )}
        >
          <AlertTriangle
            className={cn(
              "h-4 w-4 shrink-0 mt-0.5",
              notification.priority === "urgent"
                ? "text-critical"
                : notification.priority === "high"
                  ? "text-warning"
                  : "text-slate-500",
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-text-primary">
              {notification.title}
            </p>
            <p className="text-xs text-slate-600 dark:text-text-secondary mt-0.5">
              {notification.message}
            </p>
            {notification.suggestedActionLabel && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={() => {
                  if (notification.suggestedAction?.data?.message) {
                    sendMessage(
                      notification.suggestedAction.data.message as string,
                    );
                  }
                  dismissNotification(notification.id);
                }}
              >
                {notification.suggestedActionLabel}
              </Button>
            )}
          </div>
          <button
            onClick={() => dismissNotification(notification.id)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-text-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// FLOATING CHAT PANEL COMPONENT
// ============================================

export function AssistantPanel() {
  const { state, closePanel, sendMessage, clearConversation } = useAssistant();

  const [inputValue, setInputValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Floating chat dimensions - LARGER
  const chatWidth = isExpanded ? "w-[520px]" : "w-[440px]";
  const chatHeight = isExpanded ? "h-[720px]" : "h-[600px]";

  return (
    <AnimatePresence>
      {state.isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          className={cn(
            "fixed bottom-24 right-6 z-50",
            chatWidth,
            chatHeight,
            "bg-white dark:bg-surface",
            "border border-slate-200 dark:border-border-subtle",
            "rounded-2xl shadow-2xl dark:shadow-5",
            "flex flex-col overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-border-subtle bg-slate-50 dark:bg-surface-hover">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A855F7] to-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-text-primary">
                  IB Assistant
                </h2>
                <ScreenContextIndicator />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={clearConversation}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8"
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={closePanel}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Context Summary */}
          <ContextSummary />

          {/* Proactive Notifications */}
          <ProactiveNotifications />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-surface-hover flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-slate-400 dark:text-text-tertiary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-text-secondary mb-2">
                  How can I help?
                </h3>
                <p className="text-sm text-slate-500 dark:text-text-tertiary max-w-[280px] leading-relaxed">
                  I can execute actions on your behalf: complete milestones,
                  reschedule tasks, log time, and optimize your schedule.
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
                    className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-surface-hover rounded-xl mr-8"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-[#A855F7]" />
                    <span className="text-sm text-slate-600 dark:text-text-tertiary">
                      Thinking...
                    </span>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Action Confirmation Panel */}
          <AnimatePresence>
            <ActionConfirmationPanel />
          </AnimatePresence>

          {/* Quick Actions */}
          {messages.length === 0 && (
            <QuickActions onSelect={handleQuickAction} />
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-slate-200 dark:border-border-subtle bg-slate-50 dark:bg-surface-hover"
          >
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything or tell me what to do..."
                disabled={state.isProcessing}
                className="flex-1 h-11 text-sm bg-white dark:bg-surface"
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || state.isProcessing}
                className="h-11 w-11 p-0 bg-[#A855F7] hover:bg-[#9333EA]"
              >
                {state.isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-text-tertiary mt-2 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-surface rounded text-slate-600 dark:text-text-secondary font-mono">
                ⌘K
              </kbd>{" "}
              to toggle • I can execute actions for you
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
                className="absolute bottom-20 left-4 right-4 p-3 bg-red-50 dark:bg-critical/10 border border-red-200 dark:border-critical/30 rounded-xl"
              >
                <div className="flex items-center gap-2 text-sm text-red-700 dark:text-critical">
                  <AlertTriangle className="h-4 w-4" />
                  {state.lastError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
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
  const notificationCount = state.notifications.filter(
    (n) => !n.dismissed,
  ).length;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={togglePanel}
      className={cn(
        "fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg z-50",
        "bg-gradient-to-br from-[#A855F7] to-primary",
        "flex items-center justify-center",
        "hover:from-[#9333EA] hover:to-primary-hover",
        "transition-all duration-150",
        state.isOpen && "opacity-0 pointer-events-none",
      )}
    >
      <Sparkles className="h-7 w-7 text-white" />

      {/* Notification badge */}
      {(hasWarnings || criticalCount > 0 || notificationCount > 0) && (
        <div
          className={cn(
            "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
            criticalCount > 0
              ? "bg-critical text-white"
              : "bg-warning text-black",
          )}
        >
          {criticalCount > 0
            ? criticalCount
            : notificationCount > 0
              ? notificationCount
              : "!"}
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
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePanel}
      className="gap-2 h-10"
    >
      <Sparkles
        className={cn(
          "h-5 w-5",
          healthScore >= 70
            ? "text-[#A855F7]"
            : healthScore >= 40
              ? "text-warning"
              : "text-critical",
        )}
      />
      <span className="hidden sm:inline text-slate-600 dark:text-text-secondary font-medium">
        Assistant
      </span>
      <Badge
        variant={
          healthScore >= 70
            ? "success"
            : healthScore >= 40
              ? "warning"
              : "error"
        }
        size="default"
      >
        {healthScore}%
      </Badge>
    </Button>
  );
}
