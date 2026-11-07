import { useState } from 'react';
import { Image, Pressable as RNPressable, View } from 'react-native';
import { AddImageIcon, DeleteIcon, LockIcon, PlusIcon, UnlockIcon } from '../../ui/icons';

import { EXPRESSIONS, LIMITS } from '../../core/model/constants';
import type { Character } from '../../core/model/types';
import { slotLabel, slotPath, withSlot, type SheetSlot as Slot } from '../../core/story/designSheet';
import { fileUri } from '../../core/util/paths';
import { pickImage } from '../../native/files';
import { useStory } from '../../state/useStory';
import { Banner, Button, Icon, Menu, Pressable, SectionHeader, Text, confirm, toast } from '../../ui';
import { AutoField, ImageViewer, useSticky } from './fields';

const BIG_FRAME = { aspectRatio: 3 / 4 };
const SMALL_FRAME = { aspectRatio: 1 };

function SheetSlot({
  label,
  path,
  small,
  locked,
  onPress,
  onLongPress,
}: {
  label: string;
  path: string | undefined;
  small?: boolean;
  locked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <View className={small ? 'w-[31%] grow gap-1' : 'flex-1 gap-1'}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={path ? `View ${label} image` : `Upload ${label} image`}
        className="items-center justify-center overflow-hidden rounded-md bg-surface"
        style={small ? SMALL_FRAME : BIG_FRAME}
      >
        {path ? (
          <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(path) }} className="h-full w-full" resizeMode="cover" />
        ) : locked ? (
          <Icon icon={LockIcon} size={small ? 16 : 22} color="text-muted" />
        ) : (
          <Icon icon={PlusIcon} size={small ? 20 : 28} color="text-muted" />
        )}
      </Pressable>
      <Text variant={small ? 'caption' : 'label'} tone="secondary" numberOfLines={1} className="text-center">
        {label}
      </Text>
    </View>
  );
}

export function DesignTab({ character }: { character: Character }) {
  const update = useStory(s => s.updateCharacter);
  const [menuSlot, setMenuSlot] = useState<Slot | null>(null);
  const [viewSlot, setViewSlot] = useState<Slot | null>(null);
  const menuTitle = useSticky(menuSlot);
  const { sheet, locked } = character;
  const canLock = !!sheet.face && !!sheet.body;
  const displayName = character.name.trim() || 'this character';

  const upload = async (slot: Slot) => {
    try {
      const path = await pickImage();
      if (!path) {
        return;
      }
      const current = useStory.getState().characters[character.id];
      if (current) {
        update(character.id, { sheet: withSlot(current.sheet, slot, path) });
      }
    } catch {
      toast('Could not load the image');
    }
  };

  const clear = async (slot: Slot) => {
    const ok = await confirm(`Delete the ${slotLabel(slot)} image?`, undefined, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const current = useStory.getState().characters[character.id];
    if (current) {
      update(character.id, { sheet: withSlot(current.sheet, slot, undefined) });
    }
  };

  const pressSlot = (slot: Slot) => {
    if (slotPath(sheet, slot)) {
      setViewSlot(slot);
    } else if (locked) {
      toast('Unlock to edit the design sheet');
    } else {
      upload(slot);
    }
  };

  const longPressSlot = (slot: Slot) => {
    if (locked) {
      toast('Unlock to edit the design sheet');
    } else if (slotPath(sheet, slot)) {
      setMenuSlot(slot);
    } else {
      upload(slot);
    }
  };

  const lock = async () => {
    const ok = await confirm(
      'Lock as reference?',
      `These images become the reference for ${displayName}: look at them while drawing to keep the character consistent. While locked, the appearance and design sheet cannot be edited.`,
      { confirmText: 'Lock' },
    );
    if (ok) {
      update(character.id, { locked: true });
    }
  };

  const renderSlot = (slot: Slot, small?: boolean) => (
    <SheetSlot
      key={slot}
      label={slotLabel(slot)}
      path={slotPath(sheet, slot)}
      small={small}
      locked={locked}
      onPress={() => pressSlot(slot)}
      onLongPress={() => longPressSlot(slot)}
    />
  );

  return (
    <View className="gap-3">
      {locked && <Banner tone="info" icon={LockIcon} text="Locked as reference. Unlock to edit the appearance and images." />}
      <RNPressable
        accessible={locked}
        accessibilityRole="button"
        accessibilityLabel="Appearance, locked"
        onPress={locked ? () => toast('Unlock to edit the appearance') : undefined}
        disabled={!locked}
      >
        <View pointerEvents={locked ? 'none' : 'auto'}>
          <AutoField
            label="Appearance"
            value={character.appearance}
            onCommit={appearance => update(character.id, { appearance })}
            placeholder="Short messy black hair, big eyes, orange delivery jacket…"
            hint="Worth covering: hair, eyes, build, outfit, distinguishing features."
            multiline
            maxLength={LIMITS.appearance}
            showCount
            editable={!locked}
            minHeight={110}
          />
        </View>
      </RNPressable>

      <SectionHeader>Design sheet</SectionHeader>
      <View className="flex-row gap-3">
        {renderSlot('face')}
        {renderSlot('body')}
      </View>

      <SectionHeader>Expressions</SectionHeader>
      <View className="flex-row flex-wrap gap-2">{EXPRESSIONS.map(expression => renderSlot(expression, true))}</View>

      <Text variant="caption" tone="muted" className="my-1">
        Tap an empty slot to upload an image from your device; long-press a filled slot to replace or delete it. Reference
        images are what you look at while drawing so the character stays the same in every panel.
      </Text>

      {locked ? (
        <Button title="Unlock to edit" icon={UnlockIcon} variant="secondary" onPress={() => update(character.id, { locked: false })} />
      ) : (
        <Button title="Lock as reference" icon={LockIcon} disabled={!canLock} onPress={lock} />
      )}
      {!locked && !canLock && (
        <Text variant="caption" tone="muted" className="text-center">
          Add Face and Full body images to lock them as reference.
        </Text>
      )}

      <Menu
        visible={!!menuSlot}
        onClose={() => setMenuSlot(null)}
        title={menuTitle ? slotLabel(menuTitle) : undefined}
        items={[
          {
            label: 'Replace image',
            icon: AddImageIcon,
            onPress: () => {
              if (menuSlot) {
                upload(menuSlot);
              }
            },
          },
          {
            label: 'Delete image',
            icon: DeleteIcon,
            destructive: true,
            onPress: () => {
              if (menuSlot) {
                clear(menuSlot);
              }
            },
          },
        ]}
      />
      <ImageViewer
        path={viewSlot ? slotPath(sheet, viewSlot) : null}
        title={viewSlot ? `${displayName} · ${slotLabel(viewSlot)}` : undefined}
        onClose={() => setViewSlot(null)}
      />
    </View>
  );
}
