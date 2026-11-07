export function buildSpreads<T>(pageIds: readonly T[], spread: boolean): T[][] {
  if (!spread) {
    return pageIds.map(id => [id]);
  }
  const out: T[][] = [];
  if (pageIds.length > 0) {
    out.push([pageIds[0]]);
  }
  for (let i = 1; i < pageIds.length; i += 2) {
    out.push(pageIds.slice(i, i + 2));
  }
  return out;
}

export function spreadIndexOfPage(groups: readonly (readonly unknown[])[], pageIndex: number): number {
  let seen = 0;
  for (let i = 0; i < groups.length; i++) {
    seen += groups[i].length;
    if (pageIndex < seen) {
      return i;
    }
  }
  return Math.max(0, groups.length - 1);
}

export function firstPageOfSpread(groups: readonly (readonly unknown[])[], groupIndex: number): number {
  let seen = 0;
  for (let i = 0; i < groups.length && i < groupIndex; i++) {
    seen += groups[i].length;
  }
  return seen;
}

export function spreadLabel(groups: readonly (readonly unknown[])[], groupIndex: number, total: number): string {
  if (total <= 0 || groups.length === 0) {
    return `0 / ${Math.max(0, total)}`;
  }
  const at = Math.max(0, Math.min(groups.length - 1, groupIndex));
  const first = firstPageOfSpread(groups, at) + 1;
  const last = first + groups[at].length - 1;
  return last > first ? `${first}–${last} / ${total}` : `${first} / ${total}`;
}

export function slotAtPoint(contentX: number, pageWidth: number, slots: number, count: number, rtl: boolean): number {
  if (pageWidth <= 0 || count <= 0) {
    return 0;
  }
  const fromStart = rtl ? slots * pageWidth - contentX : contentX;
  const slot = Math.floor(fromStart / pageWidth);
  return Math.max(0, Math.min(count - 1, slot));
}
