/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        secondary: '#475569',
      },
      fontFamily: {
        sans: ['Inter', 'Public Sans', 'Pyidaungsu', 'Myanmar Text', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
