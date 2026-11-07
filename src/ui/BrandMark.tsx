import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Brand art, the same in both themes, so these colours are not interface tokens. Source: assets/icon. */
const TILE = '#111214';
const PAGE = '#F1F2F4';
const ACCENT_FROM = '#8FB1FF';
const ACCENT_TO = '#4F7FF5';

const CROP = 18;
const VIEW = 108 - CROP * 2;

export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`${CROP} ${CROP} ${VIEW} ${VIEW}`} accessibilityLabel="Mangaka AI logo">
      <Defs>
        <LinearGradient id="brand-accent" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ACCENT_FROM} />
          <Stop offset="1" stopColor={ACCENT_TO} />
        </LinearGradient>
      </Defs>
      <Rect x={CROP} y={CROP} width={VIEW} height={VIEW} rx={16} fill={TILE} />
      <Path fill={PAGE} d="M36 24h36a6 6 0 0 1 6 6v17L30 59.500V30a6 6 0 0 1 6-6z" />
      <Path fill="url(#brand-accent)" d="M78 53.500V78a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6V66z" />
      <Ellipse cx={56} cy={36.5} rx={11} ry={6.8} fill={TILE} />
      <Path fill={TILE} d="M50 41l-3.500 7 9.500-5z" />
    </Svg>
  );
}
