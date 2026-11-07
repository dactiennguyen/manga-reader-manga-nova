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

export function quickPrompts(where: string, hasStory: boolean): string[] {
  if (!hasStory) {
    return [
      'How many panels fit on a manga page?',
      'How do I plan a 20-page chapter?',
      'Tips for drawing expressive faces',
    ];
  }
  if (where.startsWith('Script')) {
    return ['Is this scene dragging?', 'Give me a stronger opening line', 'What should happen next?'];
  }
  if (where.startsWith('Storyboard') || where.startsWith('Panel')) {
    return ['Which panels deserve more space?', 'How do I pace this page?', 'Suggest camera angles for this scene'];
  }
  if (where.startsWith('Outline')) {
    return ['Where is the weakest chapter?', 'Suggest a plot twist', 'Does the ending pay off the setup?'];
  }
  return ['Summarize my story so far', 'What is my protagonist missing?', 'Suggest a title'];
}

export async function askAssistant(
  context: AssistantContext,
  history: AssistantTurn[],
  question: string,
  signal?: AbortSignal,
): Promise<string> {
  return freeText(assistantMessages(context, history, question), signal);
}
