import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg) / <alpha-value>)",
        "bg-subtle": "hsl(var(--bg-subtle) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        text: "hsl(var(--text) / <alpha-value>)",
        "text-muted": "hsl(var(--text-muted) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-2": "hsl(var(--accent-2) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)"
      },
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      boxShadow: {
        soft: "0 18px 50px -30px rgba(8, 6, 4, 0.7)",
        glow: "0 0 0 1px rgba(255, 255, 255, 0.04), 0 20px 60px -40px rgba(228, 181, 129, 0.7)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.06)"
      },
      borderRadius: {
        xl: "20px",
        "2xl": "28px"
      }
    }
  },
  plugins: []
};

export default config;
