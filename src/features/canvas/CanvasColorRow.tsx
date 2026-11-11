import { CheckIcon, CloseIcon, EditIcon, PlusIcon } from '../../ui/icons';
import { useState } from 'react';
import { View } from 'react-native';

import { SAVED_COLORS_MAX, isGrayColor } from '../../core/art/palette';
import { t } from '../../core/i18n';
import { ICON, Icon, IconButton, Pressable, toast } from '../../ui';
import type { CanvasTools } from './useCanvasTools';

function Swatch({
  color,
  selected,
  label,
  removing,
  onPress,
  onRemove,
}: {
  color: string;
  selected: boolean;
  label: string;
  /** The palette is being edited: a tap removes the colour. */
  removing?: boolean;
  onPress: () => void;
  /** Only saved colours can be removed: by long press, in edit mode, or from the screen reader's actions. */
  onRemove?: () => void;
}) {
  return (
    <Pressable
      onPress={removing && onRemove ? onRemove : onPress}
      onLongPress={onRemove}
      accessibilityLabel={removing ? t('Remove {color} from your palette', { color }) : label}
      accessibilityHint={onRemove && !removing ? t('Long press to remove it from your palette') : undefined}
      accessibilityState={{ selected }}
      accessibilityActions={onRemove ? [{ name: 'remove', label: t('Remove from your palette') }] : undefined}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'remove') {
          onRemove?.();
        }
      }}
      className="h-12 w-12 items-center justify-center"
    >
      <View
        className={`h-7 w-7 rounded-full ${selected ? 'border-2 border-accent' : 'border border-control-border'}`}
        style={{ backgroundColor: color }}
      />
      {removing ? (
        <View className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-overlay">
          <Icon icon={CloseIcon} size={ICON.xs} color="danger" />
        </View>
      ) : null}
    </Pressable>
  );
}

function Rule() {
  return <View className="mx-1 h-6 w-0.5 bg-divider" />;
}

/** The colours offered for the current tool: recently used, the person's saved palette, then the built-in set. */
export function CanvasColorRow({ tools, colored }: { tools: CanvasTools; colored: boolean }) {
  const [editing, setEditing] = useState(false);
  const { color, saved, palette } = tools;
  // A colour already on the row, built in or saved, is not shown twice.
  const shown = new Set([...palette, ...saved].map(item => item.toLowerCase()));
  const recent = tools.recent.filter(item => !shown.has(item.toLowerCase()));
  const removing = editing && saved.length > 0;

  const save = () => {
    if (!colored && !isGrayColor(color)) {
      toast(t('A black and white story only keeps grays in its palette'));
      return;
    }
    const result = tools.saveColor();
    if (result === 'added') {
      toast(t('Color saved to your palette'));
    } else if (result === 'duplicate') {
      toast(t('This color is already in your palette'));
    } else if (result === 'full') {
      toast(t('Your palette holds {max} colors. Remove one first', { max: SAVED_COLORS_MAX }));
    }
  };

  const remove = (item: string) => {
    tools.removeSaved(item);
    toast(t('Removed from your palette'));
  };

  return (
    <>
      {recent.map(item => (
        <Swatch
          key={`r-${item}`}
          color={item}
          selected={item === color}
          label={t('Recent color {color}', { color: item })}
          onPress={() => tools.setColor(item)}
        />
      ))}
      {recent.length ? <Rule /> : null}
      {saved.map(item => (
        <Swatch
          key={`s-${item}`}
          color={item}
          selected={item === color}
          label={t('Saved color {color}', { color: item })}
          removing={removing}
          onPress={() => tools.setColor(item)}
          onRemove={() => remove(item)}
        />
      ))}
      <IconButton
        icon={PlusIcon}
        size={ICON.md}
        color="text-secondary"
        onPress={save}
        accessibilityLabel={t('Save this color to your palette')}
      />
      {saved.length ? (
        <IconButton
          icon={removing ? CheckIcon : EditIcon}
          size={ICON.md}
          color="text-secondary"
          active={removing}
          onPress={() => setEditing(!removing)}
          accessibilityLabel={removing ? t('Finish editing your palette') : t('Remove colors from your palette')}
        />
      ) : null}
      <Rule />
      {palette.map(item => (
        <Swatch
          key={item}
          color={item}
          selected={item === color}
          label={t('Color {color}', { color: item })}
          onPress={() => tools.setColor(item)}
        />
      ))}
    </>
  );
}
