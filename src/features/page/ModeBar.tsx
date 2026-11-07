import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrushIcon, MessageIcon, PanelsIcon } from '../../ui/icons';

import type { ID } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { ModeSwitch } from '../../ui';

export type PageMode = 'panels' | 'art' | 'lettering';

const MODES = [
  { value: 'panels', label: 'Panels', icon: PanelsIcon },
  { value: 'art', label: 'Art', icon: BrushIcon },
  { value: 'lettering', label: 'Lettering', icon: MessageIcon },
] as const;

export function ModeBar({
  pageId,
  mode,
  onChange,
  leading,
  trailing,
}: {
  pageId: ID;
  mode: PageMode;
  onChange?: (mode: 'panels' | 'art') => void;
  /** Sit either side of the switch, so the page keeps the whole stage. */
  leading?: ReactNode;
  trailing?: ReactNode;
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
    <View className="flex-row items-center justify-center gap-1 bg-bg px-2 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
      {leading}
      <ModeSwitch<PageMode> options={MODES} value={mode} onChange={select} />
      {trailing}
    </View>
  );
}
