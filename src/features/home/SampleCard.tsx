import { ReadIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { Card, ListItem } from '../../ui';
import { SAMPLE_TITLE, useSampleStory } from './sampleStory';

/** A finished chapter to look around in, for people who have not made anything yet. */
export function SampleCard() {
  const { opening, openSample } = useSampleStory();
  return (
    <Card>
      <ListItem
        icon={ReadIcon}
        title={t('Open the sample story')}
        subtitle={
          opening ? t('Opening…') : t('{title}: script, pages and lettering to explore', { title: SAMPLE_TITLE })
        }
        chevron
        disabled={opening}
        onPress={openSample}
      />
    </Card>
  );
}
