import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { qrMatrix, qrPath } from '../core/nearby/qr';
import { useColor } from './tokens';

const QUIET = 2;

/**
 * A scannable QR code. Always dark ink on cream paper, in both themes, because phone cameras read
 * light-on-dark codes badly.
 */
export function QrCode({ value, size, accessibilityLabel }: { value: string; size: number; accessibilityLabel: string }) {
  const paper = useColor('paper');
  const ink = useColor('on-paper');
  const { path, box } = useMemo(() => {
    const matrix = qrMatrix(value);
    return { path: qrPath(matrix, QUIET), box: matrix.size + QUIET * 2 };
  }, [value]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} className="overflow-hidden rounded-md">
      <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
        <Rect x={0} y={0} width={box} height={box} fill={paper} />
        <Path d={path} fill={ink} />
      </Svg>
    </View>
  );
}
