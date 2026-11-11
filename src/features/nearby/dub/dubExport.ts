/**
 * Sharing a dub: the chapter's clips joined into one .m4a in reading order (native composition on iOS,
 * sample copy with MediaMuxer on Android). If joining fails, the clips are zipped with an M3U playlist so
 * nothing recorded is lost. Lines with no recorded voice are not in the audio file.
 */
import { chapterIdsOf, chapterLabel } from '../../../core/model/selectors';
import { dubLines, type DubItem } from '../../../core/nearby/dub';
import { clipsInOrder, playlistText, type ClipEntry } from '../../../core/nearby/dubClips';
import type { ID } from '../../../core/model/types';
import { uid } from '../../../core/util/id';
import { DIRS, MIME, RNFS, concatAudio, ensureDirs, removeFile, resetDir, zipDir } from '../../../native/files';
import { useDubClips } from '../../../state/useDubClips';
import { useStory } from '../../../state/useStory';
import { clipPath } from './clipFiles';

/** A breath between two lines, so a dub sounds like people talking in turn. */
export const LINE_GAP_MS = 350;

export type DubAudio = { path: string; fileName: string; mime: string; joined: number; total: number; zipped: boolean };

const safeName = (title: string) =>
  title
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'dub';

/** Throws when the chapter has no recorded clip at all. */
export async function exportDubAudio(
  title: string,
  lines: DubItem[],
  clips: Record<ID, ClipEntry>,
  names: Record<string, string>,
): Promise<DubAudio> {
  const ordered = clipsInOrder(lines, clips);
  if (ordered.length === 0) {
    throw new Error('No voices recorded yet.');
  }
  await ensureDirs();
  const dir = `${DIRS.tmp}/dub`;
  await resetDir(dir);
  const base = safeName(title);
  const audio = `${dir}/${base}.m4a`;
  try {
    const joined = await concatAudio(
      ordered.map(entry => clipPath(entry)),
      audio,
      LINE_GAP_MS,
    );
    return { path: audio, fileName: `${base}.m4a`, mime: MIME.m4a, joined, total: ordered.length, zipped: false };
  } catch {
    await removeFile(audio);
  }
  // Fallback: every clip numbered in reading order, plus a playlist that keeps the whole script.
  const folder = `${dir}/${uid()}`;
  await RNFS.mkdir(folder);
  const numbered = new Map<ClipEntry, string>();
  await Promise.all(
    ordered.map((entry, index) => {
      const name = `${String(index + 1).padStart(3, '0')}.m4a`;
      numbered.set(entry, name);
      return RNFS.copyFile(clipPath(entry), `${folder}/${name}`);
    }),
  );
  await RNFS.writeFile(`${folder}/playlist.m3u`, playlistText(title, lines, clips, names, entry => numbered.get(entry) ?? ''), 'utf8');
  const zip = `${dir}/${base}.zip`;
  await zipDir(folder, zip);
  await removeFile(folder);
  return { path: zip, fileName: `${base}.zip`, mime: MIME.zip, joined: ordered.length, total: ordered.length, zipped: true };
}

/** The first chapter of a story, in story order, that has recorded voices; null when none has. */
export function voicedChapterOf(projectId: ID): ID | null {
  const state = useStory.getState();
  const clips = useDubClips.getState().clips;
  return chapterIdsOf(state.projects[projectId]).find(id => Object.keys(clips[id] ?? {}).length > 0) ?? null;
}

/** One audio file of a chapter's voices, for the story trailer; null when it can't be joined. */
export async function voicesTrackFor(chapterId: ID): Promise<string | null> {
  const state = useStory.getState();
  const clips = useDubClips.getState().clips[chapterId] ?? {};
  try {
    const audio = await exportDubAudio(chapterLabel(state, chapterId), dubLines(state, chapterId), clips, {});
    return audio.zipped ? null : audio.path;
  } catch {
    return null;
  }
}
