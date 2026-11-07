import { CommonActions } from '@react-navigation/native';

import { buildProjectBundle, mapBundleImages } from '../../core/archive/bundle';
import type { ID, Project } from '../../core/model/types';
import type { StoryRoute } from '../../core/story/resume';
import { toAbsolute } from '../../core/util/paths';
import { MIME, RNFS, copyIntoImages, pickImage, removeFile, shareFile, stripFileScheme } from '../../native/files';
import { exportArt } from '../../state/artStore';
import type { AppNavigation } from '../../state/navigation';
import { appServices } from '../../state/services';
import { useStory } from '../../state/useStory';
import { confirm, snackbar, toast } from '../../ui';

export function openRoute(navigation: AppNavigation, route: StoryRoute): void {
  navigation.dispatch(CommonActions.navigate(route.name, route.params));
}

export async function changeProjectCover(projectId: ID): Promise<void> {
  try {
    const path = await pickImage();
    if (!path) {
      return;
    }
    const previous = useStory.getState().projects[projectId]?.coverUri;
    useStory.getState().updateProject(projectId, { coverUri: path });
    if (previous && previous !== path) {
      removeFile(previous).catch(() => undefined);
    }
    toast('Cover changed');
  } catch {
    toast('Could not open this image');
  }
}

export async function exportProjectFile(projectId: ID): Promise<void> {
  const title = useStory.getState().projects[projectId]?.title || 'Story';
  try {
    toast('Packing project…');
    const path = await appServices().exportProject(projectId);
    await shareFile(path, MIME.mangaka, `${title} project`);
  } catch {
    toast('Could not export the project. Try again later');
  }
}

export async function trashProjectWithConfirm(project: Project): Promise<boolean> {
  const ok = await confirm(
    `Delete "${project.title || 'Untitled'}"?`,
    'The story stays in Trash for 30 days and can be restored during that time.',
    { confirmText: 'Delete', destructive: true },
  );
  if (!ok) {
    return false;
  }
  useStory.getState().trashProject(project.id);
  snackbar({
    message: 'Moved to trash',
    actionLabel: 'Undo',
    onAction: () => useStory.getState().restoreProject(project.id),
  });
  return true;
}

async function copyProjectImages(projectId: ID): Promise<Map<string, string>> {
  const copied = new Map<string, string>();
  const bundle = buildProjectBundle(useStory.getState(), projectId, exportArt);
  if (!bundle) {
    return copied;
  }
  const paths = new Set<string>();
  mapBundleImages(bundle, path => {
    paths.add(path);
    return path;
  });
  for (const path of paths) {
    try {
      const source = toAbsolute(stripFileScheme(path));
      if (await RNFS.exists(source)) {
        copied.set(path, await copyIntoImages(source));
      }
    } catch {
      copied.delete(path);
    }
  }
  return copied;
}

export async function duplicateStory(projectId: ID, onOpen?: (copyId: ID) => void): Promise<ID | null> {
  const copied = await copyProjectImages(projectId);
  const copyId = useStory.getState().duplicateProject(projectId, path => copied.get(path));
  if (!copyId) {
    copied.forEach(dest => {
      removeFile(dest).catch(() => undefined);
    });
    toast('Could not duplicate this story');
    return null;
  }
  snackbar({
    message: 'Story duplicated',
    actionLabel: onOpen ? 'Open' : undefined,
    onAction: onOpen ? () => onOpen(copyId) : undefined,
  });
  return copyId;
}
