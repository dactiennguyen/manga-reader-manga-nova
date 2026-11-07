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
import { SECURE_SCREEN, setSecureScreen } from '../native/screen';
import { connectArt, exportArt, importArt } from '../state/artStore';
import { connectScriptHistory } from '../state/scriptHistory';
import { configureServices } from '../state/services';
import { connectAssistant } from '../state/useAssistant';
import { connectSettings, useSettings } from '../state/useSettings';
import { connectStory, useStory } from '../state/useStory';
import { setHapticsEnabled, toast } from '../ui';

const archiveStory: ArchiveStory = {
  data: () => useStory.getState(),
  merge: data => useStory.getState().mergeEntities(data),
  exportArt,
  importArt,
};

export async function boot(): Promise<void> {
  setSecureScreen(SECURE_SCREEN && !__DEV__);
  const db = await openDatabase();
  connectSettings(createMetaRepo(db));
  connectArt(createArtRepo(db));
  connectStory(createStoryRepo(db), () => toast("Couldn't save. Will retry with your next change."));
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
  setHapticsEnabled(useSettings.getState().haptics);
  useSettings.subscribe(state => setHapticsEnabled(state.haptics));
  useStory.getState().purgeTrash();
  if (__DEV__) {
    console.log('GC dry run', collectGarbage(db, useStory.getState(), Date.now()));
  }
}
