import { friendLink } from '../src/core/nearby/friendLink';
import { roomLink } from '../src/core/nearby/link';
import { qrMatrix } from '../src/core/nearby/qr';
import { QR_IMAGE_MAX_SIDE, classifyScan, qrImageScale, readQrPixels } from '../src/core/nearby/qrRead';

/** Draws a QR code the way a phone screen shows it: `scale` pixels per square and a quiet zone. */
function render(text: string, { scale = 6, quiet = 4, inverted = false } = {}) {
  const matrix = qrMatrix(text);
  const side = (matrix.size + quiet * 2) * scale;
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const row = Math.floor(y / scale) - quiet;
      const col = Math.floor(x / scale) - quiet;
      const inside = row >= 0 && col >= 0 && row < matrix.size && col < matrix.size;
      const dark = inside && matrix.dark(row, col);
      const value = dark !== inverted ? 20 : 240;
      const at = (y * side + x) * 4;
      rgba[at] = value;
      rgba[at + 1] = value;
      rgba[at + 2] = value;
      rgba[at + 3] = 255;
    }
  }
  return { rgba, side };
}

const room = roomLink({ host: '192.168.1.20', port: 40123, token: 'beef', name: 'Club night' });
const friend = friendLink({ id: 'abc123def456', name: 'Sakura 桜', stories: ['Tôi là mèo'] });

describe('reading a QR code from pixels', () => {
  it('reads a room link drawn dark on light', () => {
    const { rgba, side } = render(room);
    expect(readQrPixels(rgba, side, side)).toBe(room);
  });

  it('reads a friend card drawn light on dark, like a dark-theme screenshot', () => {
    const { rgba, side } = render(friend, { inverted: true });
    expect(readQrPixels(rgba, side, side)).toBe(friend);
  });

  it('accepts a plain Uint8Array, as Skia returns it', () => {
    const { rgba, side } = render(room);
    expect(readQrPixels(new Uint8Array(rgba.buffer), side, side)).toBe(room);
  });

  it('finds nothing in a blank image or a buffer of the wrong size', () => {
    const blank = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    expect(readQrPixels(blank, 100, 100)).toBeNull();
    expect(readQrPixels(blank, 200, 200)).toBeNull();
    expect(readQrPixels(blank, 0, 0)).toBeNull();
  });
});

describe('what a scanned code is', () => {
  it('tells a room link from a friend card', () => {
    expect(classifyScan(` ${room}\n`)).toEqual({ kind: 'room', url: room });
    expect(classifyScan(friend)).toEqual({ kind: 'friend', url: friend });
  });

  it('treats anything else as other, including broken links of ours', () => {
    expect(classifyScan('https://example.com')).toEqual({ kind: 'other', text: 'https://example.com' });
    expect(classifyScan('manganova://join?h=1.2.3.4').kind).toBe('other');
    expect(classifyScan('manganova://friend?d=***').kind).toBe('other');
  });
});

describe('scaling a photo before reading', () => {
  it('shrinks only photos larger than the limit, keeping the shape', () => {
    expect(qrImageScale(800, 600)).toBe(1);
    expect(qrImageScale(4000, 3000)).toBeCloseTo(QR_IMAGE_MAX_SIDE / 4000);
    expect(qrImageScale(1000, QR_IMAGE_MAX_SIDE * 2)).toBe(0.5);
  });
});
