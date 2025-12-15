import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { Blocker, IA } from "../../types";
import {
  resolveBlocker,
  getCategoryLabel,
  getSeverityColor,
} from "../../services/blocker";
import { cn } from "../../lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

interface BlockerResolveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocker: Blocker | null;
  ias: IA[];
  onResolve: (resolvedBlocker: Blocker) => void;
}

export function BlockerResolveModal({
  open,
  onOpenChange,
  blocker,
  ias,
  onResolve,
}: BlockerResolveModalProps) {
  const [actualDelayDays, setActualDelayDays] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [workaroundApplied, setWorkaroundApplied] = useState("");

  if (!blocker) return null;

  // Get IA and milestone info
  const ia = ias.find((i) => i.id === blocker.iaId);
  const milestone = ia?.milestones.find((m) => m.id === blocker.milestoneId);

  // Calculate actual delay if not provided
  const calculateActualDelay = () => {
    const start = parseISO(blocker.createdAt);
    const now = new Date();
    return differenceInDays(now, start);
  };

  const handleResolve = () => {
    const resolved = resolveBlocker(
      blocker,
      resolutionNotes.trim() || "Resolved",
      lessonsLearned.trim() || undefined,
      workaroundApplied.trim() || undefined,
    );

    // Override actual delay if user specified one
    if (actualDelayDays) {
      resolved.actualDelayDays = parseInt(actualDelayDays);
    }

    onResolve(resolved);
    onOpenChange(false);

    // Reset form
    setActualDelayDays("");
    setResolutionNotes("");
    setLessonsLearned("");
    setWorkaroundApplied("");
  };

  const estimatedDelay = blocker.estimatedDelayDays;
  const currentDelay = calculateActualDelay();
  const enteredDelay = actualDelayDays
    ? parseInt(actualDelayDays)
    : currentDelay;
  const delayDifference = enteredDelay - estimatedDelay;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            Resolve Blocker
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Great job! Let's record the resolution details for future learning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Blocker Summary */}
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-2 h-2 rounded-full mt-2",
                  getSeverityColor(blocker.severity).bg.replace("/20", ""),
                )}
              />
              <div className="flex-1">
                <h3 className="font-medium text-slate-200">{blocker.title}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {ia?.name} → {milestone?.milestone_name}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>{getCategoryLabel(blocker.category)}</span>
                  <span>•</span>
                  <span>
                    Created {format(parseISO(blocker.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delay Comparison */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">
              Actual Days Delayed
            </label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min="0"
                value={actualDelayDays}
                onChange={(e) => setActualDelayDays(e.target.value)}
                placeholder={currentDelay.toString()}
                className="w-24 bg-slate-800 border-slate-700"
              />
              <span className="text-sm text-slate-400">days</span>
            </div>

            {/* Delay comparison indicator */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-sm",
                delayDifference > 0
                  ? "bg-orange-500/10 text-orange-400"
                  : delayDifference < 0
                    ? "bg-green-500/10 text-green-400"
                    : "bg-slate-800 text-slate-400",
              )}
            >
              {delayDifference > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4" />
                  <span>
                    {delayDifference} day{delayDifference !== 1 ? "s" : ""} more
                    than estimated ({estimatedDelay}d)
                  </span>
                </>
              ) : delayDifference < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4" />
                  <span>
                    {Math.abs(delayDifference)} day
                    {Math.abs(delayDifference) !== 1 ? "s" : ""} less than
                    estimated ({estimatedDelay}d)
                  </span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Matched your estimate of {estimatedDelay} days</span>
                </>
              )}
            </motion.div>
          </div>

          {/* Resolution Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              How was it resolved?
            </label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Describe what you did to resolve this blocker..."
              rows={2}
              className={cn(
                "w-full px-3 py-2 rounded-md text-sm resize-none",
                "bg-slate-800 border border-slate-700 text-slate-200",
                "focus:outline-none focus:ring-2 focus:ring-green-500/50",
                "placeholder:text-slate-500",
              )}
            />
          </div>

          {/* Workaround Applied */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Workaround Applied (optional)
            </label>
            <Input
              value={workaroundApplied}
              onChange={(e) => setWorkaroundApplied(e.target.value)}
              placeholder="Did you apply any workaround?"
              className="bg-slate-800 border-slate-700"
            />
          </div>

          {/* Lessons Learned */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Lessons Learned (optional)
            </label>
            <textarea
              value={lessonsLearned}
              onChange={(e) => setLessonsLearned(e.target.value)}
              placeholder="What would you do differently next time? How can you prevent this in the future?"
              rows={2}
              className={cn(
                "w-full px-3 py-2 rounded-md text-sm resize-none",
                "bg-slate-800 border border-slate-700 text-slate-200",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                "placeholder:text-slate-500",
              )}
            />
            <p className="text-xs text-slate-500">
              Recording lessons helps improve future estimates and prevent
              similar blockers.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark as Resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
