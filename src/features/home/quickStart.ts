import { t } from '../../core/i18n';
import { chapterIdsOf } from '../../core/model/selectors';
import type { ArtStyle, Page } from '../../core/model/types';
import { QUICK_START_TITLE, unusedQuickStart } from '../../core/story/quickStart';
import type { AppNavigation } from '../../state/navigation';
import { panelHasArt } from '../../state/artStore';
import { useStory } from '../../state/useStory';
import { toast } from '../../ui';

function blankPage(navigation: AppNavigation, style: ArtStyle): Page | undefined {
  const unused = unusedQuickStart(useStory.getState(), panelHasArt);
  if (unused) {
    return unused;
  }
  const story = useStory.getState();
  const projectId = story.createProject({
    title: QUICK_START_TITLE,
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
    return undefined;
  }
  const pageId = story.addPage(chapterId, { templateId: 'g1' });
  return useStory.getState().pages[pageId];
}

export function openBlankCanvas(navigation: AppNavigation, style: ArtStyle): void {
  const page = blankPage(navigation, style);
  if (!page) {
    return;
  }
  const panelId = Object.keys(page.panels)[0];
  if (!panelId) {
    toast(t('Could not open the canvas. Lay out the page first'));
    navigation.navigate('PanelLayout', { pageId: page.id });
    return;
  }
  navigation.navigate('Canvas', { pageId: page.id, panelId });
}

export function openBlankLayout(navigation: AppNavigation, style: ArtStyle): void {
  const page = blankPage(navigation, style);
  if (page) {
    navigation.navigate('PanelLayout', { pageId: page.id, mode: 'panels' });
  }
}
