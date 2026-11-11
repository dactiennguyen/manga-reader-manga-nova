import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { useAppNavigation } from '../../../state/navigation';
import { AppBar, Screen } from '../../../ui';

/** The frame of the drawing activities between turns: a back bar over a scrolling column. */
export function PlayPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const navigation = useAppNavigation();
  return (
    <Screen padded={false}>
      <AppBar title={title} subtitle={subtitle} onBack={navigation.goBack} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6 pt-1 md:px-6">
        {children}
      </ScrollView>
    </Screen>
  );
}
