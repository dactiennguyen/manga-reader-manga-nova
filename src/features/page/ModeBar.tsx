import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brush, MessageSquare, PanelsTopLeft } from 'lucide-react-native';

import type { ID } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { ModeSwitch } from '../../ui';

export type PageMode = 'panels' | 'art' | 'lettering';

const MODES = [
  { value: 'panels', label: 'Panels', icon: PanelsTopLeft },
  { value: 'art', label: 'Art', icon: Brush },
  { value: 'lettering', label: 'Lettering', icon: MessageSquare },
] as const;

export function ModeBar({
  pageId,
  mode,
  onChange,
}: {
  pageId: ID;
  mode: PageMode;
  onChange?: (mode: 'panels' | 'art') => void;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();

  const select = (next: PageMode) => {
    if (next === mode) {
      return;
    }
    if (next === 'lettering') {
      navigation.replace('Lettering', { pageId });
    } else if (mode === 'lettering') {
      navigation.replace('PanelLayout', { pageId, mode: next });
    } else {
      onChange?.(next);
    }
  };

  return (
    <View className="items-center bg-bg px-4 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
      <ModeSwitch<PageMode> options={MODES} value={mode} onChange={select} />
    </View>
  );
}
