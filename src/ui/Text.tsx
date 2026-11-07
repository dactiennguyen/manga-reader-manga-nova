import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodySmall' | 'label' | 'caption' | 'mono';

export type TextTone =
  | 'text'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'onAccent'
  | 'ai'
  | 'onAi'
  | 'danger'
  | 'success'
  | 'warning';

const VARIANT: Record<TextVariant, string> = {
  display: 'text-display font-inter-bold',
  title: 'text-title font-inter-semibold',
  heading: 'text-heading font-inter-semibold',
  body: 'text-body font-inter',
  bodySmall: 'text-body-sm font-inter',
  label: 'text-label font-inter-medium',
  caption: 'text-caption font-inter-medium',
  mono: 'text-mono font-inter-medium',
};

const TONE: Record<TextTone, string> = {
  text: 'text-text',
  secondary: 'text-text-secondary',
  muted: 'text-text-muted',
  accent: 'text-accent',
  onAccent: 'text-on-accent',
  ai: 'text-ai',
  onAi: 'text-on-ai',
  danger: 'text-danger',
  success: 'text-success',
  warning: 'text-warning',
};

export type TextProps = RNTextProps & { variant?: TextVariant; tone?: TextTone; className?: string };

export function Text({ variant = 'body', tone = 'text', className, style, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      className={`${VARIANT[variant]} ${TONE[tone]} ${className ?? ''}`}
      style={variant === 'mono' ? [{ fontVariant: ['tabular-nums'] }, style] : style}
    />
  );
}
