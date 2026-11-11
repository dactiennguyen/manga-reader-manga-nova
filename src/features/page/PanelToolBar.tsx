import { ScrollView, View } from 'react-native';
import { BrushIcon, CutIcon, MergeIcon, MinusIcon, MoreHorizontalIcon, OrderIcon, PlusIcon, SlidersIcon, TemplatesIcon } from '../../ui/icons';

import { msg, t } from '../../core/i18n';
import { SHOT_LABEL } from '../../core/model/constants';
import { useAppNavigation } from '../../state/navigation';
import { Button, Chip, IconButton, Slider, Text, ToolPanel } from '../../ui';
import type { PanelController, Tool } from './usePanelController';

const TOOL_HINT: Record<Tool, string> = {
  none: msg('Drag a handle to move a divider. Long-press a panel for more.'),
  cut: msg('Draw a line across the panel to cut.'),
  merge: msg('Tap two adjacent panels to merge them.'),
  gutter: msg('Adjust the gutter between panels.'),
  order: msg('Tap the panels in reading order.'),
};

const GUTTER_MIN = 4;
const GUTTER_MAX = 60;

export function PanelToolBar({ c }: { c: PanelController }) {
  const { layout, page, tool } = c;
  return (
    <ToolPanel className="mx-2 mb-1">
      <Text variant="caption" tone="secondary">
        {layout ? t(TOOL_HINT[tool]) : t('No panels yet. Pick a template to start.')}
      </Text>
      {tool === 'gutter' && (
        <View>
          <Text variant="caption">
            {t('Horizontal gutter')} · {Math.round(page.gutterH)}
          </Text>
          <Slider
            label={t('Horizontal gutter')}
            value={page.gutterH}
            min={GUTTER_MIN}
            max={GUTTER_MAX}
            onChange={value => c.setGutter({ gutterH: value })}
            onComplete={c.endGutter}
          />
          <Text variant="caption">
            {t('Vertical gutter')} · {Math.round(page.gutterV)}
          </Text>
          <Slider
            label={t('Vertical gutter')}
            value={page.gutterV}
            min={GUTTER_MIN}
            max={GUTTER_MAX}
            onChange={value => c.setGutter({ gutterV: value })}
            onComplete={c.endGutter}
          />
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 py-1.5">
        <Chip label={t('Templates')} icon={TemplatesIcon} onPress={() => c.setTemplatesOpen(true)} />
        {!!layout && (
          <>
            <Chip label={t('Cut')} icon={CutIcon} selected={tool === 'cut'} onPress={() => c.pickTool('cut')} />
            <Chip label={t('Merge')} icon={MergeIcon} selected={tool === 'merge'} onPress={() => c.pickTool('merge')} />
            <Chip label={t('Gutter')} icon={SlidersIcon} selected={tool === 'gutter'} onPress={() => c.pickTool('gutter')} />
            <Chip label={t('Order')} icon={OrderIcon} selected={tool === 'order'} onPress={() => c.pickTool('order')} />
          </>
        )}
        {tool === 'order' && !!page.order && <Chip label={t('Auto')} onPress={c.autoOrder} />}
        {c.webtoon && (
          <>
            <Chip label={t('Extend strip')} icon={PlusIcon} onPress={c.extend} />
            <Chip label={t('Shorten')} icon={MinusIcon} onPress={c.shorten} />
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
          {t('Panel {n}', { n: number })}
          {panel.shot ? ` · ${t(SHOT_LABEL[panel.shot])}` : ''}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {panel.description || t('No description')}
        </Text>
      </View>
      <Button title={t('Draw')} icon={BrushIcon} small onPress={() => navigation.navigate('Canvas', { pageId, panelId: panel.id })} />
      <IconButton icon={MoreHorizontalIcon} onPress={() => c.setSheet('art')} accessibilityLabel={t('Panel options')} />
    </ToolPanel>
  );
}
