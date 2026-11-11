import { useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../../core/i18n';
import { activeProjects, chapterLabel, chaptersOf } from '../../../core/model/selectors';
import type { ID } from '../../../core/model/types';
import { dubLines } from '../../../core/nearby/dub';
import { useStoryData } from '../../../state/hooks';
import { useDubClips } from '../../../state/useDubClips';
import { EmptyState, ListItem, Section } from '../../../ui';
import { BubbleIcon, ChapterIcon } from '../../../ui/icons';

/** The chapters that have lettered bubbles, story by story, with how many lines each has and how many are voiced. */
export function ChapterPicker({ onPick }: { onPick: (chapterId: ID) => void }) {
  const story = useStoryData();
  const clips = useDubClips(state => state.clips);
  const groups = useMemo(
    () =>
      activeProjects(story)
        .map(project => ({
          project,
          chapters: chaptersOf(story, project.id)
            .map(chapter => ({ chapter, lines: dubLines(story, chapter.id).length }))
            .filter(item => item.lines > 0),
        }))
        .filter(group => group.chapters.length > 0),
    [story],
  );

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={BubbleIcon}
        title={t('No bubbles to voice yet')}
        message={t('Letter a few speech bubbles on your pages, then come back to give them voices.')}
      />
    );
  }
  return (
    <View className="gap-4">
      {groups.map(({ project, chapters }) => (
        <Section key={project.id} title={project.title || t('Untitled')}>
          {chapters.map(({ chapter, lines }) => {
            const voiced = Object.keys(clips[chapter.id] ?? {}).length;
            return (
              <ListItem
                key={chapter.id}
                icon={ChapterIcon}
                title={chapterLabel(story, chapter.id)}
                subtitle={
                  voiced > 0
                    ? t('{lines} · {voiced} voiced', { lines: tn(lines, '{count} line', '{count} lines'), voiced })
                    : tn(lines, '{count} line', '{count} lines')
                }
                chevron
                onPress={() => onPick(chapter.id)}
              />
            );
          })}
        </Section>
      ))}
    </View>
  );
}
