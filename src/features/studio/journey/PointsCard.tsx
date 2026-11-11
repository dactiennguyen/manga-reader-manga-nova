import { useState } from 'react';
import { View } from 'react-native';

import { msg, t } from '../../../core/i18n';
import { pointParts, studioPoints } from '../../../core/studio/points';
import type { MetricKey, Metrics } from '../../../core/studio/types';
import { Button, Card, Divider, Text } from '../../../ui';

/** What each metric is called in the points breakdown. */
const METRIC_NAME: Partial<Record<MetricKey, string>> = {
  projects: msg('Stories started'),
  projectsDone: msg('Stories finished'),
  chaptersWritten: msg('Chapters scripted'),
  chaptersDone: msg('Chapters finished'),
  pagesDone: msg('Pages finished'),
  panelsDrawn: msg('Panels drawn'),
  bubbles: msg('Speech bubbles lettered'),
  sfx: msg('Sound effects placed'),
  effects: msg('Effects added'),
  characters: msg('Characters created'),
  charactersFull: msg('Full character profiles'),
  relations: msg('Relationships linked'),
  worldEntries: msg('World entries written'),
  scriptWords: msg('Words of script'),
  dialogueLines: msg('Lines of dialogue'),
  strokes: msg('Strokes drawn'),
  bestStreak: msg('Best drawing streak'),
  activeDays: msg('Days with drawing'),
  promptsDone: msg('Daily prompts finished'),
};

const SHORT_LIST = 5;

/** Studio points: a game score of the person's own work, with where every point came from. */
export function PointsCard({ metrics }: { metrics: Metrics }) {
  const [all, setAll] = useState(false);
  const parts = pointParts(metrics);
  const total = studioPoints(metrics);
  const shown = all ? parts : parts.slice(0, SHORT_LIST);
  return (
    <Card className="gap-3 p-4">
      <View>
        <Text variant="caption" tone="secondary">
          {t('Studio points')}
        </Text>
        <Text variant="display">{total.toLocaleString()}</Text>
        <Text variant="caption" tone="muted">
          {t('A score for your own work. Finished pages and chapters count most.')}
        </Text>
      </View>
      {parts.length > 0 ? (
        <View className="gap-2">
          <Divider />
          {shown.map(part => (
            <View key={part.metric} className="flex-row items-center justify-between gap-3">
              <Text variant="bodySmall" tone="secondary" className="flex-1">
                {t(METRIC_NAME[part.metric] ?? '')}
              </Text>
              <Text variant="mono">{t('+{points}', { points: part.points.toLocaleString() })}</Text>
            </View>
          ))}
          {parts.length > SHORT_LIST && (
            <Button
              title={all ? t('Show less') : t('Show all')}
              variant="ghost"
              small
              className="self-start"
              onPress={() => setAll(value => !value)}
            />
          )}
        </View>
      ) : (
        <Text variant="bodySmall" tone="secondary">
          {t('Start a story and draw a page to earn your first points.')}
        </Text>
      )}
    </Card>
  );
}
