import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / .08), 0 1px 2px -1px rgb(0 0 0 / .06)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / .10), 0 2px 4px -1px rgb(0 0 0 / .08)",
        dropdown: "0 8px 24px 0 rgb(0 0 0 / .12), 0 2px 8px 0 rgb(0 0 0 / .08)",
      },
    },
  },
  plugins: [],
};

export default config;
