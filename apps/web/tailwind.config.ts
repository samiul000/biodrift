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
        // Material You (M3) dark scheme, green/emerald seed
        primary: "#7adda4",
        "on-primary": "#00391e",
        "primary-container": "#00522d",
        "on-primary-container": "#96f7bd",
        secondary: "#b1ccba",
        tertiary: "#9fd0da",
        surface: "#0f1512",
        "surface-container-lowest": "#0a100e",
        "surface-container-low": "#171d1a",
        "surface-container": "#1b211f",
        "surface-container-high": "#262c29",
        "surface-container-highest": "#313734",
        "on-surface": "#dee5df",
        "on-surface-variant": "#bec9c1",
        outline: "#88938c",
        "outline-variant": "#3f4943",
      },
    },
  },
  plugins: [],
};
export default config;
