/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        tech: {
          900: '#0b1220',
          800: '#121c2f',
          700: '#1d2e4a',
          500: '#3b82f6',
          400: '#60a5fa',
          300: '#93c5fd',
          100: '#dbeafe',
        },
      },
    },
  },
  plugins: [],
}
