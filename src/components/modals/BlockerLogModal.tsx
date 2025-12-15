import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import type {
  IA,
  Blocker,
  BlockerCategory,
  BlockerSeverity,
  BlockerTemplate,
} from "../../types";
import { BLOCKER_TEMPLATES } from "../../types";
import {
  createBlocker,
  getCategoryLabel,
  getSeverityColor,
} from "../../services/blocker";
import { cn } from "../../lib/utils";
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Lightbulb,
  Zap,
  Check,
} from "lucide-react";
import { format, addDays } from "date-fns";

interface BlockerLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ias: IA[];
  onSaveBlocker: (blocker: Blocker) => void;
  // Pre-selected context (optional)
  preSelectedIaId?: string;
  preSelectedMilestoneId?: string;
}

const CATEGORY_OPTIONS: {
  value: BlockerCategory;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "resource",
    label: "Resource Unavailable",
    icon: <AlertCircle className="h-4 w-4" />,
  },
  {
    value: "approval",
    label: "Waiting for Approval",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "external_dependency",
    label: "External Dependency",
    icon: <User className="h-4 w-4" />,
  },
  {
    value: "knowledge_gap",
    label: "Knowledge Gap",
    icon: <Lightbulb className="h-4 w-4" />,
  },
  {
    value: "technical_issue",
    label: "Technical Issue",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    value: "health_personal",
    label: "Health/Personal",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
];

const SEVERITY_OPTIONS: {
  value: BlockerSeverity;
  label: string;
  description: string;
}[] = [
  {
    value: "low",
    label: "Low",
    description: "Minor inconvenience, can work around",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Slows progress, needs attention",
  },
  {
    value: "high",
    label: "High",
    description: "Significant delay, priority to resolve",
  },
  {
    value: "critical",
    label: "Critical",
    description: "Complete stop, immediate action needed",
  },
];

