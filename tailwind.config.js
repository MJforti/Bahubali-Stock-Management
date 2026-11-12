/** @type {import('tailwindcss').Config} */
// Dark-only "hardware counter" theme: graphite neutrals, one amber accent,
// toned semantic green/red. `slate` is remapped to the graphite ramp so every
// surface in the app stays neutral.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f4f4f5',
          100: '#ededed', // primary text
          200: '#d6d6d9',
          300: '#bdbdc2',
          400: '#a1a1a6', // secondary text
          500: '#85858b', // muted text, icons
          600: '#5f5f65',
          700: '#38383c', // strong hairline / control border
          800: '#29292c', // hairline, raised edge
          850: '#202022', // raised surface
          900: '#19191b', // card
          950: '#111112'  // deepest surface
        },
        emerald: {
          300: '#7fd6a9', 400: '#4cc38a', 500: '#3aa874', 600: '#2f8a5f', 700: '#256b4a',
          800: '#1c4d36', 900: '#143526', 950: '#0d2219'
        },
        rose: {
          300: '#f08b8e', 400: '#e5484d', 500: '#d63a40', 600: '#b52f34', 700: '#8f2529',
          800: '#661b1e', 900: '#451315', 950: '#2a0b0c'
        },
        red: {
          300: '#f08b8e', 400: '#e5484d', 500: '#d63a40', 600: '#b52f34', 900: '#451315', 950: '#2a0b0c'
        }
      },
      fontVariantNumeric: {},
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      transitionDuration: {
        DEFAULT: '150ms'
      }
    }
  },
  plugins: []
};
