import * as React from "react";
import { cn } from "../../lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "elevated";
  subjectColor?: "math" | "physics" | "economics" | "english" | "history";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", subjectColor, ...props }, ref) => {
    const baseStyles = [
      "rounded-xl border text-card-foreground",
      "bg-white dark:bg-surface",
      "transition-all duration-200 ease-out",
    ];

    const variantStyles = {
      default:
        "border-slate-200 dark:border-border-subtle shadow-sm dark:shadow-none",
      interactive: [
        "border-slate-200 dark:border-border-subtle shadow-sm dark:shadow-none",
        "hover:border-slate-300 dark:hover:border-border-emphasis hover:shadow-md dark:hover:shadow-card-hover hover:-translate-y-0.5",
        "cursor-pointer",
      ].join(" "),
      elevated:
        "border-slate-200 dark:border-border-emphasis shadow-md dark:shadow-2",
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
      "text-lg font-semibold leading-tight tracking-tight text-slate-900 dark:text-text-primary",
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
    className={cn("text-sm text-slate-600 dark:text-text-secondary", className)}
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
      "flex items-center p-5 pt-0 border-t border-slate-200 dark:border-border-subtle mt-4",
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
