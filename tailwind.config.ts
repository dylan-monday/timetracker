import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f6f3",
        panel: "#fbfcf9",
        ink: "#111318",
        muted: "#6f7380",
        accent: "#84e178",
        accentStrong: "#58c857",
        warning: "#f4c760",
        danger: "#f07b7b"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      boxShadow: {
        soft: "0 2px 20px rgba(17, 19, 24, 0.07)"
      }
    }
  },
  plugins: []
};

export default config;
