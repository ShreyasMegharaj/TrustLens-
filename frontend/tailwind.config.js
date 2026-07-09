/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Kalam", "cursive"],
        body:    ["Patrick Hand", "cursive"],
        sans:    ["Patrick Hand", "cursive"],
        mono:    ["Patrick Hand", "cursive"],
      },
      colors: {
        paper:   "#fdfbf7",
        ink:     "#2d2d2d",
        muted:   "#e5e0d8",
        faint:   "#c8c0b4",
        brand: {
          DEFAULT: "#2d5da1",
          light:   "#4a7bc8",
          dark:    "#1e3f70",
        },
        accent:  "#ff4d4d",
        risk: {
          low:    "#2d7a4f",
          medium: "#b45309",
          high:   "#c0392b",
        },
        note: {
          yellow: "#fff9c4",
          blue:   "#dbeafe",
          green:  "#d1fae5",
          red:    "#fee2e2",
        },
      },
      boxShadow: {
        "hard":    "4px 4px 0 #2d2d2d",
        "hard-sm": "2px 2px 0 #2d2d2d",
        "hard-lg": "6px 6px 0 #2d2d2d",
        "hard-red":    "4px 4px 0 #c0392b",
        "hard-green":  "4px 4px 0 #2d7a4f",
        "hard-amber":  "4px 4px 0 #b45309",
        "hard-blue":   "4px 4px 0 #2d5da1",
        "inset":   "inset 2px 2px 0 rgba(0,0,0,0.08)",
      },
      borderRadius: {
        "blob":  "30% 70% 70% 30% / 30% 30% 70% 70%",
        "note":  "4px 12px 4px 4px",
        "stamp": "50%",
      },
      backgroundImage: {
        "paper-grain": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-out",
        "slide-up":   "slideUp 0.35s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "wobble":     "wobble 0.5s ease-in-out",
        "stamp":      "stamp 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        wobble:  {
          "0%":   { transform: "rotate(0deg)" },
          "25%":  { transform: "rotate(-2deg)" },
          "75%":  { transform: "rotate(2deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        stamp: {
          from: { opacity: "0", transform: "scale(1.4) rotate(-8deg)" },
          to:   { opacity: "1", transform: "scale(1) rotate(-4deg)" },
        },
      },
    },
  },
  plugins: [],
};
