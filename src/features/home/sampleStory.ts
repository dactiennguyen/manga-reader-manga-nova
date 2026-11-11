import { useState } from 'react';
import { Platform } from 'react-native';

import { t } from '../../core/i18n';
import { DIRS, RNFS, ensureDirs, removeFile } from '../../native/files';
import { useAppNavigation } from '../../state/navigation';
import { appServices } from '../../state/services';
import { metaStore } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { toast } from '../../ui';

export const SAMPLE_TITLE = 'Lantern Courier';

const SAMPLE_FILE = 'lantern.manganova';
const SAMPLE_KEY = 'sampleProjectId';

/** The archive ships inside the app: an Android asset, and a bundle resource on iOS. */
async function copySampleTo(dest: string): Promise<void> {
  if (Platform.OS === 'android') {
    await RNFS.copyFileAssets(`sample/${SAMPLE_FILE}`, dest);
  } else {
    await RNFS.copyFile(`${RNFS.MainBundlePath}/${SAMPLE_FILE}`, dest);
  }
}

function importedSample(): string | undefined {
  const id = metaStore()?.get(SAMPLE_KEY);
  const project = id ? useStory.getState().projects[id] : undefined;
  return project && !project.deletedAt ? project.id : undefined;
}

/** Opens the sample story, adding it to the library the first time or after it was deleted. */
export function useSampleStory() {
  const navigation = useAppNavigation();
  const [opening, setOpening] = useState(false);

  const openSample = async () => {
    const existing = importedSample();
    if (existing) {
      navigation.navigate('Project', { projectId: existing });
      return;
    }
    setOpening(true);
    const path = `${DIRS.tmp}/${SAMPLE_FILE}`;
    try {
      await ensureDirs();
      await removeFile(path);
      await copySampleTo(path);
      const projectId = await appServices().importProject(path);
      metaStore()?.set(SAMPLE_KEY, projectId);
      navigation.navigate('Project', { projectId });
    } catch {
      toast(t('Could not open the sample story'));
    } finally {
      removeFile(path).catch(() => undefined);
      setOpening(false);
    }
  };

  return { opening, openSample };
}
