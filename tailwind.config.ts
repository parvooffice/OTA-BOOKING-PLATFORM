import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f5f0e7",
        ink: "#2a211a",
        laterite: "#a64d37",
        turmeric: "#d4a23d",
        lagoon: "#4d817b",
        mahogany: "#39241c"
      },
      fontFamily: {
        base: ["var(--font-base)"],
        display: ["var(--font-base)"],
        sans: ["var(--font-base)"]
      }
    }
  },
  plugins: []
};

export default config;
