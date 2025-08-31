/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        tetris: {
          cyan: '#00FFFF',
          yellow: '#FFFF00',
          purple: '#800080',
          orange: '#FFA500',
          blue: '#0000FF',
          green: '#00FF00',
          red: '#FF0000',
          gray: '#808080',
        }
      }
    },
  },
  plugins: [],
}
