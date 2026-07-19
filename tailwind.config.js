/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15151f',
        forest: '#ec2a8c',
        sage: '#fdeef6',
        cream: '#f4f4f6',
        coral: '#d11e78',
      },
      boxShadow: {
        card: '0 2px 4px rgba(8, 8, 16, 0.06), 0 6px 16px rgba(8, 8, 16, 0.10)',
      },
      fontFamily: {
        sans: ['Heebo', 'Assistant', 'Segoe UI', 'Arial Hebrew', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
