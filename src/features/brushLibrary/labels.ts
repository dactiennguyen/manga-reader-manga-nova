import type { BrushFileError } from '../../core/art/brushFile';
import { DEFAULT_SET_ID, type PresetSet } from '../../core/art/presets';
import { t, tn } from '../../core/i18n';

/** What a set is called on screen: the default set has no name until the person gives it one. */
export function setLabel(set: PresetSet): string {
  return set.name || (set.id === DEFAULT_SET_ID ? t('General|brush set') : t('Untitled'));
}

/** "3 brushes · 2 tones", leaving out a kind the set has none of. */
export function countLabel(brushes: number, tones: number): string {
  if (!brushes && !tones) {
    return t('Empty|brush set');
  }
  const parts: string[] = [];
  if (brushes) {
    parts.push(tn(brushes, '{count} brush', '{count} brushes'));
  }
  if (tones) {
    parts.push(tn(tones, '{count} tone', '{count} tones'));
  }
  return parts.join(' · ');
}

export function brushFileError(reason: BrushFileError | 'read'): string {
  switch (reason) {
    case 'newer':
      return t('This brush file was made by a newer Manganova. Update the app to open it.');
    case 'empty':
      return t('This brush file has no brushes or tones in it.');
    case 'size':
      return t('This file is too big to be a brush file.');
    default:
      return t("This file can't be read as brushes.");
  }
}
