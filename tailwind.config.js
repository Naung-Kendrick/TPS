/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Public Sans', 'Pyidaungsu', 'Myanmar Text', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
