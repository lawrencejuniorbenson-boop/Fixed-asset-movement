/** @type {import('tailwindcss').Config} */

// Brand palette: blue-black (navy), royal blue and white.
// `blue` is replaced by a royal-blue scale (500 = royal blue #4169E1) and the
// darkest `slate` steps lean blue-black, so every page picks up the brand.
const royal = {
  50: '#eef2fd',
  100: '#dde5fb',
  200: '#bccbf7',
  300: '#93aaf0',
  400: '#6787e8',
  500: '#4169e1',
  600: '#2a51d1',
  700: '#2142ab',
  800: '#1c378a',
  900: '#1a316f',
  950: '#111f47'
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        blue: royal,
        primary: royal,
        navy: {
          600: '#2a3d72',
          700: '#1f305e',
          800: '#16244b',
          900: '#0f1a38',
          950: '#0a1229'
        },
        slate: {
          50: '#f4f6fb',
          800: '#1b2747',
          900: '#0f1a38',
          950: '#0a1229'
        }
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(10, 18, 41, 0.04)',
        xs: '0 1px 2px 0 rgba(10, 18, 41, 0.06)',
        card: '0 1px 2px rgba(10, 18, 41, 0.05), 0 4px 12px -4px rgba(10, 18, 41, 0.06)'
      }
    }
  },
  plugins: []
}
