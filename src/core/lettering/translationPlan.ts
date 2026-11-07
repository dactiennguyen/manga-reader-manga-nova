import type { Bubble, ID } from '../model/types';
import { hasTranslation } from './translation';

export type TranslateMode = 'missing' | 'all';

export type Proposal = { pageId: ID; bubbleId: ID; original: string; text: string };

export function translationTargets(
  sections: { pageId: ID; bubbles: Pick<Bubble, 'id' | 'text' | 'translations'>[] }[],
  lang: string,
  mode: TranslateMode,
): Omit<Proposal, 'text'>[] {
  return sections.flatMap(section =>
    section.bubbles
      .filter(bubble => bubble.text.trim() !== '' && (mode === 'all' || !hasTranslation(bubble, lang)))
      .map(bubble => ({ pageId: section.pageId, bubbleId: bubble.id, original: bubble.text.trim() })),
  );
}

export function groupProposals(
  proposals: Proposal[],
  currentPageId: ID,
): { current: Record<ID, string>; others: Record<ID, Record<ID, string>> } {
  const current: Record<ID, string> = {};
  const others: Record<ID, Record<ID, string>> = {};
  proposals.forEach(item => {
    const text = item.text.trim();
    if (!text) {
      return;
    }
    if (item.pageId === currentPageId) {
      current[item.bubbleId] = text;
    } else {
      (others[item.pageId] ??= {})[item.bubbleId] = text;
    }
  });
  return { current, others };
}
