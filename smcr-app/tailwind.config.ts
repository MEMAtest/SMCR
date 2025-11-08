import type { Config } from "tailwindcss";
import tokens from "./design/tokens.json";

const spacingScale = Object.fromEntries(
  Object.entries(tokens.spacing).map(([key, value]) => [key, `${value}px`])
);

const radiiScale = Object.fromEntries(
  Object.entries(tokens.radii).map(([key, value]) => [key, `${value}px`])
);

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ...tokens.colors,
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      spacing: {
        ...spacingScale,
      },
      borderRadius: {
        ...radiiScale,
      },
      boxShadow: {
        ...tokens.shadows,
      },
    },
  },
  plugins: [],
};
export default config;
