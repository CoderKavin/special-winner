import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import type {
  EnergySettings,
  EnergyLevel,
  EnergyWindow,
  DayEnergyPattern,
} from "../../types";
import { DEFAULT_ENERGY_SETTINGS } from "../../types";
import {
  Battery,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  Sun,
  Moon,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Copy,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface EnergyProfileSettingsProps {
  settings: EnergySettings;
  onUpdate: (settings: EnergySettings) => void;
}

const ENERGY_LEVEL_INFO: Record<
  EnergyLevel,
  { label: string; icon: typeof Battery; color: string; bgColor: string }
> = {
  high: {
    label: "High Energy",
    icon: BatteryFull,
    color: "text-success",
    bgColor: "bg-success/20",
  },
  medium: {
    label: "Medium Energy",
    icon: BatteryMedium,
    color: "text-warning",
    bgColor: "bg-warning/20",
  },
  low: {
    label: "Low Energy",
    icon: BatteryLow,
    color: "text-critical",
    bgColor: "bg-critical/20",
  },
};

const DAY_LABELS = {
  weekday: {
    label: "Weekdays",
    description: "Monday through Friday",
    icon: Sun,
  },
  weekend: { label: "Weekend", description: "Saturday and Sunday", icon: Moon },
};

export function EnergyProfileSettings({
  settings,
  onUpdate,
}: EnergyProfileSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeDay, setActiveDay] = useState<"weekday" | "weekend">("weekday");

  const handleSettingChange = <K extends keyof EnergySettings>(
    key: K,
    value: EnergySettings[K],
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onUpdate(newSettings);
  };

  const handlePatternChange = (
    dayType: "weekday" | "weekend",
    pattern: DayEnergyPattern,
  ) => {
    const newProfile = {
      ...localSettings.profile,
      [dayType === "weekday" ? "weekdayPattern" : "weekendPattern"]: pattern,
    };
    handleSettingChange("profile", newProfile);
  };

  const handleWindowChange = (
    dayType: "weekday" | "weekend",
    windowId: string,
    field: "startHour" | "endHour" | "level",
    value: number | EnergyLevel,
  ) => {
    const patternKey =
      dayType === "weekday" ? "weekdayPattern" : "weekendPattern";
    const pattern = localSettings.profile[patternKey];
    const windows = pattern.windows.map((w) =>
      w.id === windowId ? { ...w, [field]: value } : w,
    );

    const newPattern = { ...pattern, windows };
    handlePatternChange(dayType, newPattern);
  };

  const addWindow = (dayType: "weekday" | "weekend", level: EnergyLevel) => {
    const patternKey =
      dayType === "weekday" ? "weekdayPattern" : "weekendPattern";
    const pattern = localSettings.profile[patternKey];
    const newWindow: EnergyWindow = {
      id: `window-${crypto.randomUUID()}`,
      startHour: 9,
      endHour: 12,
      level,
    };
    const windows = [...pattern.windows, newWindow];

    const newPattern = { ...pattern, windows };
    handlePatternChange(dayType, newPattern);
  };

  const removeWindow = (dayType: "weekday" | "weekend", windowId: string) => {
    const patternKey =
      dayType === "weekday" ? "weekdayPattern" : "weekendPattern";
    const pattern = localSettings.profile[patternKey];
    const windows = pattern.windows.filter((w) => w.id !== windowId);

    const newPattern = { ...pattern, windows };
    handlePatternChange(dayType, newPattern);
  };

  const copyWeekdayToWeekend = () => {
    const newProfile = {
      ...localSettings.profile,
      weekendPattern: {
        windows: localSettings.profile.weekdayPattern.windows.map((w) => ({
          ...w,
          id: `${w.id}-weekend-${crypto.randomUUID()}`,
        })),
      },
    };
    handleSettingChange("profile", newProfile);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_ENERGY_SETTINGS);
    onUpdate(DEFAULT_ENERGY_SETTINGS);
  };

  const currentPattern =
    activeDay === "weekday"
      ? localSettings.profile.weekdayPattern
      : localSettings.profile.weekendPattern;

  const getWindowsByLevel = (pattern: DayEnergyPattern, level: EnergyLevel) => {
    return pattern.windows.filter((w) => w.level === level);
  };

  const getTotalHoursByLevel = (
    pattern: DayEnergyPattern,
    level: EnergyLevel,
  ) => {
    return getWindowsByLevel(pattern, level).reduce(
      (sum, w) => sum + (w.endHour - w.startHour),
      0,
    );
  };

  return (
    <Card variant="elevated">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            <span className="text-h3">Energy Profile & Cognitive Load</span>
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
          <div className="p-3 bg-success/10 rounded-lg border border-success/30">
            <div className="text-h2 font-bold text-success">
              {getTotalHoursByLevel(
                localSettings.profile.weekdayPattern,
                "high",
              )}
              h
            </div>
            <div className="text-caption text-text-tertiary">
              High Energy/Day
            </div>
          </div>
          <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
            <div className="text-h2 font-bold text-warning">
              {getTotalHoursByLevel(
                localSettings.profile.weekdayPattern,
                "medium",
              )}
              h
            </div>
            <div className="text-caption text-text-tertiary">
              Medium Energy/Day
            </div>
          </div>
          <div className="p-3 bg-critical/10 rounded-lg border border-critical/30">
            <div className="text-h2 font-bold text-critical">
              {localSettings.highLoadInLowPenalty}%
            </div>
            <div className="text-caption text-text-tertiary">Max Penalty</div>
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
            {/* Day Type Selector */}
            <div className="flex gap-2">
              {(["weekday", "weekend"] as const).map((dayType) => {
                const DayIcon = DAY_LABELS[dayType].icon;
                return (
                  <Button
                    key={dayType}
                    variant={activeDay === dayType ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveDay(dayType)}
                    className={cn(
                      "flex-1 gap-2",
                      activeDay === dayType && "bg-warning hover:bg-warning/90",
                    )}
                  >
                    <DayIcon className="h-4 w-4" />
                    {DAY_LABELS[dayType].label}
                  </Button>
                );
              })}
            </div>

            {activeDay === "weekend" && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyWeekdayToWeekend}
                className="w-full gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Weekday Pattern to Weekend
              </Button>
            )}

            {/* Energy Windows by Level */}
            {(["high", "medium", "low"] as EnergyLevel[]).map((level) => {
              const levelInfo = ENERGY_LEVEL_INFO[level];
              const LevelIcon = levelInfo.icon;
              const windows = getWindowsByLevel(currentPattern, level);

              return (
                <div key={level} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LevelIcon className={cn("h-4 w-4", levelInfo.color)} />
                      <h3 className="text-body font-medium text-text-secondary">
                        {levelInfo.label} Windows
                      </h3>
                      <span className="text-caption text-text-tertiary">
                        ({getTotalHoursByLevel(currentPattern, level)}h total)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {windows.map((window) => (
                      <div
                        key={window.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg",
                          levelInfo.bgColor,
                        )}
                      >
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={window.startHour}
                          onChange={(e) =>
                            handleWindowChange(
                              activeDay,
                              window.id,
                              "startHour",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-16 h-8 text-center"
                        />
                        <span className="text-text-tertiary">to</span>
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          value={window.endHour}
                          onChange={(e) =>
                            handleWindowChange(
                              activeDay,
                              window.id,
                              "endHour",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-16 h-8 text-center"
                        />
                        <span className="text-caption text-text-tertiary">
                          ({window.endHour - window.startHour}h block)
                        </span>
                        {window.description && (
                          <span className="text-caption text-text-tertiary italic">
                            {window.description}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeWindow(activeDay, window.id)}
                          className="ml-auto text-critical hover:text-critical"
                        >
                          ×
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addWindow(activeDay, level)}
                      className={cn("w-full", levelInfo.color)}
                    >
                      + Add {levelInfo.label} Window
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Energy Matching Settings */}
            <div className="space-y-4 pt-4 border-t border-border-subtle">
              <h3 className="text-body font-medium text-text-secondary">
                Energy Matching Rules
              </h3>

              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <div>
                  <div className="text-body-sm font-medium text-text-secondary">
                    Enforce Energy Matching
                  </div>
                  <div className="text-caption text-text-tertiary">
                    Block scheduling high-load tasks in low-energy windows
                  </div>
                </div>
                <Checkbox
                  checked={localSettings.enforceEnergyMatching}
                  onCheckedChange={(checked) =>
                    handleSettingChange(
                      "enforceEnergyMatching",
                      checked as boolean,
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <div>
                  <div className="text-body-sm font-medium text-text-secondary">
                    Allow Mismatch Overrides
                  </div>
                  <div className="text-caption text-text-tertiary">
                    Let users override energy mismatch warnings
                  </div>
                </div>
                <Checkbox
                  checked={localSettings.allowMismatchOverrides}
                  onCheckedChange={(checked) =>
                    handleSettingChange(
                      "allowMismatchOverrides",
                      checked as boolean,
                    )
                  }
                />
              </div>
            </div>

            {/* Productivity Penalties */}
            <div className="space-y-4">
              <h3 className="text-body font-medium text-text-secondary">
                Mismatch Productivity Penalties
              </h3>
              <p className="text-caption text-text-tertiary">
                How much less effective is work when cognitive load doesn't
                match energy level?
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <div className="flex items-center gap-2">
                    <BatteryFull className="h-4 w-4 text-success" />
                    <span className="text-body-sm text-text-tertiary">→</span>
                    <BatteryMedium className="h-4 w-4 text-warning" />
                    <span className="text-body-sm text-text-secondary">
                      High Load in Medium Energy
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={localSettings.highLoadInMediumPenalty}
                      onChange={(e) =>
                        handleSettingChange(
                          "highLoadInMediumPenalty",
                          parseInt(e.target.value) || 20,
                        )
                      }
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-caption text-text-tertiary">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <div className="flex items-center gap-2">
                    <BatteryFull className="h-4 w-4 text-success" />
                    <span className="text-body-sm text-text-tertiary">→</span>
                    <BatteryLow className="h-4 w-4 text-critical" />
                    <span className="text-body-sm text-text-secondary">
                      High Load in Low Energy
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={localSettings.highLoadInLowPenalty}
                      onChange={(e) =>
                        handleSettingChange(
                          "highLoadInLowPenalty",
                          parseInt(e.target.value) || 40,
                        )
                      }
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-caption text-text-tertiary">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <div className="flex items-center gap-2">
                    <BatteryMedium className="h-4 w-4 text-warning" />
                    <span className="text-body-sm text-text-tertiary">→</span>
                    <BatteryLow className="h-4 w-4 text-critical" />
                    <span className="text-body-sm text-text-secondary">
                      Medium Load in Low Energy
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={localSettings.mediumLoadInLowPenalty}
                      onChange={(e) =>
                        handleSettingChange(
                          "mediumLoadInLowPenalty",
                          parseInt(e.target.value) || 15,
                        )
                      }
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-caption text-text-tertiary">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cognitive Load Reference */}
            <div className="space-y-3">
              <h3 className="text-body font-medium text-text-secondary">
                Cognitive Load by Subject & Phase
              </h3>
              <div className="grid grid-cols-2 gap-2 text-caption">
                <div className="p-2 bg-success/10 rounded border border-success/20">
                  <span className="font-medium text-success">HIGH Load</span>
                  <div className="text-text-tertiary mt-1">
                    Math (Research, Draft), Physics (Research, Draft, Revision)
                  </div>
                </div>
                <div className="p-2 bg-warning/10 rounded border border-warning/20">
                  <span className="font-medium text-warning">MEDIUM Load</span>
                  <div className="text-text-tertiary mt-1">
                    Most subjects (Outline, Revision, Polish phases)
                  </div>
                </div>
                <div className="p-2 bg-critical/10 rounded border border-critical/20 col-span-2">
                  <span className="font-medium text-critical">LOW Load</span>
                  <div className="text-text-tertiary mt-1">
                    Economics (Research), English/History (Polish)
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-caption text-warning">
                <p className="font-medium mb-1">How Energy Matching Works</p>
                <ul className="list-disc list-inside space-y-1 text-warning/80">
                  <li>High cognitive load tasks need high energy windows</li>
                  <li>Mismatches reduce effective productivity</li>
                  <li>Auto-optimization suggests better time slots</li>
                  <li>Performance data improves recommendations over time</li>
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
            Click to configure your energy patterns and cognitive load matching
            rules
          </p>
        )}
      </CardContent>
    </Card>
  );
}
