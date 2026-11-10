import { t } from '../i18n';
import type { AiMessage } from './port';
import { freeText } from './writing';

export type AssistantTurn = { role: 'user' | 'assistant'; text: string };

export type AssistantContext = { brief: string; where: string; detail?: string };

const ASSISTANT_HISTORY_TURNS = 12;

const ASSISTANT =
  'You are a friendly manga-making assistant inside the Manganova app. Help with story, characters, panel layout, pacing, dialogue and drawing technique. Be concrete and brief: short paragraphs or a short list, no headings. Never claim to have changed the story; the author applies changes themselves. Answer in the language the author writes in.';

export function assistantMessages(context: AssistantContext, history: AssistantTurn[], question: string): AiMessage[] {
  const recent = history.slice(-ASSISTANT_HISTORY_TURNS);
  const scene = context.brief
    ? `The author is working on this story:\n${context.brief}\n\nThey are currently on: ${context.where}${
        context.detail ? `\n${context.detail}` : ''
      }`
    : `No story is open. The author is on: ${context.where}`;
  return [
    { role: 'system', content: `${ASSISTANT}\n\n${scene}` },
    ...recent.map(turn => ({ role: turn.role, content: turn.text } as AiMessage)),
    { role: 'user', content: question },
  ];
}

/** `where` comes from whereOf, which starts with the translated screen name in every language. */
export function quickPrompts(where: string, hasStory: boolean): string[] {
  if (!hasStory) {
    return [
      t('How many panels fit on a manga page?'),
      t('How do I plan a 20-page chapter?'),
      t('Tips for drawing expressive faces'),
    ];
  }
  if (where.startsWith(t('Script'))) {
    return [t('Is this scene dragging?'), t('Give me a stronger opening line'), t('What should happen next?')];
  }
  if (where.startsWith(t('Storyboard')) || where.startsWith(t('Panel layout'))) {
    return [t('Which panels deserve more space?'), t('How do I pace this page?'), t('Suggest camera angles for this scene')];
  }
  if (where.startsWith(t('Outline'))) {
    return [t('Where is the weakest chapter?'), t('Suggest a plot twist'), t('Does the ending pay off the setup?')];
  }
  return [t('Summarize my story so far'), t('What is my protagonist missing?'), t('Suggest a title')];
}

export async function askAssistant(
  context: AssistantContext,
  history: AssistantTurn[],
  question: string,
  signal?: AbortSignal,
): Promise<string> {
  return freeText(assistantMessages(context, history, question), signal);
}
