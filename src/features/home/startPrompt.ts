import type { Project } from '../../core/model/types';
import type { DailyPrompt } from '../../core/studio/types';
import type { AppNavigator } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { openRoute } from '../project/projectActions';
import { openBlankCanvas } from './quickStart';

/** What "Do it" on today's prompt does. The widget's prompt link does the same. */
export function startPrompt(navigation: AppNavigator, prompt: DailyPrompt, project: Project | undefined): void {
  if (prompt.route) {
    openRoute(navigation, prompt.route);
  } else if (project) {
    navigation.navigate('Project', { projectId: project.id });
  } else if (prompt.kind === 'draw') {
    openBlankCanvas(navigation, useSettings.getState().defaultStyle);
  } else {
    navigation.navigate('NewProject');
  }
}
