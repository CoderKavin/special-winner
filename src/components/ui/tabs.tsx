import * as React from "react";
import { cn } from "../../lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(
  undefined,
);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  defaultValue?: string;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} className={cn("", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "inline-flex items-center gap-1",
      "rounded-lg bg-surface border border-border-subtle",
      "p-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isActive = context.value === value;

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        onClick={() => context.onValueChange(value)}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-2",
          "whitespace-nowrap rounded-md",
          "px-4 py-2",
          "text-sm font-medium",
          "transition-all duration-normal ease-out",
          // Focus state
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Disabled state
          "disabled:pointer-events-none disabled:opacity-40",
          // Active/Inactive states
          isActive
            ? "bg-surface-hover text-text-primary shadow-1"
            : "text-text-secondary hover:text-text-primary hover:bg-white/5",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    if (context.value !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          "mt-4",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";

// Underlined tabs variant (Linear-style)
const TabsListUnderlined = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "inline-flex items-center gap-0",
      "border-b border-border-subtle",
      className,
    )}
    {...props}
  />
));
TabsListUnderlined.displayName = "TabsListUnderlined";

const TabsTriggerUnderlined = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  if (!context)
    throw new Error("TabsTriggerUnderlined must be used within Tabs");

  const isActive = context.value === value;

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={isActive}
      onClick={() => context.onValueChange(value)}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center gap-2",
        "whitespace-nowrap",
        "px-4 py-3",
        "text-sm font-medium",
        "border-b-2 -mb-px",
        "transition-all duration-normal ease-out",
        // Focus state
        "focus-visible:outline-none",
        // Disabled state
        "disabled:pointer-events-none disabled:opacity-40",
        // Active/Inactive states
        isActive
          ? "border-primary text-text-primary"
          : "border-transparent text-text-secondary hover:text-text-primary",
        className,
      )}
      {...props}
    />
  );
});
TabsTriggerUnderlined.displayName = "TabsTriggerUnderlined";

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
};
