import {
  ARCHIVE_EXTENSION,
  buildProjectBundle,
  mapBundleImages,
  remapBundleIds,
  uniqueTitle,
} from '../core/archive/bundle';
import { parseProjectBundle } from '../core/archive/parse';
import type { ID, PanelArt, Project, StoryData } from '../core/model/types';
import { uid, slugify } from '../core/util/id';
import { toAbsolute } from '../core/util/paths';
import { dayKey } from '../core/util/time';
import {
  DIRS,
  RNFS,
  copyIntoImages,
  ensureDirs,
  extensionOf,
  removeFile,
  resetDir,
  stripFileScheme,
  unzipTo,
  zipDir,
} from '../native/files';

const INVALID_MESSAGE = "This file can't be read or isn't a Manganova project";
const RELATIVE_IMAGE = /^images\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/;

export type ArchiveStory = {
  data: () => StoryData;
  merge: (data: Partial<StoryData>) => void;
  exportArt: (panelIds: ID[]) => Record<ID, PanelArt>;
  importArt: (art: Record<ID, PanelArt>) => void;
};

/** Inside the story's own folder, so the file leaves with the story like every other export. */
async function freeArchivePath(projectId: ID, base: string): Promise<string> {
  const dir = `${DIRS.exports}/${projectId}`;
  await RNFS.mkdir(dir);
  let path = `${dir}/${base}.${ARCHIVE_EXTENSION}`;
  let n = 2;
  while (await RNFS.exists(path)) {
    path = `${dir}/${base}-${n}.${ARCHIVE_EXTENSION}`;
    n++;
  }
  return path;
}

function byId<T extends { id: ID }>(items: T[]): Record<ID, T> {
  const out: Record<ID, T> = {};
  for (const item of items) {
    out[item.id] = item;
  }
  return out;
}

export async function exportProjectArchive(story: ArchiveStory, projectId: ID): Promise<string> {
  const bundle = buildProjectBundle(story.data(), projectId, story.exportArt);
  if (!bundle) {
    throw new Error('Story not found.');
  }
  await ensureDirs();
  const tmpDir = `${DIRS.tmp}/archive-${uid()}`;
  await resetDir(tmpDir);
  try {
    await RNFS.mkdir(`${tmpDir}/images`);
    const names = new Map<string, string>();
    const portable = mapBundleImages(bundle, path => {
      const source = toAbsolute(stripFileScheme(path));
      let relative = names.get(source);
      if (!relative) {
        relative = `images/${names.size + 1}.${extensionOf(source)}`;
        names.set(source, relative);
      }
      return relative;
    });
    const missing = new Set<string>();
    for (const [source, relative] of names) {
      if (await RNFS.exists(source)) {
        await RNFS.copyFile(source, `${tmpDir}/${relative}`);
      } else {
        missing.add(relative);
      }
    }
    const final = missing.size ? mapBundleImages(portable, path => (missing.has(path) ? undefined : path)) : portable;
    await RNFS.writeFile(`${tmpDir}/story.json`, JSON.stringify(final), 'utf8');
    const outPath = await freeArchivePath(projectId, `${slugify(bundle.project.title)}-${dayKey()}`);
    await zipDir(tmpDir, outPath);
    return outPath;
  } finally {
    await removeFile(tmpDir);
  }
}

export async function importProjectArchive(story: ArchiveStory, archivePath: string): Promise<ID> {
  await ensureDirs();
  const tmpDir = `${DIRS.tmp}/import-${uid()}`;
  await resetDir(tmpDir);
  try {
    let json: string;
    try {
      await unzipTo(stripFileScheme(archivePath), tmpDir);
      json = await RNFS.readFile(`${tmpDir}/story.json`, 'utf8');
    } catch {
      throw new Error(INVALID_MESSAGE);
    }
    const remapped = remapBundleIds(parseProjectBundle(json));
    const relatives = new Set<string>();
    mapBundleImages(remapped, path => {
      if (RELATIVE_IMAGE.test(path)) {
        relatives.add(path);
      }
      return path;
    });
    const copied = new Map<string, string>();
    for (const relative of relatives) {
      const source = `${tmpDir}/${relative}`;
      if (await RNFS.exists(source)) {
        copied.set(relative, await copyIntoImages(source));
      }
    }
    const local = mapBundleImages(remapped, path => copied.get(path));
    const data = story.data();
    const project: Project = {
      ...local.project,
      title: uniqueTitle(local.project.title, Object.values(data.projects).map(item => item.title)),
      updatedAt: Date.now(),
    };
    delete project.deletedAt;
    // Art first: if the story rows then fail, the panels are orphans for GC and no story half exists.
    story.importArt(local.art);
    story.merge({
      projects: { [project.id]: project },
      chapters: byId(local.chapters),
      scenes: byId(local.scenes),
      characters: byId(local.characters),
      relations: byId(local.relations),
      world: byId(local.world),
      pages: byId(local.pages),
    });
    return project.id;
  } finally {
    await removeFile(tmpDir);
  }
}
