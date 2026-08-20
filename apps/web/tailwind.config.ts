import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bio: {
          900: "#0a0f1a",
          800: "#111827",
          700: "#1a2332",
          600: "#243044",
          500: "#2d3d56",
          400: "#3b82f6",
          300: "#22d3ee",
          200: "#34d399",
          100: "#a7f3d0",
        },
      },
    },
  },
  plugins: [],
};
export default config;