export function BlockerLogModal({
  open,
  onOpenChange,
  ias,
  onSaveBlocker,
  preSelectedIaId,
  preSelectedMilestoneId,
}: BlockerLogModalProps) {
  // Form state
  const [selectedIaId, setSelectedIaId] = useState(preSelectedIaId || "");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(
    preSelectedMilestoneId || "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BlockerCategory>("resource");
  const [severity, setSeverity] = useState<BlockerSeverity>("medium");
  const [estimatedDelayDays, setEstimatedDelayDays] = useState("1");
  const [expectedResolutionDate, setExpectedResolutionDate] = useState(
    format(addDays(new Date(), 3), "yyyy-MM-dd"),
  );
  const [waitingOn, setWaitingOn] = useState("");

  // UI state
  const [showTemplates, setShowTemplates] = useState(true);
  const [showWorkarounds, setShowWorkarounds] = useState(false);

  // Get milestones for selected IA
  const selectedIa = ias.find((ia) => ia.id === selectedIaId);
  const availableMilestones =
    selectedIa?.milestones.filter((m) => !m.completed) || [];

  // Get workaround suggestions based on category
  const workarounds = useMemo(() => {
    // Find a template matching the category for workaround suggestions
    const template = BLOCKER_TEMPLATES.find((t) => t.category === category);
    return template?.suggestedWorkarounds || [];
  }, [category]);

  // Reset form when modal opens/closes
  const resetForm = () => {
    setSelectedIaId(preSelectedIaId || "");
    setSelectedMilestoneId(preSelectedMilestoneId || "");
    setTitle("");
    setDescription("");
    setCategory("resource");
    setSeverity("medium");
    setEstimatedDelayDays("1");
    setExpectedResolutionDate(format(addDays(new Date(), 3), "yyyy-MM-dd"));
    setWaitingOn("");
    setShowTemplates(true);
    setShowWorkarounds(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  // Apply template
  const handleApplyTemplate = (template: BlockerTemplate) => {
    setTitle(template.title);
    setDescription(template.description);
    setCategory(template.category);
    setSeverity(template.defaultSeverity);
    setEstimatedDelayDays(template.estimatedResolutionDays.toString());
    setExpectedResolutionDate(
      format(
        addDays(new Date(), template.estimatedResolutionDays),
        "yyyy-MM-dd",
      ),
    );
    setShowTemplates(false);
  };

  // Validate form
  const isValid =
    selectedIaId &&
    selectedMilestoneId &&
    title.trim() &&
    description.trim() &&
    parseInt(estimatedDelayDays) > 0;

  // Save blocker
  const handleSave = () => {
    if (!isValid) return;

    const blocker = createBlocker(
      selectedMilestoneId,
      selectedIaId,
      title.trim(),
      description.trim(),
      category,
      severity,
      parseInt(estimatedDelayDays),
      expectedResolutionDate || undefined,
      waitingOn.trim() || undefined,
    );

    onSaveBlocker(blocker);
    handleOpenChange(false);
  };

  const getSeverityIcon = (sev: BlockerSeverity) => {
    switch (sev) {
      case "critical":
        return <AlertOctagon className="h-4 w-4" />;
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <AlertCircle className="h-4 w-4" />;
      case "low":
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Log a Blocker
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Record what's blocking your progress so we can track and help you
            resolve it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Templates */}
          <AnimatePresence>
            {showTemplates && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-300">
                    Quick Templates
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTemplates(false)}
                    className="h-6 text-xs"
                  >
                    Skip
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BLOCKER_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleApplyTemplate(template)}
                      className={cn(
                        "p-3 text-left rounded-lg border transition-all",
                        "bg-slate-800/50 border-slate-700 hover:border-slate-600",
                        "hover:bg-slate-800",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full mt-1.5 shrink-0",
                            getSeverityColor(
                              template.defaultSeverity,
                            ).bg.replace("/20", ""),
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            {template.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {getCategoryLabel(template.category)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* IA & Milestone Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Select IA <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedIaId}
                onChange={(e) => {
                  setSelectedIaId(e.target.value);
                  setSelectedMilestoneId("");
                }}
                className={cn(
                  "w-full h-10 px-3 rounded-md text-sm",
                  "bg-slate-800 border border-slate-700 text-slate-200",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                )}
              >
                <option value="">Choose an IA...</option>
                {ias.map((ia) => (
                  <option key={ia.id} value={ia.id}>
                    {ia.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Select Milestone <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedMilestoneId}
                onChange={(e) => setSelectedMilestoneId(e.target.value)}
                disabled={!selectedIaId}
                className={cn(
                  "w-full h-10 px-3 rounded-md text-sm",
                  "bg-slate-800 border border-slate-700 text-slate-200",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                <option value="">Choose a milestone...</option>
                {availableMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.milestone_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Blocker Title <span className="text-red-400">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of what's blocking you"
              className="bg-slate-800 border-slate-700"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Details <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the blocker in detail. What specifically is preventing progress?"
              rows={3}
              className={cn(
                "w-full px-3 py-2 rounded-md text-sm resize-none",
                "bg-slate-800 border border-slate-700 text-slate-200",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                "placeholder:text-slate-500",
              )}
            />
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCategory(opt.value)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-all text-sm",
                    category === opt.value
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                      : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600",
                  )}
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Severity
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITY_OPTIONS.map((opt) => {
                const colors = getSeverityColor(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                      severity === opt.value
                        ? `${colors.bg} ${colors.border} ${colors.text}`
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600",
                    )}
                  >
                    {getSeverityIcon(opt.value)}
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {SEVERITY_OPTIONS.find((o) => o.value === severity)?.description}
            </p>
          </div>

          {/* Impact & Timeline */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Estimated Delay (days)
              </label>
              <Input
                type="number"
                min="1"
                value={estimatedDelayDays}
                onChange={(e) => setEstimatedDelayDays(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Expected Resolution Date
              </label>
              <Input
                type="date"
                value={expectedResolutionDate}
                onChange={(e) => setExpectedResolutionDate(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>

          {/* External Dependency - Who are you waiting on */}
          {(category === "external_dependency" || category === "approval") && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Who/What are you waiting on?
              </label>
              <Input
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                placeholder="e.g., Teacher name, Library, Lab technician..."
                className="bg-slate-800 border-slate-700"
              />
              <p className="text-xs text-slate-500">
                We'll help you track follow-ups with this person/resource.
              </p>
            </div>
          )}

          {/* Workaround Suggestions */}
          {workarounds.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowWorkarounds(!showWorkarounds)}
                className="flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300"
              >
                <Lightbulb className="h-4 w-4" />
                {showWorkarounds ? "Hide" : "Show"} Workaround Suggestions
                {showWorkarounds ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              <AnimatePresence>
                {showWorkarounds && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    {workarounds.map((workaround, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
                      >
                        <Check className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-200">{workaround}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid} className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Log Blocker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
