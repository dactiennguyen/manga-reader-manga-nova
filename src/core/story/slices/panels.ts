import { TEMPLATES, buildTemplate, defaultTemplate, panelOrder } from '../../layout/layout';
import type { PagePlan } from '../../model/paginate';
import type { ID, LayoutNode, Panel, ProjectFormat } from '../../model/types';
import { uid } from '../../util/id';

export function newPanel(id: ID, init?: Partial<Panel>): Panel {
  return { id, bleed: false, borderless: false, description: '', blockIds: [], ...init };
}

export function panelsFromPlan(
  format: ProjectFormat,
  plan: PagePlan | undefined,
  templateId: string | undefined,
): { layout: LayoutNode | null; panels: Record<ID, Panel> } {
  const template = templateId
    ? TEMPLATES.find(t => t.id === templateId)
    : plan?.panels.length
    ? defaultTemplate(format, plan.panels.length)
    : undefined;
  if (!template) {
    return { layout: null, panels: {} };
  }
  const built = buildTemplate(template, uid);
  const order = panelOrder({ layout: built.layout }, format === 'manga');
  const panels: Record<ID, Panel> = {};
  order.forEach((id, index) => {
    const planned = plan?.panels[index];
    panels[id] = newPanel(id, {
      bleed: built.bleedIds.includes(id),
      description: planned?.description ?? '',
      shot: planned?.shot,
      blockIds: planned?.blockIds ?? [],
    });
  });
  const overflow = plan?.panels.slice(order.length) ?? [];
  const last = panels[order[order.length - 1]];
  if (last && overflow.length) {
    // Webtoon strips stop at 6 panels while a plan can hold more, so the last panel takes the rest.
    last.blockIds = [...last.blockIds, ...overflow.flatMap(item => item.blockIds)];
    last.description = [last.description, ...overflow.map(item => item.description)].filter(Boolean).join(' ');
  }
  return { layout: built.layout, panels };
}
