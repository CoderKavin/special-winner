import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { ActiveTimer, Milestone } from "../../types";
import { cn } from "../../lib/utils";
import { Play, Pause, Square, X, Timer as TimerIcon } from "lucide-react";

interface TimerProps {
  activeTimer: ActiveTimer | null;
  milestone?: Milestone;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: (note?: string) => void;
  onCancel: () => void;
  compact?: boolean;
}

export function Timer({
  activeTimer,
  milestone,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
  compact = false,
}: TimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stopNote, setStopNote] = useState("");
  const [showStopDialog, setShowStopDialog] = useState(false);

  const isRunning = activeTimer && !activeTimer.pausedAt;
  const isPaused = activeTimer && activeTimer.pausedAt;
  const isActive = !!activeTimer;

  // Calculate elapsed time
  useEffect(() => {
    if (!activeTimer) {
      // Use RAF to avoid synchronous setState during render
      const rafId = requestAnimationFrame(() => setElapsedSeconds(0));
      return () => cancelAnimationFrame(rafId);
    }

    const calculateElapsed = () => {
      let seconds = activeTimer.accumulatedMinutes * 60;

      if (!activeTimer.pausedAt) {
        const startTime = new Date(activeTimer.startTime).getTime();
        const now = Date.now();
        seconds += (now - startTime) / 1000;
      }

      setElapsedSeconds(Math.floor(seconds));
    };

    // Use RAF for initial calculation to avoid synchronous setState during render
    const rafId = requestAnimationFrame(calculateElapsed);

    if (isRunning) {
      const interval = setInterval(calculateElapsed, 1000);
      return () => {
        cancelAnimationFrame(rafId);
        clearInterval(interval);
      };
    }

    return () => cancelAnimationFrame(rafId);
  }, [activeTimer, isRunning]);

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const handleStop = () => {
    onStop(stopNote || undefined);
    setStopNote("");
    setShowStopDialog(false);
  };

  // Compact display for dashboard/header
  if (compact && isActive) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 border border-primary/30 rounded-lg"
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isRunning ? "bg-success animate-pulse" : "bg-warning",
          )}
        />
        <span className="text-body-sm font-mono font-medium text-primary">
          {formatTime(elapsedSeconds)}
        </span>
        <span className="text-caption text-text-tertiary truncate max-w-[120px]">
          {milestone?.milestone_name}
        </span>
        <div className="flex items-center gap-1">
          {isRunning ? (
            <Button size="icon-sm" variant="ghost" onClick={onPause}>
              <Pause className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="icon-sm" variant="ghost" onClick={onResume}>
              <Play className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-critical hover:text-critical"
            onClick={() => setShowStopDialog(true)}
          >
            <Square className="h-3 w-3" />
          </Button>
        </div>

        {/* Stop dialog overlay */}
        <AnimatePresence>
          {showStopDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
              onClick={() => setShowStopDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="bg-surface border border-border rounded-lg p-4 w-80 shadow-3"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-body font-medium text-text-primary mb-3">
                  Stop Timer
                </h3>
                <p className="text-caption text-text-tertiary mb-3">
                  Logging {formatTime(elapsedSeconds)} for{" "}
                  {milestone?.milestone_name}
                </p>
                <Input
                  placeholder="Add a note (optional)"
                  value={stopNote}
                  onChange={(e) => setStopNote(e.target.value)}
                  className="mb-3"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleStop} className="flex-1">
                    Save & Stop
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowStopDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Full timer display
  return (
    <div className="space-y-3">
      {/* Timer display */}
      <div
        className={cn(
          "flex items-center justify-center gap-4 p-4 rounded-lg transition-all duration-normal",
          isActive
            ? isRunning
              ? "bg-success/10 border border-success/30"
              : "bg-warning/10 border border-warning/30"
            : "bg-surface-hover border border-border-subtle",
        )}
      >
        <TimerIcon
          className={cn(
            "h-6 w-6",
            isRunning
              ? "text-success"
              : isPaused
                ? "text-warning"
                : "text-text-tertiary",
          )}
        />
        <span
          className={cn(
            "text-display font-mono font-bold",
            isRunning
              ? "text-success"
              : isPaused
                ? "text-warning"
                : "text-text-secondary",
          )}
        >
          {formatTime(elapsedSeconds)}
        </span>
        {isRunning && (
          <span className="text-caption text-success animate-pulse">
            Recording...
          </span>
        )}
        {isPaused && <span className="text-caption text-warning">Paused</span>}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {!isActive ? (
          <Button onClick={onStart} className="gap-2">
            <Play className="h-4 w-4" />
            Start Timer
          </Button>
        ) : (
          <>
            {isRunning ? (
              <Button onClick={onPause} variant="secondary" className="gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            ) : (
              <Button onClick={onResume} className="gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}

            <Button
              onClick={() => setShowStopDialog(true)}
              variant="success"
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Stop & Log
            </Button>

            <Button
              onClick={onCancel}
              variant="ghost"
              className="gap-2 text-critical hover:text-critical"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Stop dialog */}
      <AnimatePresence>
        {showStopDialog && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="p-4 bg-surface rounded-lg border border-border"
          >
            <h4 className="text-body font-medium text-text-primary mb-2">
              Log Work Session
            </h4>
            <p className="text-caption text-text-tertiary mb-3">
              You worked for {formatTime(elapsedSeconds)} on this milestone.
            </p>
            <Input
              placeholder="What did you work on? (optional)"
              value={stopNote}
              onChange={(e) => setStopNote(e.target.value)}
              className="mb-3"
            />
            <div className="flex gap-2">
              <Button onClick={handleStop} className="flex-1">
                Save Session
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowStopDialog(false)}
              >
                Keep Timing
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
