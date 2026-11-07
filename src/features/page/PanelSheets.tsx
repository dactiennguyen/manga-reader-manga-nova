import { useRef } from 'react';
import { CopyIcon, DeleteIcon, DoneIcon, EditIcon, ExpandIcon, FitIcon, PanelFrameIcon, ScriptIcon, SelectionIcon } from '../../ui/icons';

import { copyLayout, hasLayoutClipboard } from '../../core/layout/pageEdit';
import { HOME_VIEW } from '../../core/layout/pageView';
import { SHOTS, SHOT_LABEL } from '../../core/model/constants';
import { panelHasArt } from '../../state/artStore';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { ListItem, Menu, PromptDialog, Sheet, toast } from '../../ui';
import { TemplateSheet } from './TemplateSheet';
import type { PanelController } from './usePanelController';

export function PanelSheets({ c }: { c: PanelController }) {
  const navigation = useAppNavigation();
  const jumpTo = useRef<number | null>(null);
  const { ctx, chapter, page, pageId, selected, layout, sheet, panelMenu } = c;
  const { project, size, rtl, shapes } = ctx;
  const selectedPanel = selected ? page.panels[selected] : undefined;
  const menuPanel = panelMenu ? page.panels[panelMenu.id] : undefined;
  const closeSheet = () => c.setSheet(null);
  const closePanelMenu = () => c.setPanelMenu(menu => menu && { ...menu, open: false });
  const setShot = (shot: (typeof SHOTS)[number] | undefined) => {
    if (selected) {
      useStory.getState().updatePanel(pageId, selected, { shot });
    }
  };
  const scriptBlockId = shapes.map(shape => page.panels[shape.id]?.blockIds[0]).find(Boolean);

  return (
    <>
      <TemplateSheet
        visible={c.templatesOpen}
        format={project.format}
        ratio={size.h / size.w}
        rtl={rtl}
        onClose={() => c.setTemplatesOpen(false)}
        onPick={c.pickTemplate}
      />
      <Menu
        visible={sheet === 'menu'}
        onClose={closeSheet}
        items={[
          {
            label: 'View script for this page',
            icon: ScriptIcon,
            onPress: () => navigation.navigate('Script', { chapterId: chapter.id, blockId: scriptBlockId }),
          },
          { label: 'Fit to screen', icon: FitIcon, onPress: () => c.setView(HOME_VIEW) },
          {
            label: c.safeGrid ? 'Hide safe area' : 'Show safe area',
            icon: PanelFrameIcon,
            onPress: () => c.setSafeGrid(!c.safeGrid),
          },
          {
            label: 'Copy layout',
            icon: CopyIcon,
            disabled: !layout,
            onPress: () => {
              copyLayout(page);
              toast('Layout copied');
            },
          },
          { label: 'Paste layout', icon: SelectionIcon, disabled: !hasLayoutClipboard(), onPress: c.paste },
          { label: 'Clear all panels', icon: DeleteIcon, destructive: true, disabled: !layout, onPress: c.clearPanels },
        ]}
      />
      <Menu
        visible={!!panelMenu?.open && !!menuPanel}
        onClose={closePanelMenu}
        title={menuPanel ? `Panel ${(shapes.find(shape => shape.id === menuPanel.id)?.index ?? 0) + 1}` : undefined}
        items={
          menuPanel
            ? [
                {
                  label: menuPanel.bleed ? 'Turn off bleed' : 'Bleed',
                  icon: ExpandIcon,
                  onPress: () => c.togglePanel(menuPanel.id, 'bleed'),
                },
                {
                  label: menuPanel.borderless ? 'Show border' : 'Borderless',
                  icon: SelectionIcon,
                  onPress: () => c.togglePanel(menuPanel.id, 'borderless'),
                },
                { label: 'Delete panel', icon: DeleteIcon, destructive: true, onPress: () => c.deletePanel(menuPanel.id) },
              ]
            : []
        }
      />
      <Menu
        visible={sheet === 'art' && !!selectedPanel}
        onClose={closeSheet}
        items={[
          { label: 'Edit description', icon: EditIcon, onPress: () => c.setSheet('describe') },
          { label: 'Change shot', icon: FitIcon, onPress: () => c.setSheet('shot') },
          {
            label: 'Delete art',
            icon: DeleteIcon,
            destructive: true,
            disabled: !selected || !panelHasArt(selected),
            onPress: c.deleteArt,
          },
        ]}
      />
      <Menu
        visible={sheet === 'shot' && !!selectedPanel}
        onClose={closeSheet}
        title="Shot"
        items={[
          ...SHOTS.map(shot => ({
            label: SHOT_LABEL[shot],
            icon: selectedPanel?.shot === shot ? DoneIcon : undefined,
            onPress: () => setShot(shot),
          })),
          { label: 'No shot', onPress: () => setShot(undefined) },
        ]}
      />
      <PromptDialog
        visible={sheet === 'describe' && !!selectedPanel}
        onClose={closeSheet}
        title="Panel description"
        initialValue={selectedPanel?.description ?? ''}
        placeholder="What happens in this panel?"
        multiline
        allowEmpty
        onSubmit={value => {
          if (selected) {
            useStory.getState().updatePanel(pageId, selected, { description: value.trim() });
          }
          closeSheet();
        }}
      />
      <Sheet
        visible={sheet === 'jump'}
        onClose={closeSheet}
        onClosed={() => {
          const target = jumpTo.current;
          jumpTo.current = null;
          if (target !== null) {
            c.goTo(target);
          }
        }}
        title="Jump to page"
      >
        {chapter.pageIds.map((id, target) => (
          <ListItem
            key={id}
            title={`Page ${target + 1}`}
            subtitle={id === pageId ? 'Current' : undefined}
            onPress={() => {
              jumpTo.current = id === pageId ? null : target;
              closeSheet();
            }}
          />
        ))}
      </Sheet>
    </>
  );
}
