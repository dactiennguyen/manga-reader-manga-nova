import { memo } from 'react';
import { TextInput, View } from 'react-native';
import { CaretDownIcon, CaretRightIcon, MoreIcon, PlusIcon } from '../../ui/icons';

import { msg, t, tn } from '../../core/i18n';
import { estimateScenePages } from '../../core/model/paginate';
import type { Character, ID, Scene } from '../../core/model/types';
import { pagesText, type PanelRef } from '../../core/script/blockOps';
import { ICON, Icon, IconButton, Pressable, Text, useColor } from '../../ui';
import { BlockRow } from './BlockRow';
import type { BlockApi, SceneApi } from './useScriptController';

const FIRST_PLACEHOLDER = msg('Where does the story begin?');

/** One list cell. The list recycles whole scenes, so the inputs inside a scene survive scrolling within it. */
export const SceneSection = memo(function SceneSectionBase({
  scene,
  index,
  characters,
  panels,
  matchIds,
  currentId,
  api,
  sceneApi,
}: {
  scene: Scene;
  index: number;
  characters: Record<ID, Character>;
  panels: Map<ID, PanelRef>;
  matchIds?: Set<ID>;
  currentId?: ID;
  api: BlockApi;
  sceneApi: SceneApi;
}) {
  const muted = useColor('text-muted');
  const accent = useColor('accent');
  const number = index + 1;
  return (
    <View className="gap-2 px-4 pb-3 md:px-6">
      <View className="flex-row items-center">
        <Pressable
          accessibilityLabel={t('Scene {n}', { n: number })}
          accessibilityState={{ expanded: !scene.collapsed }}
          onPress={() => sceneApi.toggle(scene.id)}
          className="min-h-12 flex-1 flex-row items-center gap-2"
        >
          <Icon icon={scene.collapsed ? CaretRightIcon : CaretDownIcon} size={ICON.md} />
          <Text variant="heading">{t('Scene {n}', { n: number })}</Text>
          <Text variant="caption" tone="muted" className="shrink" numberOfLines={1}>
            {pagesText(estimateScenePages(scene))} · {tn(scene.blocks.length, '{count} block', '{count} blocks')}
          </Text>
        </Pressable>
        <IconButton
          icon={MoreIcon}
          size={ICON.md}
          onPress={() => sceneApi.menu(scene.id)}
          accessibilityLabel={t('Scene {n} options', { n: number })}
        />
      </View>
      {!scene.collapsed && (
        <View className="gap-2" onLayout={event => sceneApi.layout(scene.id, event.nativeEvent.layout.y)}>
          {!!scene.description && (
            <TextInput
              value={scene.description}
              onChangeText={value => sceneApi.describe(scene.id, value)}
              multiline
              scrollEnabled={false}
              placeholder={t('Scene note from the outline')}
              placeholderTextColor={muted}
              cursorColor={accent}
              selectionColor={accent}
              accessibilityLabel={t('Scene note')}
              textAlignVertical="top"
              className="rounded-sm bg-surface px-3 py-2 text-body-sm font-inter text-text-secondary"
            />
          )}
          {scene.blocks.map((block, blockIndex) => {
            const panel = panels.get(block.id);
            return (
              <BlockRow
                key={block.id}
                block={block}
                character={block.characterId ? characters[block.characterId] : undefined}
                panelLabel={panel?.label}
                panelPageId={panel?.pageId}
                placeholder={index === 0 && blockIndex === 0 && block.type === 'setting' ? FIRST_PLACEHOLDER : undefined}
                mark={block.id === currentId ? 'current' : matchIds?.has(block.id) ? 'match' : undefined}
                api={api}
              />
            );
          })}
          <Pressable
            accessibilityLabel={t('Add block')}
            onPress={() => sceneApi.append(scene.id)}
            className="min-h-12 flex-row items-center gap-1 self-start"
          >
            <Icon icon={PlusIcon} size={ICON.xs} color="text-muted" />
            <Text variant="caption" tone="muted">
              {t('add block')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});
