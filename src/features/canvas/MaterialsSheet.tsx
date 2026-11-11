import { useState } from 'react';
import { Image, View } from 'react-native';

import { msg, t } from '../../core/i18n';
import { Pressable, Sheet, Tabs, Text } from '../../ui';
import { MATERIALS, type Material, type MaterialKind } from './materials';

const TABS: { key: MaterialKind; label: string }[] = [
  { key: 'background', label: msg('Backgrounds') },
  { key: 'pattern', label: msg('Patterns') },
];

const THUMB_RATIO: Record<MaterialKind, number> = { background: 3 / 2, pattern: 1 };

/** A required image carries its pixel size as its style, so the fill has to be stated. */
const FILL = { width: '100%', height: '100%' } as const;

export function MaterialsSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (material: Material) => void;
}) {
  const [kind, setKind] = useState<MaterialKind>('background');
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Materials')} subtitle={t('Ready-made line art to drop into this panel')}>
      <Tabs tabs={TABS.map(tab => ({ ...tab, label: t(tab.label) }))} value={kind} onChange={setKind} stretch />
      <View className="flex-row flex-wrap gap-3 pt-3">
        {MATERIALS.filter(item => item.kind === kind).map(item => (
          <Pressable
            key={item.id}
            accessibilityLabel={t('Add {name}', { name: t(item.label) })}
            onPress={() => onPick(item)}
            className="w-[47%] grow gap-1"
          >
            <View className="overflow-hidden rounded-md bg-paper" style={{ aspectRatio: THUMB_RATIO[kind] }}>
              <Image accessibilityIgnoresInvertColors source={item.source} resizeMode="cover" style={FILL} />
            </View>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {t(item.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
