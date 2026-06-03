/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060C18',
          900: '#0A0F1E',
          800: '#0D1526',
          700: '#1B2A4A',
          600: '#243659',
        },
        cyan: {
          brand: '#2DD4BF',
        },
        lavender: {
          400: '#7B8CDE',
          300: '#9BA8E8',
        },
        ice: {
          100: '#E8EDF7',
          200: '#C8D0E4',
          300: '#A8B2C8',
          400: '#7B8699',
          500: '#5A6477',
          600: '#3D4A5C',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        ui: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-cyan-fade': 'linear-gradient(90deg, rgba(45,212,191,0.15) 0%, transparent 100%)',
      },
    },
  },
  plugins: [],
}