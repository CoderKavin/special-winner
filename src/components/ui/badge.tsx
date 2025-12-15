/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "font-semibold",
    "transition-colors duration-150",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/25",
        secondary:
          "bg-slate-100 dark:bg-surface text-slate-600 dark:text-text-secondary border border-slate-200 dark:border-border-subtle",
        outline:
          "bg-transparent text-slate-600 dark:text-text-secondary border border-slate-300 dark:border-border-emphasis",
        success:
          "bg-emerald-50 dark:bg-success/15 text-emerald-700 dark:text-success border border-emerald-200 dark:border-success/25",
        warning:
          "bg-amber-50 dark:bg-warning/15 text-amber-700 dark:text-warning border border-amber-200 dark:border-warning/25",
        error:
          "bg-red-50 dark:bg-critical/15 text-red-700 dark:text-critical border border-red-200 dark:border-critical/25",
        info: "bg-blue-50 dark:bg-info/15 text-blue-700 dark:text-info border border-blue-200 dark:border-info/25",
        // Subject variants
        math: "bg-blue-50 dark:bg-math/15 text-blue-700 dark:text-math border border-blue-200 dark:border-math/25",
        physics:
          "bg-purple-50 dark:bg-physics/15 text-purple-700 dark:text-physics border border-purple-200 dark:border-physics/25",
        economics:
          "bg-emerald-50 dark:bg-economics/15 text-emerald-700 dark:text-economics border border-emerald-200 dark:border-economics/25",
        english:
          "bg-orange-50 dark:bg-english/15 text-orange-700 dark:text-english border border-orange-200 dark:border-english/25",
        history:
          "bg-red-50 dark:bg-history/15 text-red-700 dark:text-history border border-red-200 dark:border-history/25",
      },
      size: {
        sm: "px-2 py-0.5 text-xs rounded",
        default: "px-2.5 py-1 text-xs rounded-md",
        lg: "px-3 py-1.5 text-sm rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

// Status dot component for inline status indicators
interface StatusDotProps {
  status: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "default" | "lg";
  pulse?: boolean;
  className?: string;
}

function StatusDot({
  status,
  size = "default",
  pulse = false,
  className,
}: StatusDotProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    default: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const colorClasses = {
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-critical",
    info: "bg-info",
    neutral: "bg-slate-400 dark:bg-text-tertiary",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizeClasses[size],
        colorClasses[status],
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}

export { Badge, badgeVariants, StatusDot };
