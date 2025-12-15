import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import type {
  DeepWorkSettings as DeepWorkSettingsType,
  MilestonePhase,
} from "../../types";
import { DEFAULT_DEEP_WORK_SETTINGS } from "../../types";
import {
  Clock,
  Shuffle,
  Layers,
  Timer,
  Focus,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface DeepWorkSettingsProps {
  settings: DeepWorkSettingsType;
  onUpdate: (settings: DeepWorkSettingsType) => void;
}

const PHASE_LABELS: Record<
  MilestonePhase,
  { label: string; description: string }
> = {
  research: {
    label: "Research",
    description: "Reading, exploring sources, gathering information",
  },
  outline: {
    label: "Outline",
    description: "Structuring, planning, organizing ideas",
  },
  draft: {
    label: "First Draft",
    description: "Writing initial content (requires deep focus)",
  },
  revision: {
    label: "Revision",
    description: "Editing, refining, improving content",
  },
  polish: {
    label: "Polish",
    description: "Formatting, citations, final touches",
  },
};

export function DeepWorkSettings({
  settings,
  onUpdate,
}: DeepWorkSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const handlePhaseHoursChange = (phase: MilestonePhase, hours: number) => {
    const newSettings = {
      ...localSettings,
      minimumSessionHours: {
        ...localSettings.minimumSessionHours,
        [phase]: hours,
      },
    };
    setLocalSettings(newSettings);
    onUpdate(newSettings);
  };

  const handleSettingChange = <K extends keyof DeepWorkSettingsType>(
    key: K,
    value: DeepWorkSettingsType[K],
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onUpdate(newSettings);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_DEEP_WORK_SETTINGS);
    onUpdate(DEFAULT_DEEP_WORK_SETTINGS);
  };

  const handleWindowChange = (
    index: number,
    field: "start" | "end",
    value: number,
  ) => {
    const newWindows = [...localSettings.deepWorkWindows];
    newWindows[index] = { ...newWindows[index], [field]: value };
    handleSettingChange("deepWorkWindows", newWindows);
  };

  const addWindow = () => {
    const newWindows = [
      ...localSettings.deepWorkWindows,
      { start: 9, end: 12 },
    ];
    handleSettingChange("deepWorkWindows", newWindows);
  };

  const removeWindow = (index: number) => {
    const newWindows = localSettings.deepWorkWindows.filter(
      (_, i) => i !== index,
    );
    handleSettingChange("deepWorkWindows", newWindows);
  };

  return (
    <Card variant="elevated">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Focus className="h-5 w-5 text-[#A855F7]" />
            <span className="text-h3">Deep Work & Focus Settings</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-surface-hover rounded-lg">
            <div className="text-h2 font-bold text-[#A855F7]">
              {localSettings.contextSwitchPenaltyMinutes}m
            </div>
            <div className="text-caption text-text-tertiary">
              Switch Penalty
            </div>
          </div>
          <div className="p-3 bg-surface-hover rounded-lg">
            <div className="text-h2 font-bold text-primary">
              {localSettings.maxIAsPerDay}
            </div>
            <div className="text-caption text-text-tertiary">Max IAs/Day</div>
          </div>
          <div className="p-3 bg-surface-hover rounded-lg">
            <div className="text-h2 font-bold text-success">
              {localSettings.prepBufferMinutes +
                localSettings.decompressBufferMinutes}
              m
            </div>
            <div className="text-caption text-text-tertiary">Buffer Time</div>
          </div>
        </div>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Minimum Session Hours */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-body font-medium text-text-secondary">
                  Minimum Session Hours by Phase
                </h3>
              </div>
              <p className="text-caption text-text-tertiary">
                Work phases require different minimum time blocks for productive
                focus. Adjust based on your personal experience.
              </p>

              <div className="space-y-2">
                {(Object.keys(PHASE_LABELS) as MilestonePhase[]).map(
                  (phase) => (
                    <div
                      key={phase}
                      className="flex items-center justify-between p-3 bg-surface-hover rounded-lg"
                    >
                      <div>
                        <div className="text-body-sm font-medium text-text-secondary">
                          {PHASE_LABELS[phase].label}
                        </div>
                        <div className="text-caption text-text-tertiary">
                          {PHASE_LABELS[phase].description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="8"
                          value={localSettings.minimumSessionHours[phase]}
                          onChange={(e) =>
                            handlePhaseHoursChange(
                              phase,
                              parseFloat(e.target.value) || 1,
                            )
                          }
                          className="w-20 h-8 text-center"
                        />
                        <span className="text-caption text-text-tertiary">
                          hrs
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Context Switching */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shuffle className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-body font-medium text-text-secondary">
                  Context Switching Penalty
                </h3>
              </div>
              <p className="text-caption text-text-tertiary">
                Time lost when switching between different IAs. Adjust if you
                handle switching better or worse than average.
              </p>

              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={localSettings.contextSwitchPenaltyMinutes}
                  onChange={(e) =>
                    handleSettingChange(
                      "contextSwitchPenaltyMinutes",
                      parseInt(e.target.value) || 30,
                    )
                  }
                  className="w-24 h-9"
                />
                <span className="text-body-sm text-text-tertiary">
                  minutes per switch
                </span>
              </div>
            </div>

            {/* Max IAs per Day */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-body font-medium text-text-secondary">
                  Maximum IAs per Day
                </h3>
              </div>
              <p className="text-caption text-text-tertiary">
                Limit how many different IAs can be worked on in a single day to
                minimize context switching.
              </p>

              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="7"
                  value={localSettings.maxIAsPerDay}
                  onChange={(e) =>
                    handleSettingChange(
                      "maxIAsPerDay",
                      parseInt(e.target.value) || 2,
                    )
                  }
                  className="w-24 h-9"
                />
                <span className="text-body-sm text-text-tertiary">
                  IAs maximum
                </span>
              </div>
            </div>

            {/* Buffer Times */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-body font-medium text-text-secondary">
                  Buffer Times
                </h3>
              </div>
              <p className="text-caption text-text-tertiary">
                Add preparation time before and decompression time after deep
                work sessions.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-surface-hover rounded-lg">
                  <div className="text-caption text-text-tertiary mb-2">
                    Prep Buffer
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      value={localSettings.prepBufferMinutes}
                      onChange={(e) =>
                        handleSettingChange(
                          "prepBufferMinutes",
                          parseInt(e.target.value) || 15,
                        )
                      }
                      className="w-20 h-8"
                    />
                    <span className="text-caption text-text-tertiary">min</span>
                  </div>
                </div>
                <div className="p-3 bg-surface-hover rounded-lg">
                  <div className="text-caption text-text-tertiary mb-2">
                    Decompress Buffer
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      value={localSettings.decompressBufferMinutes}
                      onChange={(e) =>
                        handleSettingChange(
                          "decompressBufferMinutes",
                          parseInt(e.target.value) || 15,
                        )
                      }
                      className="w-20 h-8"
                    />
                    <span className="text-caption text-text-tertiary">min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deep Work Windows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Focus className="h-4 w-4 text-text-tertiary" />
                  <h3 className="text-body font-medium text-text-secondary">
                    Deep Work Windows
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={localSettings.enforceDeepWorkWindows}
                    onCheckedChange={(checked) =>
                      handleSettingChange(
                        "enforceDeepWorkWindows",
                        checked as boolean,
                      )
                    }
                  />
                  <span className="text-caption text-text-tertiary">
                    Enforce
                  </span>
                </div>
              </div>
              <p className="text-caption text-text-tertiary">
                Define your peak focus hours. Deep work will only be scheduled
                during these windows when enforced.
              </p>

              <div className="space-y-2">
                {localSettings.deepWorkWindows.map((window, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      localSettings.enforceDeepWorkWindows
                        ? "bg-[#A855F7]/10 border border-[#A855F7]/30"
                        : "bg-surface-hover",
                    )}
                  >
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={window.start}
                      onChange={(e) =>
                        handleWindowChange(
                          index,
                          "start",
                          parseInt(e.target.value) || 9,
                        )
                      }
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-text-tertiary">to</span>
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      value={window.end}
                      onChange={(e) =>
                        handleWindowChange(
                          index,
                          "end",
                          parseInt(e.target.value) || 12,
                        )
                      }
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-caption text-text-tertiary">
                      ({window.end - window.start}h block)
                    </span>
                    {localSettings.deepWorkWindows.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeWindow(index)}
                        className="ml-auto text-critical hover:text-critical"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addWindow}
                  className="w-full"
                >
                  + Add Window
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-caption text-primary">
                <p className="font-medium mb-1">
                  How Deep Work Protection Works
                </p>
                <ul className="list-disc list-inside space-y-1 text-primary/80">
                  <li>Sessions shorter than minimums trigger warnings</li>
                  <li>Context switches add penalty time to your schedule</li>
                  <li>Fragmented work is detected and flagged</li>
                  <li>Auto-fix suggestions help optimize your schedule</li>
                </ul>
              </div>
            </div>

            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </motion.div>
        )}

        {!expanded && (
          <p className="text-caption text-text-tertiary text-center">
            Click to configure minimum session lengths, context switching, and
            deep work windows
          </p>
        )}
      </CardContent>
    </Card>
  );
}
