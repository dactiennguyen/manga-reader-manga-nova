import { ArrowDownIcon, ArrowUpIcon, CloseIcon, DeleteIcon, EditIcon, HiddenIcon, ImageIcon, LockIcon, MergeIcon, PlusIcon, PreviewIcon, UnlockIcon } from '../../ui/icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';

import { LIMITS } from '../../core/model/constants';
import type { ArtLayer, ID, PanelArt } from '../../core/model/types';
import {
  addLayer,
  editLayer,
  loadArt,
  mergeLayers,
  removeLayer,
  reorderLayers,
  setActiveLayer,
  useArtRev,
} from '../../state/artStore';
import { ICON, IconButton, Pressable, PromptDialog, Slider, Text, confirm, toast } from '../../ui';

export function LayerPanel({
  panelId,
  fallback,
  side,
  onImportImage,
  onOpacityPreview,
  onClose,
}: {
  panelId: ID;
  fallback: PanelArt;
  side: 'left' | 'right';
  onImportImage: () => void;
  onOpacityPreview: (preview: { id: ID; value: number } | null) => void;
  onClose: () => void;
}) {
  // Reads the store itself: stroke counts move with every stroke, and the screen does not re-render for those.
  useArtRev(panelId);
  const art = loadArt(panelId) ?? fallback;
  const [renameId, setRenameId] = useState<ID | null>(null);
  const renaming = art.layers.find(layer => layer.id === renameId);
  const full = art.layers.length >= LIMITS.layers;

  const add = () => {
    if (full) {
      toast(`Up to ${LIMITS.layers} layers`);
      return;
    }
    const at = art.layers.findIndex(item => item.id === art.activeLayerId);
    addLayer(panelId, `Layer ${art.layers.length + 1}`, {}, at < 0 ? art.layers.length : at + 1);
  };

  const remove = async (layer: ArtLayer) => {
    if (art.layers.length <= 1) {
      toast('Keep at least one layer');
      return;
    }
    if (
      (layer.strokes.length || layer.image) &&
      !(await confirm(`Delete layer "${layer.name}"?`, 'Its strokes will be lost.', {
        confirmText: 'Delete',
        destructive: true,
      }))
    ) {
      return;
    }
    const index = art.layers.indexOf(layer);
    const next = art.layers.filter(item => item !== layer);
    removeLayer(panelId, layer.id);
    if (art.activeLayerId === layer.id) {
      setActiveLayer(panelId, next[Math.max(0, index - 1)].id);
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= art.layers.length) {
      return;
    }
    const ids = art.layers.map(layer => layer.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderLayers(panelId, ids);
  };

  const mergeDown = (index: number) => {
    const upper = art.layers[index];
    const lower = art.layers[index - 1];
    if (!lower) {
      return;
    }
    if (lower.locked) {
      toast('The layer below is locked');
      return;
    }
    if (upper.image && (lower.image || lower.strokes.length)) {
      toast('Cannot merge an image layer onto a layer with content');
      return;
    }
    const strokes = upper.strokes.map(stroke =>
      stroke.tool === 'eraser' || upper.opacity >= 1 ? stroke : { ...stroke, opacity: stroke.opacity * upper.opacity },
    );
    mergeLayers(panelId, upper.id, lower.id, {
      strokes: [...lower.strokes, ...strokes],
      image: lower.image ?? upper.image,
    });
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close layers panel" />
      <Animated.View
        entering={(side === 'right' ? SlideInRight : SlideInLeft).duration(160)}
        className={`absolute bottom-0 top-0 w-72 bg-raised p-2 ${side === 'right' ? 'right-0' : 'left-0'}`}
      >
        <View className="flex-row items-center">
          <Text variant="label" tone="secondary" className="flex-1 pl-1">
            Layers {art.layers.length}/{LIMITS.layers}
          </Text>
          <IconButton icon={ImageIcon} size={ICON.md} onPress={onImportImage} accessibilityLabel="Import image into layer" />
          <IconButton icon={PlusIcon} size={ICON.md} onPress={add} disabled={full} accessibilityLabel="Add layer" />
          <IconButton icon={CloseIcon} size={ICON.md} onPress={onClose} accessibilityLabel="Close" />
        </View>
        <ScrollView contentContainerClassName="gap-2 pb-4">
          {art.layers
            .map((layer, index) => ({ layer, index }))
            .reverse()
            .map(({ layer, index }) => {
              const active = layer.id === art.activeLayerId;
              return (
                <View
                  key={layer.id}
                  className={`rounded-md border-2 bg-overlay p-1 ${active ? 'border-accent' : 'border-transparent'}`}
                >
                  <View className="flex-row items-center gap-1">
                    <IconButton
                      icon={layer.visible ? PreviewIcon : HiddenIcon}
                      size={ICON.md}
                      accessibilityLabel={layer.visible ? 'Hide layer' : 'Show layer'}
                      onPress={() => editLayer(panelId, layer.id, { visible: !layer.visible })}
                    />
                    <Pressable
                      className="min-h-12 flex-1 justify-center"
                      onPress={() => setActiveLayer(panelId, layer.id)}
                      accessibilityLabel={`Select layer ${layer.name}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text variant="label" numberOfLines={1}>
                        {layer.name}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {Math.round(layer.opacity * 100)}% · {layer.strokes.length} strokes
                        {layer.image ? ' · image' : ''}
                      </Text>
                    </Pressable>
                    <IconButton
                      icon={layer.locked ? LockIcon : UnlockIcon}
                      size={ICON.md}
                      accessibilityLabel={layer.locked ? 'Unlock layer' : 'Lock layer'}
                      onPress={() => editLayer(panelId, layer.id, { locked: !layer.locked })}
                    />
                  </View>
                  {active ? (
                    <>
                      <View className="px-2">
                        <Slider
                          label="Layer opacity"
                          value={layer.opacity}
                          min={0}
                          max={1}
                          onChange={value => onOpacityPreview({ id: layer.id, value: Math.round(value * 100) / 100 })}
                          onComplete={value => {
                            editLayer(panelId, layer.id, { opacity: Math.round(value * 100) / 100 });
                            onOpacityPreview(null);
                          }}
                        />
                      </View>
                      <View className="flex-row justify-between">
                        <IconButton
                          icon={ArrowUpIcon}
                          size={ICON.md}
                          accessibilityLabel="Move layer up"
                          onPress={() => move(index, 1)}
                          disabled={index >= art.layers.length - 1}
                        />
                        <IconButton
                          icon={ArrowDownIcon}
                          size={ICON.md}
                          accessibilityLabel="Move layer down"
                          onPress={() => move(index, -1)}
                          disabled={index === 0}
                        />
                        <IconButton
                          icon={MergeIcon}
                          size={ICON.md}
                          accessibilityLabel="Merge down"
                          onPress={() => mergeDown(index)}
                          disabled={index === 0}
                        />
                        <IconButton
                          icon={EditIcon}
                          size={ICON.md}
                          accessibilityLabel="Rename layer"
                          onPress={() => setRenameId(layer.id)}
                        />
                        <IconButton icon={DeleteIcon} size={ICON.md} accessibilityLabel="Delete layer" onPress={() => remove(layer)} />
                      </View>
                    </>
                  ) : null}
                </View>
              );
            })}
        </ScrollView>
      </Animated.View>
      <PromptDialog
        visible={!!renaming}
        onClose={() => setRenameId(null)}
        title="Rename layer"
        initialValue={renaming?.name ?? ''}
        maxLength={30}
        onSubmit={value => {
          if (renaming && value.trim()) {
            editLayer(panelId, renaming.id, { name: value.trim() });
          }
          setRenameId(null);
        }}
      />
    </View>
  );
}
