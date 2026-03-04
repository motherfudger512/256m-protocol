import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0edff",
          100: "#e0d9ff",
          200: "#c1b3ff",
          300: "#9680ff",
          400: "#6b4dff",
          500: "#3310ff",
          600: "#2a0dd6",
          700: "#2309ad",
          800: "#1b0784",
          900: "#13055c",
          950: "#0b0338",
        },
      },
    },
  },
  plugins: [],
};

export default config;
