import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        // Muay Thai niche palette
        muaythai: {
          50: '#fff1f1',
          100: '#ffe1e1',
          200: '#ffcaca',
          300: '#ff9f9f',
          400: '#ff6363',
          500: '#ff2e2e',
          600: '#e61010',
          700: '#c20a0a',
          800: '#9e0909',
          900: '#830f0f',
          950: '#470303',
        },
        // Fitness niche palette
        fitness: {
          50: '#f9f9f9',
          100: '#f0f0f0',
          200: '#e0e0e0',
          300: '#c0c0c0',
          400: '#9a9a9a',
          500: '#767676',
          600: '#5a5a5a',
          700: '#3e3e3e',
          800: '#1c1c1c',
          900: '#0e0e0e',
          950: '#060606',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
        heading: ['var(--font-oswald)', ...fontFamily.sans],
        mono: ['var(--font-mono)', ...fontFamily.mono],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        'pulse-glow-red': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(220,38,38,0.25)' },
          '50%': { boxShadow: '0 0 24px 6px rgba(220,38,38,0.55)' },
        },
        'pulse-glow-white': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(255,255,255,0.08)' },
          '50%': { boxShadow: '0 0 24px 6px rgba(255,255,255,0.20)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s ease-out both',
        'fade-in-left': 'fade-in-left 0.5s ease-out both',
        'fade-in-right': 'fade-in-right 0.5s ease-out both',
        'slide-in-bottom': 'slide-in-bottom 0.3s ease-out',
        shimmer: 'shimmer 2.2s linear infinite',
        'pulse-glow-red': 'pulse-glow-red 2.5s ease-in-out infinite',
        'pulse-glow-white': 'pulse-glow-white 2.5s ease-in-out infinite',
        float: 'float 3.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-muaythai':
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(153,27,27,0.35) 0%, transparent 75%)',
        'hero-fitness':
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,130,246,0.18) 0%, transparent 75%)',
        'card-gradient':
          'linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(220,38,38,0.30)',
        'glow-red-lg': '0 0 40px rgba(220,38,38,0.40)',
        'glow-white': '0 0 20px rgba(255,255,255,0.08)',
        card: '0 4px 24px rgba(0,0,0,0.45)',
        'card-hover': '0 16px 48px rgba(0,0,0,0.55)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
