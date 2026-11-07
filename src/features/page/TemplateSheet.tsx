import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { templatePreview, templatesFor, type LayoutTemplate, type TemplateKind } from '../../core/layout/layout';
import type { ProjectFormat } from '../../core/model/types';
import { plural } from '../../core/util/format';
import { INK, PAPER } from '../../render/ink';
import { Chip, ChipRow, Pressable, Sheet, Text } from '../../ui';

const KIND_LABEL: Record<TemplateKind, string> = {
  grid: 'Even grid',
  diagonal: 'Diagonal',
  bleed: 'Bleed',
  koma: '4-koma',
  strip: 'Strip',
};

const SHEET_MAX = 560;
const SIDE_PAD = 16;
const TILE_GAP = 12;
const COLUMNS = 3;
const MAX_RATIO = 1.6;

function TemplateTile({
  template,
  width,
  ratio,
  rtl,
  onPress,
}: {
  template: LayoutTemplate;
  width: number;
  ratio: number;
  rtl: boolean;
  onPress: () => void;
}) {
  const height = width * ratio;
  const shapes = useMemo(() => templatePreview(template, { w: width, h: height }, rtl), [template, width, height, rtl]);
  return (
    <Pressable
      accessibilityLabel={`${template.count}-panel template, ${KIND_LABEL[template.kind]}`}
      onPress={onPress}
      className="items-center gap-1"
    >
      <View className="overflow-hidden rounded-sm bg-white" style={{ width, height }}>
        <Svg width={width} height={height}>
          {shapes.map(shape => (
            <Polygon
              key={shape.id}
              points={shape.poly.map(p => `${p.x},${p.y}`).join(' ')}
              fill={PAPER}
              stroke={INK}
              strokeWidth={1.5}
            />
          ))}
        </Svg>
      </View>
      <Text variant="caption" tone="secondary">
        {plural(template.count, 'panel')}
      </Text>
    </Pressable>
  );
}

export function TemplateSheet({
  visible,
  format,
  ratio,
  rtl,
  onClose,
  onPick,
}: {
  visible: boolean;
  format: ProjectFormat;
  ratio: number;
  rtl: boolean;
  onClose: () => void;
  onPick: (template: LayoutTemplate) => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const [count, setCount] = useState(0);
  const [kind, setKind] = useState<TemplateKind | null>(null);
  const all = useMemo(() => templatesFor(format), [format]);
  const counts = useMemo(() => [...new Set(all.map(t => t.count))].sort((a, b) => a - b), [all]);
  const kinds = useMemo(() => [...new Set(all.map(t => t.kind))], [all]);
  const shown = all.filter(t => (!count || t.count === count) && (!kind || t.kind === kind));
  const tileW = Math.floor((Math.min(screenW, SHEET_MAX) - SIDE_PAD * 2 - TILE_GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <Sheet visible={visible} onClose={onClose} title="Panel templates">
      <ChipRow className="px-4">
        <Chip label="All" selected={!count} onPress={() => setCount(0)} />
        {counts.map(n => (
          <Chip key={n} label={`${n}`} selected={count === n} onPress={() => setCount(n)} />
        ))}
      </ChipRow>
      {kinds.length > 1 && (
        <ChipRow className="px-4">
          <Chip label="Any style" selected={!kind} onPress={() => setKind(null)} />
          {kinds.map(item => (
            <Chip key={item} label={KIND_LABEL[item]} selected={kind === item} onPress={() => setKind(item)} />
          ))}
        </ChipRow>
      )}
      <View className="flex-row flex-wrap" style={{ gap: TILE_GAP, padding: SIDE_PAD }}>
        {shown.map(template => (
          <TemplateTile
            key={template.id}
            template={template}
            width={tileW}
            ratio={Math.min(ratio, MAX_RATIO)}
            rtl={rtl}
            onPress={() => onPick(template)}
          />
        ))}
      </View>
    </Sheet>
  );
}
