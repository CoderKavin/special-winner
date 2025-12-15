import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="inline-flex items-center gap-2">
        <div className="relative">
          <input
            type="checkbox"
            ref={ref}
            id={inputId}
            checked={checked}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            className="sr-only peer"
            {...props}
          />
          <div
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
              // Base styles
              "h-4 w-4 shrink-0 rounded",
              "border-[1.5px] border-border-emphasis",
              "cursor-pointer",
              "transition-all duration-fast ease-out",
              // Hover state
              "hover:border-text-tertiary",
              // Checked state
              checked && "bg-primary border-primary",
              // Focus state (via peer)
              "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
              // Disabled state
              "peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
              className,
            )}
          >
            {checked && (
              <Check className="h-3 w-3 text-white m-[1px] animate-scale-in" />
            )}
          </div>
        </div>
        {label && (
          <label
            htmlFor={inputId}
            className="text-body-sm text-text-primary cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";

// Toggle/Switch component
interface ToggleProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

function Toggle({
  checked = false,
  onCheckedChange,
  disabled = false,
  label,
  className,
}: ToggleProps) {
  const id = React.useId();

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          // Base styles
          "relative inline-flex h-5 w-9 shrink-0 rounded-full",
          "transition-colors duration-medium ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Unchecked state
          "bg-border-subtle",
          // Checked state
          checked && "bg-primary",
          // Disabled state
          disabled && "cursor-not-allowed opacity-40",
          !disabled && "cursor-pointer",
        )}
      >
        <span
          className={cn(
            // Handle styles
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white",
            "shadow-1",
            "transition-transform duration-medium ease-out",
            // Position
            "translate-x-0.5",
            checked && "translate-x-[18px]",
          )}
        />
      </button>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            "text-body-sm text-text-primary select-none",
            disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
}

export { Checkbox, Toggle };
