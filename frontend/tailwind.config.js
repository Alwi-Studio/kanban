/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6C4EF5",
          50: "#EEEBFF",
          100: "#D4CCFF",
          200: "#B099FF",
          300: "#8B66FF",
          400: "#6C4EF5",
          500: "#5A3FD6",
          600: "#4A33B5",
          700: "#3A2894",
          800: "#2A1D73",
          900: "#1A1252",
        },
        purple: {
          brand: "#6C4EF5",
        },
        "col-orange": "#F5A623",
        "col-green": "#2ECC71",
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#1D2939",
        },
        bg: {
          page: "#F5F6FA",
          dark: "#101828",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
