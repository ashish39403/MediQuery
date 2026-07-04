/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 35px rgba(37, 42, 76, 0.06)',
        soft: '0 6px 20px rgba(96, 72, 232, 0.14)',
      },
      colors: {
        ink: '#16182f',
        muted: '#6d718c',
        primary: '#6746e8',
      },
    },
  },
  plugins: [],
};

