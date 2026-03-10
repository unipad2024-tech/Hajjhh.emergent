/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "sans-serif"],
        arabic: ["Cairo", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#5B0E14",
          dark: "#2A0409",
          light: "#7D1A22",
          foreground: "#F1E194",
        },
        secondary: {
          DEFAULT: "#F1E194",
          dark: "#C5B358",
          light: "#F9F2C5",
          foreground: "#2A0409",
        },
        background: {
          DEFAULT: "#FDF6E3",
          cream: "#FAF3E0",
          dark: "#2A0409",
        },
        gold: "#F1E194",
        burgundy: "#5B0E14",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 15px rgba(241,225,148,0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(241,225,148,0.7)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.88)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(40px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "score-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.5)" },
          "100%": { transform: "scale(1)" },
        },
        "winner-glow": {
          "0%,100%": { textShadow: "0 0 20px rgba(241,225,148,0.5)" },
          "50%": { textShadow: "0 0 60px rgba(241,225,148,1), 0 0 100px rgba(241,225,148,0.5)" },
        },
        "countdown-flash": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        "slide-up": "slide-up 0.4s ease-out both",
        "score-pop": "score-pop 0.5s ease-out",
        "winner-glow": "winner-glow 1.5s ease-in-out infinite",
        "countdown": "countdown-flash 0.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
