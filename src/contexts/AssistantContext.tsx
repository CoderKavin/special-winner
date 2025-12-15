/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import type {
  AppState,
  AssistantState,
  AssistantPreferences,
  Conversation,
  ConversationMessage,
  CurrentViewContext,
  ContextSnapshot,
  ActionPreview,
  ProactiveNotification,
  ExecutedAction,
} from "../types";

// Re-import the function since it's not a type
import { buildContextSnapshot as buildContext } from "../types/assistant";
import { DEFAULT_ASSISTANT_PREFERENCES as defaultPrefs } from "../types/assistant";
import {
  sendToGemini,
  generateProactiveSuggestions,
  type AIAction,
  type AIResponse,
  type GeminiMessage,
} from "../services/geminiAssistant";
import {
  executeAIActions,
  generateActionPreview,
  type StateUpdaters,
} from "../services/aiActionExecutor";

// ============================================
// STATE & ACTIONS
// ============================================

type AssistantAction =
  | { type: "OPEN_PANEL" }
  | { type: "CLOSE_PANEL" }
  | { type: "TOGGLE_PANEL" }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | undefined }
  | { type: "START_CONVERSATION"; payload: CurrentViewContext }
  | { type: "ADD_MESSAGE"; payload: ConversationMessage }
  | { type: "UPDATE_LAST_MESSAGE"; payload: Partial<ConversationMessage> }
  | { type: "SET_PENDING_ACTIONS"; payload: ActionPreview[] }
  | { type: "CLEAR_PENDING_ACTIONS" }
  | { type: "EXECUTE_ACTION"; payload: ExecutedAction }
  | { type: "ADD_NOTIFICATION"; payload: ProactiveNotification }
  | { type: "DISMISS_NOTIFICATION"; payload: string }
  | { type: "CLEAR_NOTIFICATIONS" }
  | { type: "UPDATE_PREFERENCES"; payload: Partial<AssistantPreferences> }
  | { type: "CLEAR_CONVERSATION" }
  | {
      type: "SET_AWAITING_CONFIRMATION";
      payload: { actions: AIAction[]; response: AIResponse } | null;
    };

interface ExtendedAssistantState extends AssistantState {
  awaitingConfirmation: { actions: AIAction[]; response: AIResponse } | null;
  conversationHistory: GeminiMessage[];
}

const initialState: ExtendedAssistantState = {
  isOpen: false,
  conversation: null,
  pendingActions: [],
  notifications: [],
  isProcessing: false,
  lastError: undefined,
  preferences: defaultPrefs,
  awaitingConfirmation: null,
  conversationHistory: [],
};

function assistantReducer(
  state: ExtendedAssistantState,
  action: AssistantAction,
): ExtendedAssistantState {
  switch (action.type) {
    case "OPEN_PANEL":
      return { ...state, isOpen: true };

    case "CLOSE_PANEL":
      return { ...state, isOpen: false };

    case "TOGGLE_PANEL":
      return { ...state, isOpen: !state.isOpen };

    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };

    case "SET_ERROR":
      return { ...state, lastError: action.payload };

    case "START_CONVERSATION": {
      const now = new Date().toISOString();
      const newConversation: Conversation = {
        id: crypto.randomUUID(),
        messages: [],
        startedAt: now,
        lastMessageAt: now,
        startContext: action.payload,
      };
      return {
        ...state,
        conversation: newConversation,
        conversationHistory: [],
      };
    }

    case "ADD_MESSAGE": {
      if (!state.conversation) return state;

      // Also update conversation history for Gemini
      const newHistory = [...state.conversationHistory];
      if (action.payload.role === "user") {
        newHistory.push({
          role: "user",
          parts: [{ text: action.payload.content }],
        });
      } else if (action.payload.role === "assistant") {
        newHistory.push({
          role: "model",
          parts: [{ text: action.payload.content }],
        });
      }

      // Keep history limited
      const trimmedHistory = newHistory.slice(-20);

      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload],
          lastMessageAt: action.payload.timestamp,
        },
        conversationHistory: trimmedHistory,
      };
    }

    case "UPDATE_LAST_MESSAGE": {
      if (!state.conversation || state.conversation.messages.length === 0)
        return state;
      const messages = [...state.conversation.messages];
      const lastIndex = messages.length - 1;
      messages[lastIndex] = { ...messages[lastIndex], ...action.payload };
      return {
        ...state,
        conversation: { ...state.conversation, messages },
      };
    }

    case "SET_PENDING_ACTIONS":
      return { ...state, pendingActions: action.payload };

    case "CLEAR_PENDING_ACTIONS":
      return { ...state, pendingActions: [], awaitingConfirmation: null };

    case "SET_AWAITING_CONFIRMATION":
      return { ...state, awaitingConfirmation: action.payload };

    case "EXECUTE_ACTION": {
      if (!state.conversation) return state;
      // Add the executed action to the last assistant message
      const messages = [...state.conversation.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        messages[messages.length - 1] = {
          ...lastMessage,
          actions: [...(lastMessage.actions || []), action.payload],
        };
      }
      return {
        ...state,
        conversation: { ...state.conversation, messages },
        pendingActions: state.pendingActions.filter(
          (a) => a.action.type !== action.payload.payload.type,
        ),
        awaitingConfirmation: null,
      };
    }

    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };

    case "DISMISS_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload
            ? { ...n, dismissed: true, dismissedAt: new Date().toISOString() }
            : n,
        ),
      };

    case "CLEAR_NOTIFICATIONS":
      return { ...state, notifications: [] };

    case "UPDATE_PREFERENCES":
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      };

    case "CLEAR_CONVERSATION":
      return {
        ...state,
        conversation: null,
        pendingActions: [],
        awaitingConfirmation: null,
        conversationHistory: [],
      };

    default:
      return state;
  }
}

