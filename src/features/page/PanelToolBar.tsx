import { ScrollView, View } from 'react-native';
import { BrushIcon, CutIcon, MergeIcon, MinusIcon, MoreHorizontalIcon, OrderIcon, PlusIcon, SlidersIcon, TemplatesIcon } from '../../ui/icons';

import { SHOT_LABEL } from '../../core/model/constants';
import { useAppNavigation } from '../../state/navigation';
import { Button, Chip, IconButton, Slider, Text, ToolPanel } from '../../ui';
import type { PanelController, Tool } from './usePanelController';

const TOOL_HINT: Record<Tool, string> = {
  none: 'Drag a handle to move a divider. Long-press a panel for more.',
  cut: 'Draw a line across the panel to cut.',
  merge: 'Tap two adjacent panels to merge them.',
  gutter: 'Adjust the gutter between panels.',
  order: 'Tap the panels in reading order.',
};

const GUTTER_MIN = 4;
const GUTTER_MAX = 60;

export function PanelToolBar({ c }: { c: PanelController }) {
  const { layout, page, tool } = c;
  return (
    <ToolPanel className="mx-2 mb-1">
      <Text variant="caption" tone="secondary">
        {layout ? TOOL_HINT[tool] : 'No panels yet. Pick a template to start.'}
      </Text>
      {tool === 'gutter' && (
        <View>
          <Text variant="caption">Horizontal gutter · {Math.round(page.gutterH)}</Text>
          <Slider
            label="Horizontal gutter"
            value={page.gutterH}
            min={GUTTER_MIN}
            max={GUTTER_MAX}
            onChange={value => c.setGutter({ gutterH: value })}
            onComplete={c.endGutter}
          />
          <Text variant="caption">Vertical gutter · {Math.round(page.gutterV)}</Text>
          <Slider
            label="Vertical gutter"
            value={page.gutterV}
            min={GUTTER_MIN}
            max={GUTTER_MAX}
            onChange={value => c.setGutter({ gutterV: value })}
            onComplete={c.endGutter}
          />
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 py-1.5">
        <Chip label="Templates" icon={TemplatesIcon} onPress={() => c.setTemplatesOpen(true)} />
        {!!layout && (
          <>
            <Chip label="Cut" icon={CutIcon} selected={tool === 'cut'} onPress={() => c.pickTool('cut')} />
            <Chip label="Merge" icon={MergeIcon} selected={tool === 'merge'} onPress={() => c.pickTool('merge')} />
            <Chip label="Gutter" icon={SlidersIcon} selected={tool === 'gutter'} onPress={() => c.pickTool('gutter')} />
            <Chip label="Order" icon={OrderIcon} selected={tool === 'order'} onPress={() => c.pickTool('order')} />
          </>
        )}
        {tool === 'order' && !!page.order && <Chip label="Auto" onPress={c.autoOrder} />}
        {c.webtoon && (
          <>
            <Chip label="Extend strip" icon={PlusIcon} onPress={c.extend} />
            <Chip label="Shorten" icon={MinusIcon} onPress={c.shorten} />
          </>
        )}
      </ScrollView>
    </ToolPanel>
  );
}

export function PanelArtCard({ c }: { c: PanelController }) {
  const navigation = useAppNavigation();
  const { selected, page, pageId, ctx } = c;
  const panel = selected ? page.panels[selected] : undefined;
  if (!panel) {
    return null;
  }
  const number = (ctx.shapes.find(shape => shape.id === panel.id)?.index ?? 0) + 1;
  return (
    <ToolPanel className="mx-2 mb-1 flex-row items-center">
      <View className="flex-1">
        <Text variant="label">
          Panel {number}
          {panel.shot ? ` · ${SHOT_LABEL[panel.shot]}` : ''}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {panel.description || 'No description'}
        </Text>
      </View>
      <Button title="Draw" icon={BrushIcon} small onPress={() => navigation.navigate('Canvas', { pageId, panelId: panel.id })} />
      <IconButton icon={MoreHorizontalIcon} onPress={() => c.setSheet('art')} accessibilityLabel="Panel options" />
    </ToolPanel>
  );
}
