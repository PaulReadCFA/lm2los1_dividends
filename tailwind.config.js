/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: { "cfa-blue": "#4476FF", "cfa-dark": "#06005A" },
      fontFamily: { georgia: ["Georgia","serif"], arial: ["Arial","sans-serif"] },
    },
  },
  plugins: [],
};
