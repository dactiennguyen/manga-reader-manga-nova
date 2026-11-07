export type Box = { x: number; y: number; w: number; h: number };
export type Offset = { x: number; y: number };
export type ItemSize = { w: number; h: number };
export type GridSpec = { width: number; pad: number; gap: number; columns: number; firstSolo: boolean; rtl: boolean };
export type DropSlot = { section: number; index: number };

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  'worklet';
  const next = [...list];
  if (from < 0 || from >= next.length) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(0, to), next.length), 0, item);
  return next;
}

export function gridBoxes(sizes: readonly ItemSize[], spec: GridSpec): Box[] {
  'worklet';
  const columns = Math.max(1, Math.floor(spec.columns));
  const out: Box[] = [];
  let y = spec.pad;
  let start = 0;
  while (start < sizes.length) {
    const count = Math.min(spec.firstSolo && start === 0 ? 1 : columns, sizes.length - start);
    let rowW = 0;
    let rowH = 0;
    for (let i = start; i < start + count; i++) {
      rowW += sizes[i].w;
      rowH = Math.max(rowH, sizes[i].h);
    }
    let x = (spec.width - rowW) / 2;
    for (let i = start; i < start + count; i++) {
      const size = sizes[i];
      out.push({ x: spec.rtl ? spec.width - x - size.w : x, y, w: size.w, h: size.h });
      x += size.w;
    }
    y += rowH + spec.gap;
    start += count;
  }
  return out;
}

export function nearestIndex(boxes: readonly Box[], x: number, y: number): number {
  'worklet';
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const dx = box.x + box.w / 2 - x;
    const dy = box.y + box.h / 2 - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

export function previewOffsets(sizes: readonly ItemSize[], spec: GridSpec, from: number, to: number): Offset[] {
  'worklet';
  const base = gridBoxes(sizes, spec);
  if (from === to || from < 0 || from >= sizes.length || to < 0 || to >= sizes.length) {
    return base.map(() => ({ x: 0, y: 0 }));
  }
  const order = moveItem(
    sizes.map((_, index) => index),
    from,
    to,
  );
  const moved = gridBoxes(
    order.map(index => sizes[index]),
    spec,
  );
  const out: Offset[] = base.map(() => ({ x: 0, y: 0 }));
  for (let position = 0; position < order.length; position++) {
    const original = order[position];
    out[original] = { x: moved[position].x - base[original].x, y: moved[position].y - base[original].y };
  }
  return out;
}

export function insertionIndex(boxes: readonly Box[], y: number): number {
  'worklet';
  let index = 0;
  for (let i = 0; i < boxes.length; i++) {
    if (y > boxes[i].y + boxes[i].h / 2) {
      index = i + 1;
    }
  }
  return index;
}

export function nearestSection(zones: readonly Box[], x: number, y: number): number {
  'worklet';
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    const dx = Math.max(zone.x - x, 0, x - (zone.x + zone.w));
    const dy = Math.max(zone.y - y, 0, y - (zone.y + zone.h));
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

export function locateIn<T>(sections: readonly (readonly T[])[], item: T): DropSlot | null {
  for (let section = 0; section < sections.length; section++) {
    const index = sections[section].indexOf(item);
    if (index >= 0) {
      return { section, index };
    }
  }
  return null;
}

export function moveAcross<T>(sections: readonly (readonly T[])[], item: T, to: DropSlot): T[][] {
  const from = locateIn(sections, item);
  if (!from || to.section < 0 || to.section >= sections.length) {
    return sections.map(list => [...list]);
  }
  const next = sections.map(list => list.filter(entry => entry !== item));
  const target = next[to.section];
  target.splice(Math.min(Math.max(0, to.index), target.length), 0, item);
  return next;
}

export function sameSlot(a: DropSlot | null, b: DropSlot | null): boolean {
  return !!a && !!b && a.section === b.section && a.index === b.index;
}

export function edgeVelocity(position: number, size: number, edge: number, speed: number): number {
  'worklet';
  if (size <= 0 || edge <= 0) {
    return 0;
  }
  if (position < edge) {
    return -speed * Math.min(1, (edge - position) / edge);
  }
  if (position > size - edge) {
    return speed * Math.min(1, (position - (size - edge)) / edge);
  }
  return 0;
}
