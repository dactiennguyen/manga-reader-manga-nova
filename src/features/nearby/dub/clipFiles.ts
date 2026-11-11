/**
 * Clip files on disk: one .m4a per bubble under documents/manganova/voices/<chapter>/, kept across launches.
 * A take is recorded into the cache first and only moved here when kept, so a thrown-away take never
 * replaces a good one.
 */
import { clipFileName, type ClipEntry } from '../../../core/nearby/dubClips';
import type { ID } from '../../../core/model/types';
import { toAbsolute, toRelative } from '../../../core/util/paths';
import { uid } from '../../../core/util/id';
import { DIRS, RNFS, removeFile } from '../../../native/files';
import { useDubClips } from '../../../state/useDubClips';

const voicesDir = (chapterId: ID) => `${DIRS.root}/voices/${chapterId.replace(/[^A-Za-z0-9_-]/g, '') || 'x'}`;
const takesDir = () => `${DIRS.tmp}/takes`;

/** A fresh cache path to record a take into. */
export async function newTakePath(): Promise<string> {
  await RNFS.mkdir(takesDir());
  return `${takesDir()}/${uid()}.m4a`;
}

export function discardTake(path: string | null): void {
  if (path) {
    removeFile(path).catch(() => {});
  }
}

/** Keeps a take for a bubble: moves it into the voices folder, updates the index, deletes the take it replaces. */
export async function keepTake(
  chapterId: ID,
  bubbleId: ID,
  takePath: string,
  info: { ms: number; by: string; text: string },
): Promise<ClipEntry> {
  const at = Date.now();
  const dir = voicesDir(chapterId);
  await RNFS.mkdir(dir);
  const dest = `${dir}/${clipFileName(chapterId, bubbleId, at)}`;
  await RNFS.moveFile(takePath, dest);
  const entry: ClipEntry = { file: toRelative(dest), ms: info.ms, by: info.by, text: info.text, at };
  const replaced = useDubClips.getState().put(chapterId, bubbleId, entry);
  await removeFile(replaced);
  return entry;
}

/** Writes a clip that came over the network and keeps it like a take. */
export async function keepArrived(chapterId: ID, bubbleId: ID, base64: string, info: { ms: number; by: string; text: string }): Promise<ClipEntry> {
  const path = await newTakePath();
  await RNFS.writeFile(path, base64, 'base64');
  return keepTake(chapterId, bubbleId, path, info);
}

export async function deleteClip(chapterId: ID, bubbleId: ID): Promise<void> {
  await removeFile(useDubClips.getState().remove(chapterId, bubbleId));
}

export function clipPath(entry: Pick<ClipEntry, 'file'>): string {
  return toAbsolute(entry.file);
}

/** The clip as base64, to send. Clips are capped at 15 s, so one read is small (about 160 KB). */
export function readClip(entry: Pick<ClipEntry, 'file'>): Promise<string> {
  return RNFS.readFile(clipPath(entry), 'base64');
}

export function readTake(path: string): Promise<string> {
  return RNFS.readFile(path, 'base64');
}
