/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          dark: '#1e293b',
          accent: '#f59e0b'
        },
        hardware: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          amber: '#f59e0b',
          blue: '#0284c7',
          green: '#10b981',
          red: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
