/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        hide: {
          "0%, 100%": { opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 1s ease-in",
        "delayed-fade-in":
          "hide 0s, fade-in 2s ease-in 250ms 1 normal forwards",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
