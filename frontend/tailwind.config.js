/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      // -----------------------------------------------------------------
      // Official PharmaTrack palette (final). Every brand, status, surface,
      // and background token resolves to one of these six approved colours
      // plus the neutral greyscale needed for borders, dividers and text.
      //
      //   Primary Blue  #3952A4  brand identity, sidebar, primary buttons
      //   Chart Blue    #3B82F6  charts, analytics, informational chips
      //   Success Green #1F8A4C  approved / completed / in-stock
      //   Warning Yellow#F2B900  pending / low stock / near expiry
      //   Danger Red    #EF4444  errors / expired / destructive
      //   Pure White    #FFFFFF  every page and card background
      //
      // No decorative colours, gradients or tinted page backgrounds beyond
      // the neutral greyscale for structural chrome.
      // -----------------------------------------------------------------
      colors: {
        brand: {
          primary: '#3952A4',
          'primary-dark': '#2D4283',
          'primary-light': '#5B70B6',
          chart: '#3B82F6',
          secondary: '#0F172A',
        },
        surface: {
          page: '#FFFFFF',
          panel: '#FFFFFF',
          muted: '#F3F4F6',
        },
        ink: {
          primary: '#0F172A',
          secondary: '#64748B',
          muted: '#94A3B8',
        },
        line: '#E5E7EB',
        status: {
          success: '#1F8A4C',
          warning: '#F2B900',
          danger: '#EF4444',
          info: '#3B82F6',
          'expiry-30': '#EF4444',
          'expiry-60': '#F2B900',
          'expiry-90': '#F2B900',
        },
      },
      boxShadow: {
        panel: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
        'panel-lg': '0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        panel: '0.75rem',
      },
      maxWidth: {
        '7xl': '80rem',
      },
    },
  },
  plugins: [],
};
