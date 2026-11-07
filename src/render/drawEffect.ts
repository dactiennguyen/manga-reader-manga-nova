import { Skia, TileMode, type SkCanvas } from '@shopify/react-native-skia';

import type { PanelShape } from '../core/layout/layout';
import { seededRandom } from '../core/lettering/bubbles';
import type { Effect } from '../core/model/types';
import { INK } from './ink';

export function drawEffect(canvas: SkCanvas, effect: Effect, shape: PanelShape): void {
  const bb = shape.bbox;
  const rand = seededRandom(effect.id);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(INK));
  paint.setAlphaf(effect.opacity);
  const diag = Math.hypot(bb.w, bb.h);
  const cx = bb.x + bb.w * effect.cx;
  const cy = bb.y + bb.h * effect.cy;

  if (effect.type === 'speed') {
    const builder = Skia.PathBuilder.Make();
    const count = Math.round(18 + effect.density * 90);
    for (let i = 0; i < count; i++) {
      const offset = (rand() - 0.5) * diag;
      const start = (rand() - 0.5) * diag * 0.9;
      const length = diag * (0.15 + rand() * 0.5);
      const width = 1 + rand() * 5;
      builder.moveTo(start, offset - width / 2);
      builder.lineTo(start + length, offset);
      builder.lineTo(start, offset + width / 2);
      builder.close();
    }
    canvas.save();
    canvas.translate(bb.x + bb.w / 2, bb.y + bb.h / 2);
    canvas.rotate(effect.angle, 0, 0);
    canvas.drawPath(builder.build(), paint);
    canvas.restore();
    return;
  }

  if (effect.type === 'focus') {
    const builder = Skia.PathBuilder.Make();
    const count = Math.round(40 + effect.density * 160);
    const inner = Math.min(bb.w, bb.h) * 0.3;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.04;
      const spread = 0.004 + rand() * 0.012;
      const r0 = inner * (0.8 + rand() * 0.7);
      builder.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      builder.lineTo(cx + Math.cos(angle - spread) * diag, cy + Math.sin(angle - spread) * diag);
      builder.lineTo(cx + Math.cos(angle + spread) * diag, cy + Math.sin(angle + spread) * diag);
      builder.close();
    }
    canvas.drawPath(builder.build(), paint);
    return;
  }

  if (effect.type === 'tone') {
    const builder = Skia.PathBuilder.Make();
    const gap = 11;
    const r = 1.2 + effect.density * 3.4;
    let row = 0;
    for (let y = bb.y; y <= bb.y + bb.h; y += gap * 0.866, row++) {
      for (let x = bb.x + (row % 2 ? gap / 2 : 0); x <= bb.x + bb.w; x += gap) {
        builder.addCircle(x, y, r);
      }
    }
    canvas.drawPath(builder.build(), paint);
    return;
  }

  if (effect.type === 'gradient') {
    const rad = (effect.angle * Math.PI) / 180;
    const dx = (Math.cos(rad) * bb.w) / 2;
    const dy = (Math.sin(rad) * bb.h) / 2;
    const strength = 0.35 + effect.density * 0.65;
    paint.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(bb.x + bb.w / 2 - dx, bb.y + bb.h / 2 - dy),
        Skia.Point(bb.x + bb.w / 2 + dx, bb.y + bb.h / 2 + dy),
        [Skia.Color('rgba(22,22,26,0)'), Skia.Color(`rgba(22,22,26,${strength})`)],
        null,
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(Skia.XYWHRect(bb.x, bb.y, bb.w, bb.h), paint);
    return;
  }

  const builder = Skia.PathBuilder.Make();
  const count = Math.round(6 + effect.density * 34);
  for (let i = 0; i < count; i++) {
    const x = bb.x + rand() * bb.w;
    const y = bb.y + rand() * bb.h;
    const r = 8 + rand() * 26;
    const k = r * 0.18;
    builder.moveTo(x, y - r);
    builder.quadTo(x + k, y - k, x + r, y);
    builder.quadTo(x + k, y + k, x, y + r);
    builder.quadTo(x - k, y + k, x - r, y);
    builder.quadTo(x - k, y - k, x, y - r);
    builder.close();
  }
  canvas.drawPath(builder.build(), paint);
}
