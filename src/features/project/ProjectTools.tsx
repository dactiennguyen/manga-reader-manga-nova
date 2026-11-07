import { Image, ScrollView, type ImageSourcePropType } from 'react-native';

import { chapterIdsOf } from '../../core/model/selectors';
import type { Project } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { ART, Pressable, Text } from '../../ui';

export type ToolTab = 'characters' | 'world' | 'notes';

function Tile({ label, art, onPress }: { label: string; art: ImageSourcePropType; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} className="w-20 items-center gap-1">
      <Image accessibilityIgnoresInvertColors source={art} className="h-20 w-20 rounded-lg" />
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Every part of a story, one tap away. Script and Storyboard open the first chapter. */
export function ProjectTools({ project, onTab }: { project: Project; onTab: (tab: ToolTab) => void }) {
  const navigation = useAppNavigation();
  const chapterId = chapterIdsOf(project)[0];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4 pb-3">
      <Tile label="Outline" art={ART.tileOutline} onPress={() => navigation.navigate('Outline', { projectId: project.id })} />
      {!!chapterId && <Tile label="Script" art={ART.tileScript} onPress={() => navigation.navigate('Script', { chapterId })} />}
      {!!chapterId && (
        <Tile label="Storyboard" art={ART.tileStoryboard} onPress={() => navigation.navigate('Storyboard', { chapterId })} />
      )}
      <Tile label="Characters" art={ART.tileCharacters} onPress={() => onTab('characters')} />
      <Tile label="World" art={ART.tileWorld} onPress={() => onTab('world')} />
      <Tile label="Notes" art={ART.tileNotes} onPress={() => onTab('notes')} />
      <Tile label="Export" art={ART.tileExport} onPress={() => navigation.navigate('Export', { projectId: project.id })} />
      <Tile label="Assistant" art={ART.tileAi} onPress={() => navigation.navigate('Tabs', { screen: 'Assistant', params: { projectId: project.id } })} />
    </ScrollView>
  );
}
