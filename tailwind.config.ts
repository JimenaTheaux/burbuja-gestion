import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:          '#3DD6B5',
        'primary-deep':   '#28B99A',
        'primary-soft':   '#E8FAF6',
        sky:              '#7EB8E8',
        'sky-soft':       '#EBF5FF',
        ink:              '#1C1C1E',
        'ink-mid':        '#3A3A3C',
        muted:            '#8E8E93',
        surface:          '#F5F7F9',
        card:             '#FFFFFF',
        border:           '#E5E5EA',
        error:            '#F05252',
        'error-bg':       '#FEF2F2',
        warning:          '#C47B00',
        'warning-bg':     '#FFFDE7',
        'warning-border': '#FDE68A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
    },
  },
  plugins: [],
}

export default config
