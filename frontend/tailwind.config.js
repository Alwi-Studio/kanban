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
        // AlwiNation brand — warm orange accent
        brand: {
          DEFAULT: "#FF5A30",
          50: "#FFF1EC",
          100: "#FFE0D5",
          200: "#FFB79E",
          300: "#FF9147",
          400: "#FF5A30",
          500: "#E8461D",
          600: "#C43A17",
          700: "#9E2E12",
          800: "#78230E",
          900: "#52170A",
        },
        purple: {
          brand: "#FF5A30",
        },
        "col-orange": "#F5A623",
        "col-green": "#2ECC71",
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#141418",
        },
        bg: {
          page: "#F5F6FA",
          dark: "#0b0b0e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
