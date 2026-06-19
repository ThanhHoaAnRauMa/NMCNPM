/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
        display: ['Georgia', 'Times New Roman', 'serif'],
      },
      colors: {
        ink: '#08111f',
        panel: '#0d1929',
        line: '#23334a',
        paper: '#edf2f4',
        amber: '#f0b35a',
        mint: '#6dd3b2',
      },
      boxShadow: {
        glow: '0 0 40px rgba(109, 211, 178, 0.12)',
      },
    },
  },
  plugins: [],
}
