import { ScrollView, View } from 'react-native';

import type { Project } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { Button, Cover, Pressable, SectionHeader, Text } from '../../ui';

export function RecentStories({ projects }: { projects: Project[] }) {
  const navigation = useAppNavigation();
  return (
    <View className="gap-2">
      <SectionHeader
        right={
          <Button
            title="See all"
            variant="ghost"
            small
            onPress={() => navigation.navigate('Tabs', { screen: 'Library' })}
          />
        }
      >
        Recent stories
      </SectionHeader>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-1 pr-4">
        {projects.map(project => (
          <Pressable
            key={project.id}
            accessibilityLabel={project.title || 'Untitled'}
            onPress={() => navigation.navigate('Project', { projectId: project.id })}
            className="w-[104px] gap-1"
          >
            <Cover project={project} width={104} />
            <Text variant="label" numberOfLines={2}>
              {project.title || 'Untitled'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
