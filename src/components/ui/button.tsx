/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-medium",
    "rounded-md",
    "transition-all duration-normal ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "hover:bg-primary-hover hover:-translate-y-px",
          "shadow-1 hover:shadow-2",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90 hover:-translate-y-px",
          "shadow-1 hover:shadow-2",
        ].join(" "),
        outline: [
          "border border-border-emphasis bg-transparent",
          "text-text-primary",
          "hover:border-text-tertiary hover:bg-primary/10",
        ].join(" "),
        secondary: [
          "border border-border-emphasis bg-transparent",
          "text-text-primary",
          "hover:border-text-tertiary hover:bg-surface-hover",
        ].join(" "),
        ghost: [
          "bg-transparent",
          "text-text-secondary",
          "hover:text-text-primary hover:bg-white/5",
        ].join(" "),
        link: [
          "text-primary underline-offset-4",
          "hover:underline hover:text-primary-hover",
        ].join(" "),
        success: [
          "bg-success text-success-foreground",
          "hover:bg-success/90 hover:-translate-y-px",
          "shadow-1 hover:shadow-2",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-body-sm",
        lg: "h-11 px-6 text-body-lg",
        icon: "h-8 w-8 p-0",
        "icon-sm": "h-7 w-7 p-0",
        "icon-lg": "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, isLoading, children, disabled, ...props },
    ref,
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
