/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{ts,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Space Mono', 'monospace'],
        heading: ['Bebas Neue', 'system-ui', 'sans-serif']
      },
      colors: {
        brutal: {
          black: '#000000',
          white: '#FFFFFF',
          yellow: '#FFFF00',
          red: '#FF0000',
          blue: '#0000FF',
          green: '#00FF00',
          cyan: '#00FFFF'
        }
      }
    },
  },
  plugins: [],
}
