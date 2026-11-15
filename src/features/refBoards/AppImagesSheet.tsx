import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { t } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { fileUri } from '../../core/util/paths';
import { useStory } from '../../state/useStory';
import type { RefImageSource } from '../../state/useRefBoards';
import { Button, EmptyState, ICON, Icon, Pressable, Segmented, Sheet, Text } from '../../ui';
import { CheckIcon, ImagesIcon } from '../../ui/icons';

type Group = { key: string; title: string; paths: string[] };

export type AppPick = { path: string; source: RefImageSource; caption?: string };

const THUMB = { width: 88, height: 88 };

/** Pictures already in the app: character design sheets and world entries. Picked ones are copied. */
export function AppImagesSheet({
  visible,
  projectId,
  onClose,
  onAdd,
}: {
  visible: boolean;
  /** Only this story's pictures when the board is linked to one. */
  projectId?: ID;
  onClose: () => void;
  onAdd: (picks: AppPick[]) => void;
}) {
  const projects = useStory(s => s.projects);
  const characters = useStory(s => s.characters);
  const world = useStory(s => s.world);
  const [tab, setTab] = useState<RefImageSource>('character');
  const [picked, setPicked] = useState<Map<string, AppPick>>(new Map());
  const chosen = useRef<AppPick[] | null>(null);

  useEffect(() => {
    if (visible) {
      setPicked(new Map());
    }
  }, [visible]);

  const groups = useMemo(() => {
    const live = (id: ID) => !!projects[id] && !projects[id].deletedAt && (!projectId || id === projectId);
    const suffix = (id: ID) => (projectId ? '' : ` · ${projects[id]?.title.trim() || t('Untitled')}`);
    const people: Group[] = Object.values(characters)
      .filter(character => live(character.projectId))
      .map(character => ({
        key: character.id,
        title: `${character.name.trim() || t('Unnamed')}${suffix(character.projectId)}`,
        paths: [character.sheet.face, character.sheet.body, ...Object.values(character.sheet.expressions)].filter(
          (path): path is string => !!path,
        ),
      }))
      .filter(group => group.paths.length > 0);
    const places: Group[] = Object.values(world)
      .filter(entry => live(entry.projectId))
      .map(entry => ({ key: entry.id, title: `${entry.title.trim() || t('Untitled')}${suffix(entry.projectId)}`, paths: entry.images }))
      .filter(group => group.paths.length > 0);
    return { character: people, world: places, device: [] as Group[] };
  }, [characters, world, projects, projectId]);

  const toggle = (path: string, caption: string) =>
    setPicked(current => {
      const next = new Map(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.set(path, { path, source: tab, caption });
      }
      return next;
    });

  const list = groups[tab];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        const picks = chosen.current;
        chosen.current = null;
        if (picks?.length) {
          onAdd(picks);
        }
      }}
      title={t('Pictures in your stories')}
      right={
        <Button
          small
          title={picked.size ? t('Add {count}', { count: picked.size }) : t('Add')}
          disabled={!picked.size}
          onPress={() => {
            chosen.current = [...picked.values()];
            onClose();
          }}
        />
      }
    >
      <View className="gap-3 px-4 pb-2">
        <Segmented
          options={[
            { value: 'character', label: t('Characters') },
            { value: 'world', label: t('World') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {list.length === 0 ? (
          <EmptyState
            icon={ImagesIcon}
            title={tab === 'character' ? t('No character pictures yet') : t('No world pictures yet')}
            message={t('Pictures you add to design sheets and world entries show up here.')}
          />
        ) : (
          list.map(group => (
            <View key={group.key} className="gap-2">
              <Text variant="label" tone="secondary" numberOfLines={1}>
                {group.title}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                {group.paths.map((path, index) => {
                  const selected = picked.has(path);
                  return (
                    <Pressable
                      key={path}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t('{name}, picture {n}', { name: group.title, n: index + 1 })}
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggle(path, group.title)}
                      className={`overflow-hidden rounded-md border-2 bg-overlay ${selected ? 'border-accent' : 'border-transparent'}`}
                      style={THUMB}
                    >
                      <Image accessibilityIgnoresInvertColors source={{ uri: fileUri(path) }} className="h-full w-full" resizeMode="cover" />
                      {selected ? (
                        <View className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-accent">
                          <Icon icon={CheckIcon} size={ICON.sm} color="on-accent" weight="bold" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ))
        )}
      </View>
    </Sheet>
  );
}
