const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: "#6366f1",
              foreground: "#ffffff",
            },
            focus: "#6366f1",
          },
        },
        dark: {
          colors: {
            primary: {
              DEFAULT: "#818cf8",
              foreground: "#000000",
            },
            focus: "#818cf8",
          },
        },
      },
    }),
    require("@tailwindcss/typography"),
  ],
}

