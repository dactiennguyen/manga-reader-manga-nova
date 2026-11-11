import {
  CloseIcon,
  DeleteIcon,
  DoneIcon,
  FlipIcon,
  FlipVerticalIcon,
  MaximizeIcon,
  MinimizeIcon,
  RotateIcon,
  RotateLeftIcon,
  SelectAllIcon,
} from '../../ui/icons';
import { View } from 'react-native';

import type { SelectionOp } from '../../core/art/affine';
import { msg, t } from '../../core/i18n';
import { Button, IconButton, Text, type IconGlyph } from '../../ui';

export type SelectionControls = {
  /** How many strokes are selected. */
  count: number;
  onAll: () => void;
  onOp: (op: SelectionOp) => void;
  onDelete: () => void;
  onCancel: () => void;
  onApply: () => void;
};

/** Buttons that do what the frame's handles do, for when a drag is hard to make. */
const OPS: { op: SelectionOp; label: string; icon: IconGlyph }[] = [
  { op: 'rotateLeft', label: msg('Turn left 90°'), icon: RotateLeftIcon },
  { op: 'rotateRight', label: msg('Turn right 90°'), icon: RotateIcon },
  { op: 'flipH', label: msg('Flip horizontally'), icon: FlipIcon },
  { op: 'flipV', label: msg('Flip vertically'), icon: FlipVerticalIcon },
  { op: 'shrink', label: msg('Make smaller'), icon: MinimizeIcon },
  { op: 'grow', label: msg('Make larger'), icon: MaximizeIcon },
];

export function CanvasSelectionBar({ selection }: { selection: SelectionControls }) {
  if (!selection.count) {
    return (
      <View className="flex-row items-center gap-2">
        <Text variant="bodySmall" tone="secondary" className="flex-1 px-1">
          {t('Draw around the strokes you want to move, scale or turn.')}
        </Text>
        <Button small variant="secondary" icon={SelectAllIcon} title={t('Select all')} onPress={selection.onAll} />
      </View>
    );
  }
  // Two rows: nine 48dp buttons do not fit a 360dp phone, and a scrolled-away Delete is easy to miss.
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        {OPS.map(item => (
          <IconButton
            key={item.op}
            icon={item.icon}
            onPress={() => selection.onOp(item.op)}
            accessibilityLabel={t(item.label)}
          />
        ))}
      </View>
      <View className="flex-row items-center gap-2">
        <Button
          small
          variant="danger"
          icon={DeleteIcon}
          title={t('Delete')}
          onPress={selection.onDelete}
          className="mr-auto"
        />
        <Button small variant="secondary" icon={CloseIcon} title={t('Cancel')} onPress={selection.onCancel} />
        <Button small icon={DoneIcon} title={t('Apply')} onPress={selection.onApply} />
      </View>
    </View>
  );
}
