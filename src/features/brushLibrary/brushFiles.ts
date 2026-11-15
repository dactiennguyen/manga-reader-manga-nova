import {
  BRUSH_FILE_MAX_CHARS,
  brushFileName,
  looksLikeBrushFile,
  parseBrushFile,
  serializeBrushFile,
  type BrushFile,
} from '../../core/art/brushFile';
import { t } from '../../core/i18n';
import { DIRS, MIME, RNFS, ensureDirs, pickToCache, pickerTypes, removeFile, shareFile } from '../../native/files';
import type { AppNavigator } from '../../state/navigation';
import { toast } from '../../ui';
import { brushFileError } from './labels';

/** Writes the set as a .mnbrush file in the cache and opens the share sheet with it. */
export async function shareBrushFile(file: BrushFile, title: string): Promise<void> {
  await ensureDirs();
  const dir = `${DIRS.tmp}/brushes`;
  await RNFS.mkdir(dir);
  const path = `${dir}/${brushFileName(file.name || title)}`;
  await RNFS.writeFile(path, serializeBrushFile(file), 'utf8');
  // Sent as plain bytes, like a .manganova file, so mail and chat apps keep it as a file and hand it back to us.
  await shareFile(path, MIME.archive, title);
}

/** True when a file opened from another app is a brush file rather than a story: it starts as JSON. */
export async function isBrushFileAt(path: string): Promise<boolean> {
  try {
    return looksLikeBrushFile(await RNFS.read(path, 16, 0, 'utf8'));
  } catch {
    return false;
  }
}

/** The text of a brush file, or null when it is too big to be one or cannot be read. */
async function readBrushText(path: string): Promise<string | null> {
  const size = Number((await RNFS.stat(path)).size) || 0;
  // UTF-8 text is at most 4 bytes per character.
  if (size > BRUSH_FILE_MAX_CHARS * 4) {
    return null;
  }
  return RNFS.readFile(path, 'utf8');
}

/**
 * Opens the import screen for a brush file on disk, or says why it can't. The file is only read here: the
 * import screen checks it again and nothing is added before the person chooses.
 */
export async function openBrushFile(path: string, navigation: AppNavigator): Promise<void> {
  const text = await readBrushText(path).catch(() => null);
  if (text === null) {
    toast(brushFileError('size'));
    return;
  }
  const parsed = parseBrushFile(text);
  if (!parsed.ok) {
    toast(brushFileError(parsed.reason));
    return;
  }
  navigation.navigate('BrushImport', { text });
}

/** Lets the person pick a .mnbrush file and opens it. */
export async function pickBrushFile(navigation: AppNavigator): Promise<void> {
  let path: string | null = null;
  try {
    const picked = await pickToCache(pickerTypes.allFiles);
    if (!picked) {
      return;
    }
    path = picked.path;
    await openBrushFile(picked.path, navigation);
  } catch {
    toast(t("This file can't be read as brushes."));
  } finally {
    removeFile(path).catch(() => undefined);
  }
}
