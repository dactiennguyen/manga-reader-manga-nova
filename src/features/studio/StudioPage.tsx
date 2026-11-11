import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { useAppNavigation } from '../../state/navigation';
import { AppBar, Screen } from '../../ui';

/** The frame every studio screen shares: a back bar over a scrolling column. */
export function StudioPage({
  title,
  subtitle,
  right,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Defaults to leaving the screen. */
  onBack?: () => void;
  children: ReactNode;
}) {
  const navigation = useAppNavigation();
  return (
    <Screen padded={false}>
      <AppBar title={title} subtitle={subtitle} onBack={onBack ?? navigation.goBack} right={right} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6 pt-1 md:px-6">
        {children}
      </ScrollView>
    </Screen>
  );
}
