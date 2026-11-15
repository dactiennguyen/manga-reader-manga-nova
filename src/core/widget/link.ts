/**
 * Links the home screen widget opens: `manganova://widget` goes to Home and `manganova://widget/prompt`
 * starts today's prompt. The native widgets on iOS and Android build the same two links.
 */
export const WIDGET_HOME_LINK = 'manganova://widget';
export const WIDGET_PROMPT_LINK = 'manganova://widget/prompt';

export type WidgetTarget = 'home' | 'prompt';

/** What a widget link asks for, or null when the link is not from the widget. */
export function parseWidgetLink(url: string | null | undefined): WidgetTarget | null {
  const match = /^manganova:\/\/widget(\/[a-z]*)?\/?(?:[?#].*)?$/i.exec((url ?? '').trim());
  if (!match) {
    return null;
  }
  const path = (match[1] ?? '').toLowerCase();
  return path === '/prompt' ? 'prompt' : 'home';
}
