/** The host picks the page to draw together: a blank page in a new story, or a page from one of theirs. */
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { t } from '../../../core/i18n';
import { activeProjects, chaptersOf } from '../../../core/model/selectors';
import type { ID } from '../../../core/model/types';
import { useThumb } from '../../../render/thumbs';
import { useStoryData } from '../../../state/hooks';
import { Button, Card, Chip, ChipRow, Pressable, SectionHeader, Skeleton, Text } from '../../../ui';
import { AddPageIcon } from '../../../ui/icons';

const THUMB_W = 96;
const THUMB_H = 136;

function Thumb({ pageId, label, onPress }: { pageId: ID; label: string; onPress: () => void }) {
  const uri = useThumb(pageId);
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} className="gap-1">
      <View className="overflow-hidden rounded-sm bg-white" style={{ width: THUMB_W, height: THUMB_H }}>
        {uri ? (
          <Image accessibilityIgnoresInvertColors source={{ uri }} style={{ width: THUMB_W, height: THUMB_H }} resizeMode="cover" />
        ) : (
          <Skeleton className="flex-1" />
        )}
      </View>
      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ width: THUMB_W }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CoDrawSetup({ onBlank, onPage }: { onBlank: () => void; onPage: (pageId: ID) => void }) {
  const state = useStoryData();
  const projects = activeProjects(state).filter(project =>
    chaptersOf(state, project.id).some(chapter => chapter.pageIds.length > 0),
  );
  const [projectId, setProjectId] = useState<ID | null>(projects[0]?.id ?? null);
  const chosen = projects.find(project => project.id === projectId) ?? projects[0];
  const pages = chosen
    ? chaptersOf(state, chosen.id).flatMap((chapter, c) =>
        chapter.pageIds.filter(id => state.pages[id]).map((pageId, p) => ({ pageId, label: t('Ch. {c} · p. {p}', { c: c + 1, p: p + 1 }) })),
      )
    : [];
  return (
    <View className="gap-4">
      <Card className="gap-2 p-4">
        <Text variant="heading">{t('Start from a blank page')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t('A one-panel page in a new story called “Drawn together”. Everyone draws on it at once.')}
        </Text>
        <Button title={t('Blank page')} icon={AddPageIcon} onPress={onBlank} className="mt-1" />
      </Card>
      {projects.length ? (
        <View className="gap-2">
          <SectionHeader>{t('Or draw on a page of your story')}</SectionHeader>
          <ChipRow>
            {projects.map(project => (
              <Chip
                key={project.id}
                label={project.title.trim() || t('Untitled')}
                selected={project.id === chosen?.id}
                onPress={() => setProjectId(project.id)}
              />
            ))}
          </ChipRow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 py-1">
            {pages.map(item => (
              <Thumb key={item.pageId} pageId={item.pageId} label={item.label} onPress={() => onPage(item.pageId)} />
            ))}
          </ScrollView>
          <Text variant="caption" tone="muted">
            {t('Everyone gets a copy of the page. Your story keeps everyone’s layers, one per person.')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
