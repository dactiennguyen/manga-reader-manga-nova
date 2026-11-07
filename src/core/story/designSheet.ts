import { EXPRESSION_LABEL } from '../model/constants';
import type { CharacterSheet, Expression } from '../model/types';

export type SheetSlot = 'face' | 'body' | Expression;

export function slotLabel(slot: SheetSlot): string {
  if (slot === 'face') {
    return 'Face';
  }
  if (slot === 'body') {
    return 'Full body';
  }
  return EXPRESSION_LABEL[slot];
}

export function slotPath(sheet: CharacterSheet, slot: SheetSlot): string | undefined {
  if (slot === 'face' || slot === 'body') {
    return sheet[slot];
  }
  return sheet.expressions[slot];
}

export function withSlot(sheet: CharacterSheet, slot: SheetSlot, path: string | undefined): CharacterSheet {
  if (slot === 'face' || slot === 'body') {
    return { ...sheet, [slot]: path };
  }
  const expressions = { ...sheet.expressions };
  if (path) {
    expressions[slot] = path;
  } else {
    delete expressions[slot];
  }
  return { ...sheet, expressions };
}
