/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius-card)',
  			md: 'var(--radius-input)',
  			sm: 'var(--radius-input)',
  			card: 'var(--radius-card)',
  			input: 'var(--radius-input)',
  			pill: 'var(--radius-pill)'
  		},
  		spacing: {
  			gutter: 'var(--space-gutter)',
  			tap: 'var(--space-tap)',
  			action: 'var(--space-action)',
  			bar: 'var(--space-bar)'
  		},
  		maxWidth: {
  			study: '560px'
  		},
  		minHeight: {
  			card: '320px'
  		},
  		fontSize: {
  			display: ['40px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
  			title: ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
  			body: ['17px', { lineHeight: '26px', fontWeight: '400' }],
  			label: ['12px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
  			meta: ['14px', { lineHeight: '20px', fontWeight: '400' }],
  			placeholder: ['15px', { lineHeight: '22px', fontWeight: '400' }]
  		},
  		colors: {
  			background: 'rgb(var(--c-bg) / <alpha-value>)',
  			foreground: 'rgb(var(--c-text) / <alpha-value>)',
  			surface: {
  				1: 'rgb(var(--c-surface-1) / <alpha-value>)',
  				2: 'rgb(var(--c-surface-2) / <alpha-value>)'
  			},
  			tertiary: 'rgb(var(--c-text-3) / <alpha-value>)',
  			card: {
  				DEFAULT: 'rgb(var(--c-surface-1) / <alpha-value>)',
  				foreground: 'rgb(var(--c-text) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'rgb(var(--c-surface-2) / <alpha-value>)',
  				foreground: 'rgb(var(--c-text) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
  				foreground: 'rgb(var(--c-accent-ink) / <alpha-value>)'
  			},
  			secondary: {
  				DEFAULT: 'rgb(var(--c-surface-2) / <alpha-value>)',
  				foreground: 'rgb(var(--c-text) / <alpha-value>)'
  			},
  			muted: {
  				DEFAULT: 'rgb(var(--c-surface-2) / <alpha-value>)',
  				foreground: 'rgb(var(--c-text-2) / <alpha-value>)'
  			},
  			accent: {
  				DEFAULT: 'rgb(var(--c-surface-2) / <alpha-value>)',
  				foreground: 'rgb(var(--c-text) / <alpha-value>)'
  			},
  			destructive: {
  				DEFAULT: 'rgb(var(--c-blank) / <alpha-value>)',
  				foreground: 'rgb(var(--c-text) / <alpha-value>)'
  			},
  			know: 'rgb(var(--c-know) / <alpha-value>)',
  			shaky: 'rgb(var(--c-shaky) / <alpha-value>)',
  			blank: 'rgb(var(--c-blank) / <alpha-value>)',
  			gain: {
  				DEFAULT: 'rgb(var(--c-know) / <alpha-value>)',
  				soft: 'rgb(var(--c-know) / 0.12)'
  			},
  			loss: {
  				DEFAULT: 'rgb(var(--c-blank) / <alpha-value>)',
  				soft: 'rgb(var(--c-blank) / 0.12)'
  			},
  			border: 'rgb(var(--c-line) / 0.08)',
  			input: 'rgb(var(--c-line) / 0.08)',
  			ring: 'rgb(var(--c-accent) / <alpha-value>)',
  			chart: {
  				'1': 'rgb(var(--c-accent) / <alpha-value>)',
  				'2': 'rgb(var(--c-know) / <alpha-value>)',
  				'3': 'rgb(var(--c-shaky) / <alpha-value>)',
  				'4': 'rgb(var(--c-blank) / <alpha-value>)',
  				'5': 'rgb(var(--c-text-2) / <alpha-value>)'
  			},
  			sidebar: {
  				DEFAULT: 'rgb(var(--c-bg) / <alpha-value>)',
  				foreground: 'rgb(var(--c-text) / <alpha-value>)',
  				primary: 'rgb(var(--c-accent) / <alpha-value>)',
  				'primary-foreground': 'rgb(var(--c-accent-ink) / <alpha-value>)',
  				accent: 'rgb(var(--c-surface-2) / <alpha-value>)',
  				'accent-foreground': 'rgb(var(--c-text) / <alpha-value>)',
  				border: 'rgb(var(--c-line) / 0.08)',
  				ring: 'rgb(var(--c-accent) / <alpha-value>)'
  			}
  		},
  		fontFamily: {
  			heading: ['var(--font-body)'],
  			body: ['var(--font-body)'],
  			display: ['var(--font-body)'],
  			sans: ['var(--font-body)'],
  			mono: ['var(--font-mono)']
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			'reveal-in': {
  				from: { opacity: '0', transform: 'translateY(8px)' },
  				to: { opacity: '1', transform: 'none' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'reveal-in': 'reveal-in 180ms ease-out both'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
