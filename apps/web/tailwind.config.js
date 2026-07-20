/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C9952A',
          light: '#F5C842',
          dark: '#7A5010',
        },
        chrome: {
          DEFAULT: '#D4DCE8',
          muted: '#8A94A4',
        },
        ink: {
          DEFAULT: '#080808',
          2: '#111111',
          3: '#181818',
          4: '#1f1f1f',
        },
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        raj: ['var(--font-rajdhani)', 'sans-serif'],
        sans: ['var(--font-dm)', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 40px rgba(201,149,42,0.25)',
      },
    },
  },
  plugins: [],
};
