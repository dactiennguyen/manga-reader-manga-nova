import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { LEVELS, requirementText } from '../../../core/studio/journey';
import type { LevelProgress } from '../../../core/studio/types';
import { Card, Icon, ProgressBar, SectionHeader, Text } from '../../../ui';
import { CircleIcon, DoneIcon, LockIcon, MarkDoneIcon } from '../../../ui/icons';
import { ICON } from '../../../ui/tokens';
import { LevelBadge } from '../parts';

/** Where the person is now and exactly what the next level asks for. */
export function CurrentLevelCard({ progress }: { progress: LevelProgress }) {
  const { level, next, steps } = progress;
  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-center gap-4">
        <LevelBadge level={level} size={88} showTitle={false} />
        <View className="flex-1 gap-1">
          <Text variant="caption" tone="secondary">
            {t('Level {n} of {total}', { n: level.index + 1, total: LEVELS.length })}
          </Text>
          <Text variant="title">{t(level.title)}</Text>
          <Text variant="bodySmall" tone="secondary">
            {t(level.blurb)}
          </Text>
        </View>
      </View>
      {next ? (
        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text variant="label" className="flex-1">
              {t('Next: {level}', { level: t(next.title) })}
            </Text>
            <Text variant="mono" tone="secondary">
              {t('{percent}%', { percent: Math.round(progress.progress * 100) })}
            </Text>
          </View>
          <ProgressBar value={progress.progress} />
          <View className="gap-1.5 pt-1">
            {steps.map(step => {
              const met = step.have >= step.need.count;
              return (
                <View key={step.need.metric} className="flex-row items-center gap-2">
                  <Icon icon={met ? DoneIcon : CircleIcon} size={ICON.sm} color={met ? 'success' : 'text-muted'} weight={met ? 'fill' : 'regular'} />
                  <Text variant="bodySmall" tone={met ? 'secondary' : 'text'} className="flex-1">
                    {requirementText(step.need)}
                  </Text>
                  <Text variant="mono" tone="muted">
                    {t('{have}/{count}', { have: Math.min(step.have, step.need.count), count: step.need.count })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <Text variant="bodySmall" tone="success">
          {t('You reached the last level. Keep making pages for the joy of it.')}
        </Text>
      )}
    </Card>
  );
}

/** All six levels top to bottom, reached ones in full and later ones faded with a lock. */
export function LevelPath({ current }: { current: number }) {
  return (
    <View className="gap-2">
      <SectionHeader>{t('The path')}</SectionHeader>
      <Card className="p-4">
        {LEVELS.map((level, index) => {
          const reached = index <= current;
          return (
            <View
              key={level.id}
              accessible
              accessibilityLabel={`${t(level.title)}. ${reached ? t('Reached') : t('Locked')}`}
              className="flex-row gap-3"
            >
              <View className="items-center">
                <LevelBadge level={level} size={52} locked={!reached} showTitle={false} />
                {index < LEVELS.length - 1 && <View className={`my-1 w-0.5 flex-1 ${index < current ? 'bg-accent' : 'bg-divider'}`} />}
              </View>
              <View className="flex-1 gap-0.5 pb-4 pt-1">
                <View className="flex-row items-center gap-1.5">
                  <Text variant="label" tone={reached ? 'text' : 'muted'} className="shrink">
                    {t(level.title)}
                  </Text>
                  <Icon
                    icon={reached ? MarkDoneIcon : LockIcon}
                    size={ICON.sm}
                    color={reached ? 'accent' : 'text-muted'}
                    weight={reached ? 'fill' : 'regular'}
                  />
                </View>
                <Text variant="caption" tone={reached ? 'secondary' : 'muted'}>
                  {t(level.blurb)}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
}
