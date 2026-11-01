import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1F2A44",
        accent: "#F97316",
        // Darker orange for text on white (the main orange is too light to read).
        "accent-dark": "#C2410C",
      },
    },
  },
  plugins: [],
};

export default config;
