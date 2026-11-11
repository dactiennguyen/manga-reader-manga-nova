/**
 * The dark squares of a QR code, from the `qrcode` encoder's core (pure JS, so no canvas or native
 * code). Drawn by src/ui/QrCode.tsx with react-native-svg.
 */
import { create } from 'qrcode/lib/core/qrcode';

export type QrMatrix = { size: number; dark: (row: number, col: number) => boolean };

/** Medium error correction: still scans with a thumb over a corner, and keeps the code small. */
export function qrMatrix(text: string): QrMatrix {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, dark: (row, col) => modules.data[row * modules.size + col] === 1 };
}

/** One SVG path for all dark squares, each as a 1×1 box, offset by the quiet zone. */
export function qrPath(matrix: QrMatrix, quiet = 2): string {
  let path = '';
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.dark(row, col)) {
        path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }
  return path;
}
