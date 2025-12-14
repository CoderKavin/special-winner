import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { AppState } from "../../types";
import { generateWarnings } from "../../lib/utils";
import { AlertTriangle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface WarningsPanelProps {
  state: AppState;
}

export function WarningsPanel({ state }: WarningsPanelProps) {
  const warnings = useMemo(() => generateWarnings(state), [state]);

  if (warnings.length === 0) {
    return null;
  }

  const errors = warnings.filter((w) => w.severity === "error");
  const warningsOnly = warnings.filter((w) => w.severity === "warning");

  return (
    <Card className="bg-slate-900/50 border-slate-800 mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Warnings & Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {errors.map((warning, index) => (
            <motion.div
              key={`error-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                "bg-red-500/10 border border-red-500/20"
              )}
            >
              <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{warning.message}</p>
              </div>
            </motion.div>
          ))}

          {warningsOnly.map((warning, index) => (
            <motion.div
              key={`warning-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: (errors.length + index) * 0.05 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                "bg-yellow-500/10 border border-yellow-500/20"
              )}
            >
              <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-300">{warning.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
