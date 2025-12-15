import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DeepWorkSettings } from "./settings/DeepWorkSettings";
import { EnergyProfileSettings } from "./settings/EnergyProfileSettings";
import type {
  AppState,
  DeepWorkSettings as DeepWorkSettingsType,
  EnergySettings as EnergySettingsType,
} from "../types";
import { formatDate } from "../lib/utils";
import {
  isGoogleCalendarConfigured,
  initGoogleAuth,
  signInWithGoogle,
  signOut,
  isSignedIn,
  syncAllMilestones,
} from "../services/calendar";
import {
  Calendar,
  Target,
  RefreshCw,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";

interface SettingsProps {
  state: AppState;
  onMasterDeadlineChange: (deadline: string) => void;
  onWeeklyHoursChange: (hours: number) => void;
  onCalendarSync: (eventIds: Record<string, string>) => void;
  onLastSyncUpdate: (timestamp: string) => void;
  onDeepWorkSettingsChange: (settings: DeepWorkSettingsType) => void;
  onEnergySettingsChange: (settings: EnergySettingsType) => void;
  onReset: () => void;
}

export function Settings({
  state,
  onMasterDeadlineChange,
  onWeeklyHoursChange,
  onCalendarSync,
  onLastSyncUpdate,
  onDeepWorkSettingsChange,
  onEnergySettingsChange,
  onReset,
}: SettingsProps) {
  const [masterDeadline, setMasterDeadline] = useState(state.masterDeadline);
  const [weeklyHours, setWeeklyHours] = useState(
    state.weeklyHoursBudget.toString(),
  );
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (isGoogleCalendarConfigured()) {
      initGoogleAuth().then(() => {
        setGoogleConnected(isSignedIn());
      });
    }
  }, []);

  const handleDeadlineChange = () => {
    if (masterDeadline !== state.masterDeadline) {
      onMasterDeadlineChange(masterDeadline);
    }
  };

  const handleHoursChange = () => {
    const hours = parseInt(weeklyHours);
    if (!isNaN(hours) && hours > 0 && hours !== state.weeklyHoursBudget) {
      onWeeklyHoursChange(hours);
    }
  };

  const handleGoogleConnect = async () => {
    try {
      setSyncError(null);
      await signInWithGoogle();
      setGoogleConnected(true);
    } catch (error) {
      setSyncError("Failed to connect to Google Calendar");
      console.error(error);
    }
  };

  const handleGoogleDisconnect = () => {
    signOut();
    setGoogleConnected(false);
  };

  const handleSync = async () => {
    if (!googleConnected) return;

    setIsSyncing(true);
    setSyncError(null);
    setSyncProgress({ current: 0, total: 0 });

    try {
      const newEventIds = await syncAllMilestones(
        state.ias,
        state.googleCalendarEventIds,
        (current, total) => setSyncProgress({ current, total }),
        state.deepWorkSettings,
      );

      onCalendarSync(newEventIds);
      onLastSyncUpdate(new Date().toISOString());
    } catch (error) {
      setSyncError("Failed to sync with Google Calendar");
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReset = () => {
    onReset();
    setShowResetConfirm(false);
    setMasterDeadline("2025-12-31");
    setWeeklyHours("6");
  };

  const totalMilestones = state.ias.reduce(
    (sum, ia) => sum + ia.milestones.length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Deadline & Hours Settings */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2">
            <Target className="h-5 w-5 text-text-tertiary" />
            Deadline & Time Budget
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Deadline */}
          <div className="space-y-2">
            <label className="text-body-sm text-text-secondary">
              Master Deadline
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="date"
                value={masterDeadline}
                onChange={(e) => setMasterDeadline(e.target.value)}
                className="w-48"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDeadlineChange}
                disabled={masterDeadline === state.masterDeadline}
              >
                Update
              </Button>
              <span className="text-body-sm text-text-tertiary">
                Currently: {formatDate(state.masterDeadline)}
              </span>
            </div>
            <p className="text-caption text-text-tertiary">
              All IAs should be completed by this date
            </p>
          </div>

          {/* Weekly Hours Budget */}
          <div className="space-y-2">
            <label className="text-body-sm text-text-secondary">
              Weekly Hours Budget
            </label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  max="40"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(e.target.value)}
                  className="w-24 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-text-tertiary">
                  hrs
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleHoursChange}
                disabled={
                  parseInt(weeklyHours) === state.weeklyHoursBudget ||
                  isNaN(parseInt(weeklyHours))
                }
              >
                Update
              </Button>
              <span className="text-body-sm text-text-tertiary">
                Currently: {state.weeklyHoursBudget} hours/week
              </span>
            </div>
            <p className="text-caption text-text-tertiary">
              Realistic time you can dedicate to IAs each week
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Deep Work Settings */}
      <DeepWorkSettings
        settings={state.deepWorkSettings}
        onUpdate={onDeepWorkSettingsChange}
      />

      {/* Energy Profile Settings */}
      <EnergyProfileSettings
        settings={state.energySettings}
        onUpdate={onEnergySettingsChange}
      />

      {/* Google Calendar Integration */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-text-tertiary" />
            Google Calendar Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGoogleCalendarConfigured() ? (
            <div className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-body-sm text-warning">
                  Google Calendar not configured
                </p>
                <p className="text-caption text-warning/70 mt-1">
                  Add VITE_GOOGLE_CLIENT_ID to your environment variables
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Connection Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {googleConnected ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <span className="text-body-sm text-success">
                        Connected to Google Calendar
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-text-tertiary" />
                      <span className="text-body-sm text-text-tertiary">
                        Not connected
                      </span>
                    </>
                  )}
                </div>

                {googleConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGoogleDisconnect}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGoogleConnect}
                    className="gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Connect Google
                  </Button>
                )}
              </div>

              {/* Sync Button */}
              {googleConnected && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-body-sm text-text-secondary">
                        {totalMilestones} milestones to sync
                      </p>
                      {state.lastCalendarSync && (
                        <p className="text-caption text-text-tertiary">
                          Last synced: {formatDate(state.lastCalendarSync)}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleSync}
                      disabled={isSyncing || totalMilestones === 0}
                      className="gap-2"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Syncing {syncProgress.current}/{syncProgress.total}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Sync to Calendar
                        </>
                      )}
                    </Button>
                  </div>

                  {syncError && (
                    <div className="flex items-center gap-2 text-body-sm text-critical">
                      <AlertCircle className="h-4 w-4" />
                      {syncError}
                    </div>
                  )}

                  <p className="text-caption text-text-tertiary">
                    Creates "IB Deadlines - Kavin" calendar with all milestone
                    events. Deep work blocks are marked as BUSY and include
                    prep/decompress buffers.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-critical/30">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-critical">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showResetConfirm ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <p className="text-body-sm text-critical">
                Are you sure? This will delete all your milestones and progress.
                This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <Button variant="destructive" size="sm" onClick={handleReset}>
                  Yes, Reset Everything
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-sm text-text-secondary">
                  Reset All Data
                </p>
                <p className="text-caption text-text-tertiary">
                  Clear all milestones and start fresh
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="border-critical/30 text-critical hover:bg-critical/10"
              >
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
