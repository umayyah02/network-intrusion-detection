import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-glow hover:brightness-110',
  ghost:
    'bg-transparent text-fg border border-line-strong hover:bg-accent-soft',
  danger: 'bg-sev-high text-accent-fg shadow-glow-danger hover:brightness-110',
}

const sizeClass: Record<Size, string> = {
  md: 'min-h-11 px-5 text-sm',
  sm: 'min-h-9 px-3 text-xs',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-sans font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  )
}
