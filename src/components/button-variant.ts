export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/**
 * design-spec 3.5. `danger` uses `text-bg-canvas`, not `text-accent-contrast`:
 * --color-danger is a light coral in the dark theme, so white text only reaches
 * ~2.7:1. --color-bg-canvas sits at the opposite lightness extreme in both
 * themes (near-black in dark, near-white in light), which is what clears 4.5:1
 * on both without a new token.
 */
export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover active:bg-accent-active',
  secondary:
    'border border-surface-border-strong text-primary hover:bg-surface-hover active:bg-surface-hover',
  ghost: 'text-primary hover:bg-surface-hover active:bg-surface-hover',
  danger: 'bg-danger text-bg-canvas hover:opacity-90 active:opacity-80',
}
