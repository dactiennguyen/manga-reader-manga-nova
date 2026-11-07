let root = '';

/** Stored paths are relative to this folder, so a reinstall or restore cannot break them. */
export function setFilesRoot(next: string): void {
  root = next.replace(/\/+$/, '');
}

export function filesRoot(): string {
  return root;
}

export function toAbsolute(path: string): string {
  if (path.startsWith('/') || /^[a-z]+:\/\//i.test(path)) {
    return path;
  }
  return `${root}/${path}`;
}

export function toRelative(path: string): string {
  const clean = decodeURIComponent(path.replace(/^file:\/\//, ''));
  return clean.startsWith(`${root}/`) ? clean.slice(root.length + 1) : clean;
}

export function fileUri(path: string): string {
  const absolute = toAbsolute(path);
  return /^[a-z]+:\/\//i.test(absolute) ? absolute : `file://${absolute}`;
}
