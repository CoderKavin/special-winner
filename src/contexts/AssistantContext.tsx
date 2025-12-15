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
import { generateGeminiResponse } from "../services/gemini";

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
  | { type: "SET_PENDING_ACTIONS"; payload: ActionPreview[] }
  | { type: "CLEAR_PENDING_ACTIONS" }
  | { type: "EXECUTE_ACTION"; payload: ExecutedAction }
  | { type: "ADD_NOTIFICATION"; payload: ProactiveNotification }
  | { type: "DISMISS_NOTIFICATION"; payload: string }
  | { type: "CLEAR_NOTIFICATIONS" }
  | { type: "UPDATE_PREFERENCES"; payload: Partial<AssistantPreferences> }
  | { type: "CLEAR_CONVERSATION" };

const initialState: AssistantState = {
  isOpen: false,
  conversation: null,
  pendingActions: [],
  notifications: [],
  isProcessing: false,
  lastError: undefined,
  preferences: defaultPrefs,
};

function assistantReducer(
  state: AssistantState,
  action: AssistantAction,
): AssistantState {
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
      return { ...state, conversation: newConversation };
    }

    case "ADD_MESSAGE": {
      if (!state.conversation) return state;
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload],
          lastMessageAt: action.payload.timestamp,
        },
      };
    }

    case "SET_PENDING_ACTIONS":
      return { ...state, pendingActions: action.payload };

    case "CLEAR_PENDING_ACTIONS":
      return { ...state, pendingActions: [] };

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
      return { ...state, conversation: null, pendingActions: [] };

    default:
      return state;
  }
}

// ============================================
// CONTEXT DEFINITION
// ============================================

interface AssistantContextValue {
  // State
  state: AssistantState;
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
  confirmAction: (actionId: string) => Promise<void>;
  cancelAction: (actionId: string) => void;
  cancelAllActions: () => void;

  // Notifications
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // Preferences
  updatePreferences: (prefs: Partial<AssistantPreferences>) => void;

  // Context updates (called by App when state changes)
  updateAppState: (state: AppState) => void;
  updateCurrentView: (view: CurrentViewContext) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

// ============================================
// PROVIDER COMPONENT
// ============================================

interface AssistantProviderProps {
  children: ReactNode;
  initialAppState: AppState;
  initialView?: CurrentViewContext;
  onExecuteAction?: (action: ActionPreview) => Promise<boolean>;
}

export function AssistantProvider({
  children,
  initialAppState,
  initialView = { view: "dashboard" },
  onExecuteAction,
}: AssistantProviderProps) {
  const [state, dispatch] = useReducer(assistantReducer, initialState);
  const [appState, setAppState] = React.useState<AppState>(initialAppState);
  const [currentView, setCurrentView] =
    React.useState<CurrentViewContext>(initialView);

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
        // Build conversation history for context
        const conversationHistory = (state.conversation?.messages || [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Generate response using Gemini AI
        const responseContent = await generateGeminiResponse(
          content.trim(),
          conversationHistory,
          contextSnapshot,
          appState,
        );

        const assistantMessage: ConversationMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: responseContent,
          timestamp: new Date().toISOString(),
          contextUsed: contextSnapshot || undefined,
        };
        dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });
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
    [contextSnapshot, appState, state.conversation?.messages],
  );

  // Action controls
  const confirmAction = useCallback(
    async (actionId: string) => {
      const action = state.pendingActions.find(
        (a) => a.action.type === actionId,
      );
      if (!action) return;

      dispatch({ type: "SET_PROCESSING", payload: true });

      try {
        const success = onExecuteAction ? await onExecuteAction(action) : false;

        const executedAction: ExecutedAction = {
          id: crypto.randomUUID(),
          payload: action.action,
          executedAt: new Date().toISOString(),
          success,
          changes: action.changes,
        };

        dispatch({ type: "EXECUTE_ACTION", payload: executedAction });

        if (success) {
          // Add confirmation message
          const confirmMessage: ConversationMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Done! ${action.description}`,
            timestamp: new Date().toISOString(),
          };
          dispatch({ type: "ADD_MESSAGE", payload: confirmMessage });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Action failed";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
      } finally {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    },
    [state.pendingActions, onExecuteAction],
  );

  const cancelAction = useCallback(
    (actionId: string) => {
      dispatch({
        type: "SET_PENDING_ACTIONS",
        payload: state.pendingActions.filter((a) => a.action.type !== actionId),
      });
    },
    [state.pendingActions],
  );

  const cancelAllActions = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING_ACTIONS" });
  }, []);

  // Notification controls
  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: "DISMISS_NOTIFICATION", payload: id });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: "CLEAR_NOTIFICATIONS" });
  }, []);

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
    confirmAction,
    cancelAction,
    cancelAllActions,
    dismissNotification,
    clearNotifications,
    updatePreferences,
    updateAppState,
    updateCurrentView,
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
