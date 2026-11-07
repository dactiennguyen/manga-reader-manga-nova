import { View } from 'react-native';

import type { Project } from '../../core/model/types';
import type { ResumeTarget } from '../../core/story/resume';
import { formatRelative } from '../../core/util/time';
import { useAppNavigation } from '../../state/navigation';
import { Button, Card, Cover, ProgressBar, Text } from '../../ui';
import { openRoute } from '../project/projectActions';

export function ContinueCard({
  project,
  resume,
  progress,
}: {
  project: Project;
  resume: ResumeTarget;
  progress: { done: number; total: number; ratio: number };
}) {
  const navigation = useAppNavigation();
  const title = project.title || 'Untitled';
  return (
    <Card
      accessibilityLabel={`${title}, ${resume.where}`}
      onPress={() => navigation.navigate('Project', { projectId: project.id })}
      className="flex-row gap-3 p-3"
    >
      <Cover project={project} width={84} />
      <View className="flex-1 gap-1">
        <Text variant="heading" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="label" tone="accent" numberOfLines={1}>
          {resume.where}
        </Text>
        <Text variant="caption" tone="muted">
          Edited {formatRelative(project.updatedAt)}
        </Text>
        <ProgressBar value={progress.ratio} />
        <Text variant="caption" tone="muted">
          {progress.total ? `${progress.done}/${progress.total} pages` : 'No pages yet'}
        </Text>
        <Button title={resume.action} small className="mt-1 self-start" onPress={() => openRoute(navigation, resume.route)} />
      </View>
    </Card>
  );
}