// ============================================
// CONTEXT DEFINITION
// ============================================

interface AssistantContextValue {
  // State
  state: ExtendedAssistantState;
  // Current app context
  appState: AppState | null;
  currentView: CurrentViewContext;
  contextSnapshot: ContextSnapshot | null;

  // Panel controls
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  // Conversation
  startConversation: () => void;
  clearConversation: () => void;
  sendMessage: (content: string) => Promise<void>;

  // Actions
  confirmPendingActions: () => Promise<void>;
  cancelPendingActions: () => void;

  // Notifications
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  checkProactiveSuggestions: () => void;

  // Preferences
  updatePreferences: (prefs: Partial<AssistantPreferences>) => void;

  // Context updates (called by App when state changes)
  updateAppState: (state: AppState) => void;
  updateCurrentView: (view: CurrentViewContext) => void;

  // State updaters for action execution
  setStateUpdaters: (updaters: StateUpdaters) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

// ============================================
// PROVIDER COMPONENT
// ============================================

interface AssistantProviderProps {
  children: ReactNode;
  initialAppState: AppState;
  initialView?: CurrentViewContext;
  stateUpdaters?: StateUpdaters;
}

export function AssistantProvider({
  children,
  initialAppState,
  initialView = { view: "dashboard" },
  stateUpdaters: initialStateUpdaters,
}: AssistantProviderProps) {
  const [state, dispatch] = useReducer(assistantReducer, initialState);
  const [appState, setAppState] = React.useState<AppState>(initialAppState);
  const [currentView, setCurrentView] =
    React.useState<CurrentViewContext>(initialView);
  const [stateUpdaters, setStateUpdatersInternal] =
    React.useState<StateUpdaters | null>(initialStateUpdaters || null);

  // Sync appState when initialAppState changes from parent
  useEffect(() => {
    setAppState(initialAppState);
  }, [initialAppState]);

  // Sync currentView when initialView changes from parent
  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  // Build context snapshot whenever app state or view changes
  const contextSnapshot = useMemo(() => {
    return buildContext({
      state: appState,
      currentView,
    });
  }, [appState, currentView]);

  // Panel controls
  const openPanel = useCallback(() => {
    dispatch({ type: "OPEN_PANEL" });
    if (!state.conversation) {
      dispatch({ type: "START_CONVERSATION", payload: currentView });
    }
  }, [state.conversation, currentView]);

  const closePanel = useCallback(() => {
    dispatch({ type: "CLOSE_PANEL" });
  }, []);

  const togglePanel = useCallback(() => {
    if (!state.isOpen && !state.conversation) {
      dispatch({ type: "START_CONVERSATION", payload: currentView });
    }
    dispatch({ type: "TOGGLE_PANEL" });
  }, [state.isOpen, state.conversation, currentView]);

  // Conversation controls
  const startConversation = useCallback(() => {
    dispatch({ type: "START_CONVERSATION", payload: currentView });
  }, [currentView]);

  const clearConversation = useCallback(() => {
    dispatch({ type: "CLEAR_CONVERSATION" });
  }, []);

  // Send a message to the assistant
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Add user message
      const userMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });
      dispatch({ type: "SET_PROCESSING", payload: true });
      dispatch({ type: "SET_ERROR", payload: undefined });

      try {
        // Get current view name
        const viewName =
          currentView.view === "ia_detail" && currentView.focusedIAId
            ? `IA Detail: ${appState.ias.find((ia) => ia.id === currentView.focusedIAId)?.name || currentView.focusedIAId}`
            : currentView.view;

        // Send to Gemini with full context
        const aiResponse = await sendToGemini(
          content.trim(),
          state.conversationHistory,
          appState,
          viewName,
        );

        // Create assistant message
        const assistantMessage: ConversationMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: aiResponse.response,
          timestamp: new Date().toISOString(),
          contextUsed: contextSnapshot || undefined,
        };
        dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });

        // Handle actions if present
        if (aiResponse.actions && aiResponse.actions.length > 0) {
          if (aiResponse.needsConfirmation) {
            // Store actions for confirmation
            dispatch({
              type: "SET_AWAITING_CONFIRMATION",
              payload: { actions: aiResponse.actions, response: aiResponse },
            });

            // Build preview for pending actions
            const previews: ActionPreview[] = aiResponse.actions.map(
              (action) => {
                const preview = generateActionPreview(action, appState);
                return {
                  action: {
                    type: action.type as ActionPreview["action"]["type"],
                    iaId: action.params.iaId as string | undefined,
                    milestoneId: action.params.milestoneId as
                      | string
                      | undefined,
                    blockerId: action.params.blockerId as string | undefined,
                    data: action.params,
                  },
                  description: preview.description,
                  changes: preview.changes.map((_c) => ({
                    entityType: "milestone" as const,
                    entityId: (action.params.milestoneId as string) || "",
                    entityName: preview.description,
                    field: "status",
                    oldValue: "pending",
                    newValue: "complete",
                  })),
                  warnings: preview.warnings,
                  reversible: true,
                };
              },
            );
            dispatch({ type: "SET_PENDING_ACTIONS", payload: previews });
          } else {
            // Execute actions immediately
            if (stateUpdaters) {
              const results = await executeAIActions(
                aiResponse.actions,
                appState,
                stateUpdaters,
              );

              // Add execution results to the message
              const executedActions: ExecutedAction[] = results.map(
                (result, index) => ({
                  id: crypto.randomUUID(),
                  payload: {
                    type: aiResponse.actions![index]
                      .type as ExecutedAction["payload"]["type"],
                    data: aiResponse.actions![index].params,
                  },
                  executedAt: new Date().toISOString(),
                  success: result.success,
                  error: result.error,
                  changes:
                    result.changes?.map((c) => ({
                      entityType: "milestone" as const,
                      entityId: "",
                      entityName: c,
                      field: "status",
                      oldValue: "",
                      newValue: "",
                    })) || [],
                }),
              );

              // Update the last message with executed actions
              dispatch({
                type: "UPDATE_LAST_MESSAGE",
                payload: { actions: executedActions },
              });

              // Add confirmation message if actions were executed
              const successCount = results.filter((r) => r.success).length;
              if (successCount > 0) {
                const confirmMessage: ConversationMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content:
                    successCount === results.length
                      ? "Done!"
                      : `Completed ${successCount}/${results.length} actions.`,
                  timestamp: new Date().toISOString(),
                };
                dispatch({ type: "ADD_MESSAGE", payload: confirmMessage });
              }
            }
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred";
        dispatch({ type: "SET_ERROR", payload: errorMessage });

        // Add error message to conversation
        const errorResponse: ConversationMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `I encountered an error: ${errorMessage}. Please try again.`,
          timestamp: new Date().toISOString(),
        };
        dispatch({ type: "ADD_MESSAGE", payload: errorResponse });
      } finally {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    },
    [
      contextSnapshot,
      appState,
      state.conversationHistory,
      currentView,
      stateUpdaters,
    ],
  );

  // Confirm pending actions
  const confirmPendingActions = useCallback(async () => {
    if (!state.awaitingConfirmation || !stateUpdaters) return;

    dispatch({ type: "SET_PROCESSING", payload: true });

    try {
      const results = await executeAIActions(
        state.awaitingConfirmation.actions,
        appState,
        stateUpdaters,
      );

      // Add execution results
      const allSuccess = results.every((r) => r.success);
      const successCount = results.filter((r) => r.success).length;

      // Create executed actions for the message
      const executedActions: ExecutedAction[] = results.map(
        (result, index) => ({
          id: crypto.randomUUID(),
          payload: {
            type: state.awaitingConfirmation!.actions[index]
              .type as ExecutedAction["payload"]["type"],
            data: state.awaitingConfirmation!.actions[index].params,
          },
          executedAt: new Date().toISOString(),
          success: result.success,
          error: result.error,
          changes:
            result.changes?.map((c) => ({
              entityType: "milestone" as const,
              entityId: "",
              entityName: c,
              field: "status",
              oldValue: "",
              newValue: "",
            })) || [],
        }),
      );

      // Update the last message with executed actions
      dispatch({
        type: "UPDATE_LAST_MESSAGE",
        payload: { actions: executedActions },
      });

      // Add confirmation message
      const confirmMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: allSuccess
          ? `Done! ${results.map((r) => r.message).join(". ")}`
          : `Completed ${successCount}/${results.length} actions. ${results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join(". ")}`,
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: confirmMessage });
      dispatch({ type: "CLEAR_PENDING_ACTIONS" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Action failed";
      dispatch({ type: "SET_ERROR", payload: errorMessage });

      const errorResponse: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to execute actions: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: errorResponse });
    } finally {
      dispatch({ type: "SET_PROCESSING", payload: false });
    }
  }, [state.awaitingConfirmation, appState, stateUpdaters]);

  // Cancel pending actions
  const cancelPendingActions = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING_ACTIONS" });

    const cancelMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Action cancelled.",
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: cancelMessage });
  }, []);

  // Notification controls
  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: "DISMISS_NOTIFICATION", payload: id });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: "CLEAR_NOTIFICATIONS" });
  }, []);

  // Check for proactive suggestions
  const checkProactiveSuggestions = useCallback(() => {
    const suggestions = generateProactiveSuggestions(appState);

    suggestions.forEach((suggestion) => {
      const notification: ProactiveNotification = {
        id: suggestion.id,
        type:
          suggestion.type === "warning"
            ? "schedule_conflict"
            : suggestion.type === "reminder"
              ? "deadline_approaching"
              : "workload_imbalance",
        title: suggestion.title,
        message: suggestion.message,
        priority: suggestion.priority,
        createdAt: new Date().toISOString(),
        suggestedAction: suggestion.suggestedAction
          ? {
              type: "navigate_to_view",
              data: { message: suggestion.suggestedAction },
            }
          : undefined,
        suggestedActionLabel: suggestion.quickActions?.[0]?.label,
        dismissed: false,
      };

      // Only add if not already present
      if (!state.notifications.some((n) => n.id === notification.id)) {
        dispatch({ type: "ADD_NOTIFICATION", payload: notification });
      }
    });
  }, [appState, state.notifications]);

  // Preferences
  const updatePreferences = useCallback(
    (prefs: Partial<AssistantPreferences>) => {
      dispatch({ type: "UPDATE_PREFERENCES", payload: prefs });
    },
    [],
  );

  // Context updates from parent
  const updateAppState = useCallback((newState: AppState) => {
    setAppState(newState);
  }, []);

  const updateCurrentView = useCallback((view: CurrentViewContext) => {
    setCurrentView(view);
  }, []);

  // Set state updaters
  const setStateUpdaters = useCallback((updaters: StateUpdaters) => {
    setStateUpdatersInternal(updaters);
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle panel
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        togglePanel();
      }
      // Escape to close panel
      if (e.key === "Escape" && state.isOpen) {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePanel, closePanel, state.isOpen]);

  // Check for proactive suggestions periodically
  useEffect(() => {
    if (state.preferences.enableProactiveAssistance) {
      checkProactiveSuggestions();
    }
  }, [
    appState,
    state.preferences.enableProactiveAssistance,
    checkProactiveSuggestions,
  ]);

  const value: AssistantContextValue = {
    state,
    appState,
    currentView,
    contextSnapshot,
    openPanel,
    closePanel,
    togglePanel,
    startConversation,
    clearConversation,
    sendMessage,
    confirmPendingActions,
    cancelPendingActions,
    dismissNotification,
    clearNotifications,
    checkProactiveSuggestions,
    updatePreferences,
    updateAppState,
    updateCurrentView,
    setStateUpdaters,
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistant must be used within an AssistantProvider");
  }
  return context;
}
