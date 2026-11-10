import { useState } from 'react';
import { View } from 'react-native';
import { CloseIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { ART_STYLE_LABEL } from '../../core/model/constants';
import type { Project } from '../../core/model/types';
import type { NextStep } from '../../core/story/nextStep';
import { useAppNavigation } from '../../state/navigation';
import { Badge, Button, Card, Cover, ICON, IconButton, Pressable, ProgressBar, Tag, Text } from '../../ui';
import { changeProjectCover, openRoute } from './projectActions';

export function ProjectSummary({
  project,
  progress,
  onAddSummary,
}: {
  project: Project;
  progress: { done: number; total: number; ratio: number };
  onAddSummary: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="flex-row gap-3 p-4">
      <Pressable accessibilityLabel={t('Change cover')} onPress={() => changeProjectCover(project.id)} className="self-start">
        <Cover project={project} width={96} />
      </Pressable>
      <View className="flex-1 gap-2">
        <Text variant="title">{project.title || t('Untitled')}</Text>
        <View className="flex-row flex-wrap gap-1">
          {project.genres.map(genre => (
            <Tag key={genre} label={t(genre)} />
          ))}
          <Tag label={t(ART_STYLE_LABEL[project.style])} />
          {project.done && <Badge text={t('Completed')} tone="success" />}
        </View>
        {project.logline ? (
          <Pressable
            accessibilityLabel={project.logline}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            className="min-h-12"
          >
            <Text variant="bodySmall" tone="secondary" numberOfLines={expanded ? undefined : 2}>
              {project.logline}
            </Text>
          </Pressable>
        ) : (
          <Pressable accessibilityLabel={t('Add a one-line summary')} onPress={onAddSummary} className="min-h-12 justify-center">
            <Text variant="bodySmall" tone="muted">
              {t('Add a one-line summary…')}
            </Text>
          </Pressable>
        )}
        <ProgressBar value={progress.ratio} />
        <Text variant="caption" tone="muted">
          {progress.total ? t('{done}/{total} pages', { done: progress.done, total: progress.total }) : t('No pages yet')}
        </Text>
      </View>
    </View>
  );
}

export function NextStepCard({ step, onHide }: { step: NextStep; onHide: () => void }) {
  const navigation = useAppNavigation();
  return (
    <Card className="gap-2 p-3">
      <View className="flex-row items-center">
        <Text variant="label" tone="accent" className="flex-1">
          {t('Next step')}
        </Text>
        <IconButton icon={CloseIcon} size={ICON.md} accessibilityLabel={t('Hide suggestion')} onPress={onHide} />
      </View>
      <Text>{t(step.text)}</Text>
      <View className="flex-row flex-wrap gap-2">
        {step.actions.map((action, index) => (
          <Button
            key={action.label}
            title={t(action.label)}
            small
            variant={index === 0 ? 'primary' : 'secondary'}
            onPress={() => openRoute(navigation, action.route)}
          />
        ))}
      </View>
    </Card>
  );
}
