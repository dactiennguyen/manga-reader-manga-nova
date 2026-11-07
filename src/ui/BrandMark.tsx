import Svg, { G, Path, Rect } from 'react-native-svg';

/** Brand art, the same in both themes, so these colours are not interface tokens. Source: assets/icon. */
const TILE = '#F15A3C';
const PAPER = '#F6EFE3';

const MARK =
  'M864 180L863 407 647 664 649 505 494 819 351 506 339 800 137 864 166 244 408 182 517 483 630 242Z M866 472L880 793 626 867 645 677Z';

export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="App logo">
      <Rect width={1024} height={1024} rx={228} fill={TILE} />
      <G transform="translate(512 512) scale(.92) translate(-508.5 -523.5)">
        <Path fill={PAPER} d={MARK} />
      </G>
    </Svg>
  );
}
