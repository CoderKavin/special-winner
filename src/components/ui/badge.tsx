/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "font-medium",
    "transition-colors duration-fast",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary/20 text-primary border border-primary/30",
        secondary: "bg-surface text-text-secondary border border-border-subtle",
        outline:
          "bg-transparent text-text-secondary border border-border-emphasis",
        success: "bg-success/20 text-success border border-success/30",
        warning: "bg-warning/20 text-warning border border-warning/30",
        error: "bg-critical/20 text-critical border border-critical/30",
        info: "bg-info/20 text-info border border-info/30",
        // Subject variants
        math: "bg-math/20 text-math border border-math/30",
        physics: "bg-physics/20 text-physics border border-physics/30",
        economics: "bg-economics/20 text-economics border border-economics/30",
        english: "bg-english/20 text-english border border-english/30",
        history: "bg-history/20 text-history border border-history/30",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[11px] rounded",
        default: "px-2 py-0.5 text-xs rounded",
        lg: "px-2.5 py-1 text-xs rounded-md",
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
    sm: "w-1.5 h-1.5",
    default: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  const colorClasses = {
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-critical",
    info: "bg-info",
    neutral: "bg-text-tertiary",
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
