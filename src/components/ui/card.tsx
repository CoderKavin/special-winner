import * as React from "react";
import { cn } from "../../lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "elevated";
  subjectColor?: "math" | "physics" | "economics" | "english" | "history";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", subjectColor, ...props }, ref) => {
    const baseStyles = [
      "rounded-xl border",
      "bg-[var(--bg-surface)] text-[var(--text-primary)]",
      "transition-all duration-200 ease-out",
    ];

    const variantStyles = {
      default: "border-[var(--border-subtle)] shadow-[var(--shadow-1)]",
      interactive: [
        "border-[var(--border-subtle)] shadow-[var(--shadow-1)]",
        "hover:border-[var(--border-emphasis)] hover:shadow-[var(--shadow-2)] hover:-translate-y-0.5",
        "cursor-pointer",
      ].join(" "),
      elevated: "border-[var(--border-emphasis)] shadow-[var(--shadow-2)]",
    };

    const subjectBorderStyles = subjectColor
      ? `border-l-[3px] border-l-${subjectColor}`
      : "";

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          subjectBorderStyles,
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight tracking-tight text-[var(--text-primary)]",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--text-secondary)]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-5 pt-0 border-t border-[var(--border-subtle)] mt-4",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
