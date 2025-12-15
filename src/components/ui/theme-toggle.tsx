import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center justify-center w-9 h-9 rounded-lg",
        "transition-colors duration-200",
        "hover:bg-gray-100 dark:hover:bg-surface-hover",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "dark:focus-visible:ring-offset-background"
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <motion.div
        initial={false}
        animate={{
          rotate: theme === "dark" ? 0 : 180,
          scale: 1,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative"
      >
        {theme === "dark" ? (
          <Moon className="h-5 w-5 text-text-secondary" />
        ) : (
          <Sun className="h-5 w-5 text-amber-500" />
        )}
      </motion.div>
    </button>
  );
}

export function ThemeToggleCompact() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 rounded-lg",
        "text-sm font-medium",
        "transition-colors duration-200",
        "hover:bg-gray-100 dark:hover:bg-surface-hover",
        "text-gray-700 dark:text-text-secondary"
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <>
          <Moon className="h-4 w-4" />
          <span>Dark</span>
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 text-amber-500" />
          <span>Light</span>
        </>
      )}
    </button>
  );
}
