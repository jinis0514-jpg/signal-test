import animate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
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

        'brand': 'rgb(var(--brand-primary) / <alpha-value>)',
        'brand-hover': 'rgb(var(--brand-primary-hover) / <alpha-value>)',
        'brand-active': 'rgb(var(--brand-primary-active) / <alpha-value>)',
        'brand-soft': 'rgb(var(--brand-primary-soft) / <alpha-value>)',

        'bg-base': 'rgb(var(--bg-base) / <alpha-value>)',
        'bg-surface-1': 'rgb(var(--bg-surface-1) / <alpha-value>)',
        'bg-surface-2': 'rgb(var(--bg-surface-2) / <alpha-value>)',
        'bg-surface-3': 'rgb(var(--bg-surface-3) / <alpha-value>)',

        'border-default': 'rgb(var(--border-default) / var(--border-default-alpha))',
        'border-strong': 'rgb(var(--border-strong) / var(--border-strong-alpha))',
        'border-subtle': 'rgb(var(--border-subtle) / var(--border-subtle-alpha))',

        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--text-tertiary) / <alpha-value>)',
        'text-disabled': 'rgb(var(--text-disabled) / <alpha-value>)',

        'long': 'rgb(var(--long) / <alpha-value>)',
        'short': 'rgb(var(--short) / <alpha-value>)',
        'success': 'rgb(var(--success) / <alpha-value>)',
        'warning': 'rgb(var(--warning) / <alpha-value>)',
        'danger': 'rgb(var(--danger) / <alpha-value>)',
        'info': 'rgb(var(--info) / <alpha-value>)',
        'verified': 'rgb(var(--verified) / <alpha-value>)',
        'badge-hot': 'rgb(var(--badge-hot) / <alpha-value>)',
        'badge-best': 'rgb(var(--badge-best) / <alpha-value>)',
        'badge-live': 'rgb(var(--badge-live) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
}
