/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '7xl': ['72px', { lineHeight: '1.05', letterSpacing: '-0.04em' }],
        '6xl': ['60px', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
        '5xl': ['48px', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        '4xl': ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        '3xl': ['30px', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        '2xl': ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'xl':  ['20px', { lineHeight: '1.4', letterSpacing: '-0.005em' }],
        'lg':  ['18px', { lineHeight: '1.5' }],
        'base':['16px', { lineHeight: '1.6' }],
        'sm':  ['14px', { lineHeight: '1.5' }],
        'xs':  ['13px', { lineHeight: '1.5' }],
        '2xs': ['11px', { lineHeight: '1.4' }],
      },
      colors: {
        accent: {
          DEFAULT: '#4F46E5',
          hover:   '#4338CA',
          light:   '#EEF2FF',
          'light-dark': '#1e1b4b',
        },
        ink: {
          DEFAULT: '#0A0A0A',
          muted:   '#6B6B6B',
          faint:   '#AAAAAA',
          line:    '#E5E5E5',
        },
        night: {
          DEFAULT: '#F5F5F5',
          muted:   '#888888',
          faint:   '#444444',
          line:    '#2A2A2A',
        },
        canvas: {
          DEFAULT: '#FFFFFF',
          1:       '#F8F8F8',
          2:       '#F0F0F0',
          dark:    '#0A0A0A',
          'dark-1':'#141414',
          'dark-2':'#1E1E1E',
          'dark-3':'#252525',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        sm:      '6px',
        md:      '10px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '20px',
        full:    '9999px',
      },
      boxShadow: {
        'glass': '0 0 0 1px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.06)',
        'glass-dark': '0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)',
        'float':  '0 8px 40px rgba(0,0,0,0.12)',
        'none':   'none',
      },
      animation: {
        'fade-up':       'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in':       'fadeIn 0.2s ease forwards',
        'slide-left':    'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'modal-in':      'modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shake':         'shake 0.4s ease',
        'storage-fill':  'storageFill 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-accent':  'pulseAccent 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        modalIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        storageFill: {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--storage-pct)' },
        },
        pulseAccent: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
