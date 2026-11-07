import { plural } from '../util/format';
import type { ID, Page } from '../model/types';
import { panelOrder, type LayoutTemplate } from './layout';

export type ChangeWarning = { title: string; message: string; confirmText: string; destructive?: boolean };

const UNDO_NOTE = 'Undo restores them with their art.';

/** Existing panels fill the template's slots in reading order, so the last ones are what falls off. */
export function droppedPanels(page: Pick<Page, 'layout' | 'order'>, template: Pick<LayoutTemplate, 'count'>, rtl: boolean): ID[] {
  return panelOrder(page, rtl).slice(template.count);
}

function droppedText(count: number): string {
  return `${plural(count, 'panel')} ${count === 1 ? 'is' : 'are'} dropped.`;
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
      title: 'Change template?',
      message: `${droppedText(dropped)} ${UNDO_NOTE}`,
      confirmText: 'Change',
    };
  }
  if (Object.keys(page.panels).some(hasArt)) {
    return { title: 'Change template?', message: 'Art stays where it was on the page.', confirmText: 'Change' };
  }
  return null;
}

export function clearWarning(panelCount: number): ChangeWarning {
  return {
    title: 'Clear all panels?',
    message: `${droppedText(panelCount)} ${UNDO_NOTE}`,
    confirmText: 'Clear',
    destructive: true,
  };
}

export function pasteWarning(panelCount: number): ChangeWarning {
  return {
    title: 'Paste layout?',
    message: `Current panels are replaced: ${droppedText(panelCount)} ${UNDO_NOTE}`,
    confirmText: 'Paste',
  };
}
