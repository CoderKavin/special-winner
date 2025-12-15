/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[class~="dark"]'],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Linear-inspired color palette using CSS variables for theme switching
      colors: {
        // Base colors - use CSS variables for theme switching
        background: "var(--bg-background)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          hover: "var(--bg-surface-hover)",
        },
        border: {
          DEFAULT: "var(--border-subtle)",
          subtle: "var(--border-subtle)",
          emphasis: "var(--border-emphasis)",
        },

        // Semantic colors
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--bg-surface)",
          foreground: "var(--text-primary)",
        },
        muted: {
          DEFAULT: "var(--bg-surface)",
          foreground: "var(--text-secondary)",
        },
        accent: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-critical)",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "var(--color-success)",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          foreground: "#000000",
        },
        critical: {
          DEFAULT: "var(--color-critical)",
          foreground: "#FFFFFF",
        },
        info: {
          DEFAULT: "var(--color-info)",
          foreground: "#FFFFFF",
        },

        // Text colors - use CSS variables for theme switching
        foreground: "var(--text-primary)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-disabled": "var(--text-disabled)",

        // Component colors
        input: "var(--border-subtle)",
        ring: "var(--color-primary)",
        popover: {
          DEFAULT: "var(--bg-surface-hover)",
          foreground: "var(--text-primary)",
        },
        card: {
          DEFAULT: "var(--bg-surface)",
          foreground: "var(--text-primary)",
        },

        // Subject colors
        math: {
          DEFAULT: "#4C9AFF",
          light: "#6CB0FF",
          dark: "#3B7FCC",
        },
        physics: {
          DEFAULT: "#9B59B6",
          light: "#B07CC6",
          dark: "#7C4792",
        },
        economics: {
          DEFAULT: "#27AE60",
          light: "#52C77E",
          dark: "#1F8B4D",
        },
        english: {
          DEFAULT: "#E67E22",
          light: "#EB9950",
          dark: "#B8641B",
        },
        history: {
          DEFAULT: "#E74C3C",
          light: "#EC7063",
          dark: "#B93D30",
        },
      },

      // Typography
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },

      fontSize: {
        display: [
          "32px",
          { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        h1: [
          "24px",
          { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        h2: ["20px", { lineHeight: "1.2", fontWeight: "600" }],
        h3: ["16px", { lineHeight: "1.2", fontWeight: "600" }],
        "body-lg": ["15px", { lineHeight: "1.5", fontWeight: "400" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: [
          "12px",
          { lineHeight: "1.5", letterSpacing: "0.01em", fontWeight: "500" },
        ],
      },

      // Spacing (4px base unit)
      spacing: {
        xs: "4px",
        sm: "8px",
        "md-sm": "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
      },

      // Border radius
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },

      // Box shadows
      boxShadow: {
        1: "0 1px 3px rgba(0, 0, 0, 0.2)",
        2: "0 2px 8px rgba(0, 0, 0, 0.2)",
        3: "0 4px 12px rgba(0, 0, 0, 0.25)",
        4: "0 8px 24px rgba(0, 0, 0, 0.3)",
        5: "0 12px 32px rgba(0, 0, 0, 0.35)",
        "card-hover": "0 4px 16px rgba(0, 0, 0, 0.25)",
        modal: "0 8px 32px rgba(0, 0, 0, 0.4)",
        dropdown: "0 4px 16px rgba(0, 0, 0, 0.3)",
      },

      // Transitions
      transitionDuration: {
        fast: "100ms",
        normal: "150ms",
        medium: "200ms",
        slow: "250ms",
      },

      // Animations
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-border": {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-3px)" },
          "75%": { transform: "translateX(3px)" },
        },
        "success-pulse": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "pulse-border": "pulse-border 1.5s ease-in-out infinite",
        shake: "shake 0.2s ease-in-out 3",
        "success-pulse": "success-pulse 0.3s ease-in-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "slide-out-right": "slide-out-right 0.25s ease-in",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
