import { useRef } from 'react';
import { CopyIcon, DeleteIcon, DoneIcon, EditIcon, ExpandIcon, FitIcon, PanelFrameIcon, ScriptIcon, SelectionIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
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
            label: t('View script for this page'),
            icon: ScriptIcon,
            onPress: () => navigation.navigate('Script', { chapterId: chapter.id, blockId: scriptBlockId }),
          },
          { label: t('Fit to screen'), icon: FitIcon, onPress: () => c.setView(HOME_VIEW) },
          {
            label: c.safeGrid ? t('Hide safe area') : t('Show safe area'),
            icon: PanelFrameIcon,
            onPress: () => c.setSafeGrid(!c.safeGrid),
          },
          {
            label: t('Copy layout'),
            icon: CopyIcon,
            disabled: !layout,
            onPress: () => {
              copyLayout(page);
              toast(t('Layout copied'));
            },
          },
          { label: t('Paste layout'), icon: SelectionIcon, disabled: !hasLayoutClipboard(), onPress: c.paste },
          { label: t('Clear all panels'), icon: DeleteIcon, destructive: true, disabled: !layout, onPress: c.clearPanels },
        ]}
      />
      <Menu
        visible={!!panelMenu?.open && !!menuPanel}
        onClose={closePanelMenu}
        title={
          menuPanel ? t('Panel {n}', { n: (shapes.find(shape => shape.id === menuPanel.id)?.index ?? 0) + 1 }) : undefined
        }
        items={
          menuPanel
            ? [
                {
                  label: menuPanel.bleed ? t('Turn off bleed') : t('Bleed'),
                  icon: ExpandIcon,
                  onPress: () => c.togglePanel(menuPanel.id, 'bleed'),
                },
                {
                  label: menuPanel.borderless ? t('Show border') : t('Borderless'),
                  icon: SelectionIcon,
                  onPress: () => c.togglePanel(menuPanel.id, 'borderless'),
                },
                { label: t('Delete panel'), icon: DeleteIcon, destructive: true, onPress: () => c.deletePanel(menuPanel.id) },
              ]
            : []
        }
      />
      <Menu
        visible={sheet === 'art' && !!selectedPanel}
        onClose={closeSheet}
        items={[
          { label: t('Edit description'), icon: EditIcon, onPress: () => c.setSheet('describe') },
          { label: t('Change shot'), icon: FitIcon, onPress: () => c.setSheet('shot') },
          {
            label: t('Delete art'),
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
        title={t('Shot')}
        items={[
          ...SHOTS.map(shot => ({
            label: t(SHOT_LABEL[shot]),
            icon: selectedPanel?.shot === shot ? DoneIcon : undefined,
            onPress: () => setShot(shot),
          })),
          { label: t('No shot'), onPress: () => setShot(undefined) },
        ]}
      />
      <PromptDialog
        visible={sheet === 'describe' && !!selectedPanel}
        onClose={closeSheet}
        title={t('Panel description')}
        initialValue={selectedPanel?.description ?? ''}
        placeholder={t('What happens in this panel?')}
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
        title={t('Jump to page')}
      >
        {chapter.pageIds.map((id, target) => (
          <ListItem
            key={id}
            title={t('Page {n}', { n: target + 1 })}
            subtitle={id === pageId ? t('Current') : undefined}
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
