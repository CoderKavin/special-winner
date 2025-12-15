import * as React from "react";
import { cn } from "../../lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
  variant?: "default" | "success" | "warning" | "error";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      indicatorClassName,
      variant = "default",
      size = "default",
      showLabel = false,
      ...props
    },
    ref,
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeClasses = {
      sm: "h-1",
      default: "h-1.5",
      lg: "h-2",
    };

    const variantClasses = {
      default: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      error: "bg-critical",
    };

    return (
      <div className={cn("w-full", showLabel && "space-y-1")}>
        {showLabel && (
          <div className="flex justify-between text-caption text-text-secondary">
            <span>{Math.round(percentage)}%</span>
          </div>
        )}
        <div
          ref={ref}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-white/5",
            sizeClasses[size],
            className,
          )}
          {...props}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-medium ease-out",
              variantClasses[variant],
              indicatorClassName,
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  },
);
Progress.displayName = "Progress";

// Circular progress ring component
interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  showLabel?: boolean;
  label?: string;
}

function ProgressRing({
  value,
  max = 100,
  size = 64,
  strokeWidth = 4,
  className,
  color = "var(--color-primary)",
  showLabel = true,
  label,
}: ProgressRingProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-medium ease-out"
          style={{ opacity: 0.8 }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-h2 font-semibold text-text-primary">
            {Math.round(percentage)}%
          </span>
          {label && (
            <span className="text-caption text-text-secondary">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Skeleton loading bar
interface SkeletonBarProps {
  className?: string;
  height?: string;
}

function SkeletonBar({ className, height = "h-4" }: SkeletonBarProps) {
  return (
    <div
      className={cn(
        "w-full rounded-md bg-surface animate-shimmer",
        height,
        className,
      )}
      style={{
        background: `linear-gradient(90deg, #16181D 0%, #1C1E24 50%, #16181D 100%)`,
        backgroundSize: "200% 100%",
      }}
    />
  );
}

export { Progress, ProgressRing, SkeletonBar };
