import * as React from "react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
  className?: string;
}

function Tooltip({
  children,
  content,
  side = "top",
  delayDuration = 500,
  className,
}: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delayDuration);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(false);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const animationVariants = {
    top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
    bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
    left: { initial: { opacity: 0, x: 4 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 } },
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={animationVariants[side].initial}
            animate={animationVariants[side].animate}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-50",
              "max-w-[240px]",
              "px-2.5 py-1.5",
              "rounded-md",
              "bg-surface-hover border border-border-emphasis",
              "shadow-dropdown",
              "text-caption text-text-primary",
              positionClasses[side],
              className,
            )}
          >
            {content}
            {/* Arrow */}
            <div
              className={cn(
                "absolute w-2 h-2 rotate-45",
                "bg-surface-hover border border-border-emphasis",
                side === "top" &&
                  "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-0 border-l-0",
                side === "bottom" &&
                  "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-0 border-r-0",
                side === "left" &&
                  "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-0 border-b-0",
                side === "right" &&
                  "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-0 border-t-0",
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple tooltip for icons/buttons
interface IconTooltipProps {
  children: React.ReactNode;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  shortcut?: string;
}

function IconTooltip({
  children,
  label,
  side = "top",
  shortcut,
}: IconTooltipProps) {
  return (
    <Tooltip
      content={
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-text-secondary text-[10px] font-mono">
              {shortcut}
            </kbd>
          )}
        </div>
      }
      side={side}
    >
      {children}
    </Tooltip>
  );
}

export { Tooltip, IconTooltip };
