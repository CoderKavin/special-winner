import * as React from "react";
import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-10 w-full rounded-md",
          "bg-white/[0.03] border border-border-subtle",
          "px-3 py-2",
          "text-sm text-text-primary",
          "font-sans",
          // Placeholder
          "placeholder:text-text-tertiary",
          // Focus state
          "focus:outline-none focus:border-primary focus:bg-primary/5",
          "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
          // Transitions
          "transition-all duration-normal ease-out",
          // File input
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-secondary",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

// Textarea variant
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Base styles
          "flex w-full rounded-md",
          "bg-white/[0.03] border border-border-subtle",
          "px-3 py-2",
          "text-sm text-text-primary",
          "font-sans",
          "min-h-[80px] resize-y",
          // Placeholder
          "placeholder:text-text-tertiary",
          // Focus state
          "focus:outline-none focus:border-primary focus:bg-primary/5",
          "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
          // Transitions
          "transition-all duration-normal ease-out",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
