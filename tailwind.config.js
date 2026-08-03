/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15151f',
        // forest/coral/sage are the brand accent. They resolve from CSS variables so
        // the participant side can be re-themed per client; the defaults below (set in
        // index.css) equal the original NGG hexes, so the admin side is unchanged.
        forest: 'rgb(var(--c-forest) / <alpha-value>)',
        sage: 'rgb(var(--c-sage) / <alpha-value>)',
        cream: '#f4f4f6',
        coral: 'rgb(var(--c-coral) / <alpha-value>)',
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
