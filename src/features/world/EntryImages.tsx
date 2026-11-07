import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { AddImageIcon, DeleteIcon, PlusIcon, StarIcon } from '../../ui/icons';

import { LIMITS } from '../../core/model/constants';
import type { WorldEntry } from '../../core/model/types';
import { fileUri } from '../../core/util/paths';
import { pickImage } from '../../native/files';
import { useStory } from '../../state/useStory';
import { ICON, Icon, Menu, Pressable, Text, confirm, toast } from '../../ui';
import { ImageViewer } from '../characters/fields';

const IMAGE_SIZE = 168;

const FRAME = { width: IMAGE_SIZE, height: IMAGE_SIZE };

export function EntryImages({ entry }: { entry: WorldEntry }) {
  const update = useStory(s => s.updateWorldEntry);
  const [imageMenu, setImageMenu] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const currentImages = () => useStory.getState().world[entry.id]?.images ?? [];

  const addImage = async () => {
    if (entry.images.length >= LIMITS.worldImages) {
      toast(`Up to ${LIMITS.worldImages} images`);
      return;
    }
    try {
      const path = await pickImage();
      if (path) {
        update(entry.id, { images: [...currentImages(), path].slice(0, LIMITS.worldImages) });
      }
    } catch {
      toast('Could not load the image');
    }
  };

  const removeImage = async (path: string) => {
    const ok = await confirm('Delete this image?', undefined, { confirmText: 'Delete', destructive: true });
    if (ok) {
      update(entry.id, { images: currentImages().filter(item => item !== path) });
    }
  };

  return (
    <>
      {entry.images.length === 0 ? (
        <Pressable
          accessibilityLabel="Add image"
          onPress={addImage}
          className="mx-4 mt-3 h-13 flex-row items-center justify-center gap-2 overflow-hidden rounded-md bg-surface"
        >
          <Icon icon={AddImageIcon} size={ICON.md} color="text-secondary" />
          <Text variant="label" tone="secondary">
            Add image
          </Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4 pt-3">
          {entry.images.map((path, index) => (
            <Pressable
              key={path}
              accessibilityLabel={index === 0 ? 'Main image' : `Image ${index + 1}`}
              onPress={() => setViewing(path)}
              onLongPress={() => setImageMenu(path)}
              className="overflow-hidden rounded-md bg-surface"
              style={FRAME}
            >
              <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(path) }} className="h-full w-full" resizeMode="cover" />
              {index === 0 && entry.images.length > 1 && (
                <View className="absolute bottom-0 left-0 rounded-tr-sm bg-overlay px-2 py-0.5">
                  <Text variant="caption">Main image</Text>
                </View>
              )}
            </Pressable>
          ))}
          {entry.images.length < LIMITS.worldImages && (
            <Pressable
              accessibilityLabel="Add image"
              onPress={addImage}
              className="items-center justify-center gap-1 overflow-hidden rounded-md bg-surface"
              style={FRAME}
            >
              <Icon icon={PlusIcon} size={ICON.xl} color="text-muted" />
              <Text variant="caption" tone="muted">
                {entry.images.length}/{LIMITS.worldImages}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
      <Menu
        visible={!!imageMenu}
        onClose={() => setImageMenu(null)}
        title="Image"
        items={[
          {
            label: 'Set as main image',
            icon: StarIcon,
            disabled: entry.images[0] === imageMenu,
            onPress: () => {
              if (imageMenu) {
                update(entry.id, { images: [imageMenu, ...currentImages().filter(item => item !== imageMenu)] });
              }
            },
          },
          {
            label: 'Delete',
            icon: DeleteIcon,
            destructive: true,
            onPress: () => {
              if (imageMenu) {
                removeImage(imageMenu);
              }
            },
          },
        ]}
      />
      <ImageViewer path={viewing} title={entry.title.trim() || undefined} onClose={() => setViewing(null)} />
    </>
  );
}
