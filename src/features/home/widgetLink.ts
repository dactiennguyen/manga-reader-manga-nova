import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

import { activeProjects } from '../../core/model/selectors';
import { dailyPrompt } from '../../core/studio/prompts';
import { dayKey } from '../../core/util/time';
import { parseWidgetLink } from '../../core/widget/link';
import type { RootStackParamList } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { whenReady } from '../nearby/deepLink';
import { startPrompt } from './startPrompt';

type Ref = NavigationContainerRefWithCurrent<RootStackParamList>;

/**
 * A tap on the home screen widget: `manganova://widget` shows Home and `manganova://widget/prompt` starts
 * today's prompt, as "Do it" on Home does. Before onboarding is finished the app stays where it is.
 * False for any other link.
 */
export function handleWidgetLink(url: string | null | undefined, ref: Ref): boolean {
  const target = parseWidgetLink(url);
  if (!target) {
    return false;
  }
  whenReady(ref, () => {
    if (!useSettings.getState().onboarded) {
      return;
    }
    ref.navigate('Tabs', { screen: 'Home' });
    if (target === 'prompt') {
      const state = useStory.getState();
      startPrompt(ref, dailyPrompt(state, dayKey()), activeProjects(state)[0]);
    }
  });
  return true;
}
