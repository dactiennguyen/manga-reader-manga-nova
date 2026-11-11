import { t, tn } from '../i18n';
import type { ID, Page } from '../model/types';
import { panelOrder, type LayoutTemplate } from './layout';

export type ChangeWarning = { title: string; message: string; confirmText: string; destructive?: boolean };

/** Existing panels fill the template's slots in reading order, so the last ones are what falls off. */
export function droppedPanels(page: Pick<Page, 'layout' | 'order'>, template: Pick<LayoutTemplate, 'count'>, rtl: boolean): ID[] {
  return panelOrder(page, rtl).slice(template.count);
}

function droppedText(count: number): string {
  return tn(
    count,
    '{count} panel is dropped. Undo restores them with their art.',
    '{count} panels are dropped. Undo restores them with their art.',
  );
}

export function templateWarning(
  page: Pick<Page, 'layout' | 'order' | 'panels'>,
  template: Pick<LayoutTemplate, 'count'>,
  rtl: boolean,
  hasArt: (panelId: ID) => boolean,
): ChangeWarning | null {
  const dropped = droppedPanels(page, template, rtl).length;
  if (dropped > 0) {
    return {
      title: t('Change template?'),
      message: droppedText(dropped),
      confirmText: t('Change'),
    };
  }
  if (Object.keys(page.panels).some(hasArt)) {
    return { title: t('Change template?'), message: t('Art stays where it was on the page.'), confirmText: t('Change') };
  }
  return null;
}

export function clearWarning(panelCount: number): ChangeWarning {
  return {
    title: t('Clear all panels?'),
    message: droppedText(panelCount),
    confirmText: t('Clear'),
    destructive: true,
  };
}

export function pasteWarning(panelCount: number): ChangeWarning {
  return {
    title: t('Paste layout?'),
    message: tn(
      panelCount,
      'Current panels are replaced: {count} panel is dropped. Undo restores them with their art.',
      'Current panels are replaced: {count} panels are dropped. Undo restores them with their art.',
    ),
    confirmText: t('Paste'),
  };
}
