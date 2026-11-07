import { configureAi } from '../core/ai/port';
import { createAiClient, testConnection } from '../data/aiClient';
import { exportProjectArchive, importProjectArchive, type ArchiveStory } from '../data/archive';
import { createArtRepo } from '../data/artRepo';
import { openDatabase } from '../data/database';
import { collectGarbage } from '../data/gc';
import { createMetaRepo } from '../data/metaRepo';
import { createScriptVersionRepo } from '../data/scriptVersions';
import { createStoryRepo } from '../data/storyRepo';
import { createThreadRepo } from '../data/threads';
import { removeProjectExports } from '../features/export/exportFiles';
import { RNFS } from '../native/files';
import { configureRender } from '../render/config';
import { connectArt, exportArt, importArt, loadArt } from '../state/artStore';
import { usePage, useProjectOfPage } from '../state/hooks';
import { connectScriptHistory } from '../state/scriptHistory';
import { configureServices } from '../state/services';
import { connectAssistant } from '../state/useAssistant';
import { connectSettings, useSettings } from '../state/useSettings';
import { connectStory, importEntities, useStory } from '../state/useStory';
import { setHapticsEnabled, toast } from '../ui';

const archiveStory: ArchiveStory = {
  data: () => useStory.getState(),
  merge: importEntities,
  exportArt,
  importArt,
};

export async function boot(): Promise<void> {
  const db = await openDatabase();
  const meta = createMetaRepo(db);
  connectSettings(meta);
  connectArt(createArtRepo(db));
  connectStory(
    createStoryRepo(db),
    () => toast("Couldn't save. Will retry with your next change."),
    projectId => {
      removeProjectExports(projectId).catch(() => {});
    },
  );
  connectAssistant(createThreadRepo(db));
  connectScriptHistory(createScriptVersionRepo(db));
  configureAi(
    createAiClient(() => {
      const { aiBaseUrl, aiApiKey, aiModel } = useSettings.getState();
      return { baseUrl: aiBaseUrl, apiKey: aiApiKey, model: aiModel };
    }),
  );
  configureServices({
    exportProject: projectId => exportProjectArchive(archiveStory, projectId),
    importProject: path => importProjectArchive(archiveStory, path),
    testAiConnection: testConnection,
  });
  configureRender({
    loadArt,
    pageSource: id => {
      const state = useStory.getState();
      const page = state.pages[id];
      const project = page ? state.projects[state.chapters[page.chapterId]?.projectId] : undefined;
      return page && project ? { page, project } : null;
    },
    usePage,
    useProjectOfPage,
    files: {
      writeBase64: (path, base64) => RNFS.writeFile(path, base64, 'base64'),
      remove: path => RNFS.unlink(path),
      ensureDir: path => RNFS.mkdir(path),
    },
    stamps: meta,
  });
  setHapticsEnabled(useSettings.getState().haptics);
  useSettings.subscribe(state => setHapticsEnabled(state.haptics));
  useStory.getState().purgeTrash();
  if (__DEV__) {
    console.log('GC dry run', collectGarbage(db, useStory.getState(), Date.now()));
  }
}
