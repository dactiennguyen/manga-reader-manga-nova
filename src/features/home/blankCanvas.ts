import { chapterIdsOf } from '../../core/model/selectors';
import type { ArtStyle } from '../../core/model/types';
import type { AppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { toast } from '../../ui';

export function openBlankCanvas(navigation: AppNavigation, style: ArtStyle): void {
  const story = useStory.getState();
  const projectId = story.createProject({
    title: 'Untitled story',
    genres: [],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style,
    color: false,
  });
  const chapterId = chapterIdsOf(useStory.getState().projects[projectId])[0];
  if (!chapterId) {
    navigation.navigate('Project', { projectId });
    return;
  }
  const pageId = story.addPage(chapterId, { templateId: 'g1' });
  const panelId = Object.keys(useStory.getState().pages[pageId]?.panels ?? {})[0];
  if (!panelId) {
    toast('Could not open the canvas. Lay out the page first');
    navigation.navigate('PanelLayout', { pageId });
    return;
  }
  navigation.navigate('Canvas', { pageId, panelId });
}
