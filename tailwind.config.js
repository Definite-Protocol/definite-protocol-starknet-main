/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Aeonik Trial', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'aeonik': ['Aeonik Trial', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        'light': '300',
        'normal': '400',
        'bold': '700',
      }
    },
  },
  plugins: [],
};
