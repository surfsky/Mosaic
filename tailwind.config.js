/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Avenir Next', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 10px 40px rgba(15, 23, 42, 0.15)',
      },
    },
  },
  daisyui: {
    themes: [
      {
        mosaic: {
          primary: '#0ea5a4',
          secondary: '#f97316',
          accent: '#14b8a6',
          neutral: '#1f2937',
          'base-100': '#f8fafc',
          'base-200': '#edf2f7',
          'base-300': '#d9e2ec',
          info: '#0ea5e9',
          success: '#16a34a',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
    ],
  },
  plugins: [require('daisyui')],
}
