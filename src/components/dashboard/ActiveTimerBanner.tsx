import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { ActiveTimer, IA } from "../../types";
import { cn } from "../../lib/utils";
import { Play, Pause, Square, X, Timer } from "lucide-react";

interface ActiveTimerBannerProps {
  activeTimer: ActiveTimer;
  ias: IA[];
  onPause: () => void;
  onResume: () => void;
  onStop: (note?: string) => void;
  onCancel: () => void;
}

// Map subject colors to Tailwind classes
const SUBJECT_DOT_COLORS: Record<string, string> = {
  math: "bg-math",
  physics: "bg-physics",
  economics: "bg-economics",
  english: "bg-english",
  history: "bg-history",
};

export function ActiveTimerBanner({
  activeTimer,
  ias,
  onPause,
  onResume,
  onStop,
  onCancel,
}: ActiveTimerBannerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showStopInput, setShowStopInput] = useState(false);
  const [stopNote, setStopNote] = useState("");

  const ia = ias.find((i) => i.id === activeTimer.iaId);
  const milestone = ia?.milestones.find(
    (m) => m.id === activeTimer.milestoneId,
  );
  const subjectDotColor = ia
    ? SUBJECT_DOT_COLORS[ia.subjectColor] || SUBJECT_DOT_COLORS.math
    : "bg-primary";

  const isRunning = !activeTimer.pausedAt;

  // Calculate elapsed time
  useEffect(() => {
    const calculateElapsed = () => {
      let seconds = activeTimer.accumulatedMinutes * 60;

      if (!activeTimer.pausedAt) {
        const startTime = new Date(activeTimer.startTime).getTime();
        const now = Date.now();
        seconds += (now - startTime) / 1000;
      }

      setElapsedSeconds(Math.floor(seconds));
    };

    calculateElapsed();

    if (isRunning) {
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    }
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
    setShowStopInput(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "mb-6 p-4 rounded-lg border",
        "bg-surface",
        isRunning ? "border-success/30" : "border-warning/30",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Timer info */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-lg",
              isRunning ? "bg-success/20" : "bg-warning/20",
            )}
          >
            <Timer
              className={cn(
                "h-6 w-6",
                isRunning ? "text-success" : "text-warning",
              )}
            />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-display font-mono font-bold",
                  isRunning ? "text-success" : "text-warning",
                )}
              >
                {formatTime(elapsedSeconds)}
              </span>
              {isRunning && (
                <span className="text-caption text-success px-2 py-0.5 bg-success/20 rounded animate-pulse">
                  Recording
                </span>
              )}
              {!isRunning && (
                <span className="text-caption text-warning px-2 py-0.5 bg-warning/20 rounded">
                  Paused
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn("w-2 h-2 rounded-full", subjectDotColor)} />
              <span className="text-body-sm text-text-primary">
                {milestone?.milestone_name}
              </span>
              <span className="text-body-sm text-text-tertiary">
                • {ia?.name}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button onClick={onPause} variant="secondary" size="sm">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button onClick={onResume} size="sm">
              <Play className="h-4 w-4" />
              Resume
            </Button>
          )}

          {showStopInput ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Note (optional)"
                value={stopNote}
                onChange={(e) => setStopNote(e.target.value)}
                className="w-40 h-8 text-body-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleStop();
                  if (e.key === "Escape") setShowStopInput(false);
                }}
              />
              <Button onClick={handleStop} size="sm" variant="success">
                Save
              </Button>
              <Button
                onClick={() => setShowStopInput(false)}
                size="sm"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowStopInput(true)}
              size="sm"
              variant="success"
            >
              <Square className="h-4 w-4" />
              Stop & Log
            </Button>
          )}

          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
            className="text-text-tertiary hover:text-critical"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
