let counter = 0;

export function uid(): string {
  counter = (counter + 1) % 1679616;
  return (
    Date.now().toString(36) +
    counter.toString(36).padStart(4, '0') +
    Math.floor(Math.random() * 1296)
      .toString(36)
      .padStart(2, '0')
  );
}

export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function slugify(value: string, max = 40): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, max) || 'item'
  );
}
