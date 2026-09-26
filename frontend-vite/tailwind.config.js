/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oscuro: '#000000',
        dorado: '#d4af37',
        'verde-pastel': '#A7F3D0', 
        'rosado-pastel': '#f9c5c5'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}