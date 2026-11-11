import { GENRES, LIMITS } from '../model/constants';
import { AiError, type AiClient, type AiMessage } from './port';

/**
 * Canned answers for people who have no AI server yet. Each one has the shape the real task parses,
 * so every AI screen can be tried. The prompts are recognised by their wording: demo.test.ts runs
 * every task through this client, and fails when a prompt changes without this file.
 */

const DEMO_DELAY_MS = 700;

function match(text: string, pattern: RegExp): string {
  return pattern.exec(text)?.[1]?.trim() ?? '';
}

function sentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }
  const cut = clean.length > max ? clean.slice(0, max - 1).replace(/\s+\S*$/, '') : clean;
  const body = cut.charAt(0).toUpperCase() + cut.slice(1);
  return /[.!?…]$/.test(body) ? body : `${body}.`;
}

function polish(text: string): string {
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/\b(very|really|just|quite) /gi, '')
    .trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'who', 'that', 'and', 'of', 'in', 'on', 'to', 'with', 'is', 'her', 'his']);

function titleFrom(idea: string): string {
  const words = idea
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(word => word && !STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 3)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1));
  return (words.join(' ') || 'Untitled Idea').slice(0, LIMITS.projectTitle);
}

const GENRE_HINTS: [RegExp, (typeof GENRES)[number]][] = [
  [/love|crush|date|heart|romance/i, 'Romance'],
  [/ghost|curse|haunt|monster|blood|horror/i, 'Horror'],
  [/school|class|student|club|teacher/i, 'School'],
  [/magic|dragon|witch|spirit|kingdom|sword/i, 'Fantasy'],
  [/robot|space|future|android|planet/i, 'Sci-fi'],
  [/detective|murder|secret|missing|mystery|clue/i, 'Mystery'],
  [/team|match|race|tournament|ball|champion/i, 'Sports'],
  [/funny|joke|clumsy|comedy|silly/i, 'Comedy'],
  [/fight|battle|war|chase|hunter/i, 'Action'],
  [/samurai|edo|dynasty|empire|ancient/i, 'Historical'],
  [/cafe|bakery|daily|quiet|neighbour|neighbor/i, 'Slice of life'],
];

function storyIdea(prompt: string): unknown {
  const idea = match(prompt, /Idea: (.*)/);
  const genres = GENRE_HINTS.filter(([hint]) => hint.test(idea)).map(([, genre]) => genre);
  return {
    title: titleFrom(idea),
    genres: (genres.length ? genres : ['Adventure']).slice(0, LIMITS.genresPerProject),
    logline: sentence(idea, LIMITS.logline),
  };
}

const DIRECTIONS = [
  {
    tone: 'Adventure',
    title: 'The long road',
    summary: 'The hero leaves home, and every stop on the way costs something.',
    open: ['The call', 'A small life is interrupted by a problem only the hero can carry.'],
    middle: ['The price', 'An ally is lost and the plan stops working.'],
    close: ['The return', 'The hero comes home changed and settles what started it all.'],
  },
  {
    tone: 'Tragedy',
    title: 'What it costs',
    summary: 'The hero gets what they want and finds out too late what they traded for it.',
    open: ['The wish', 'We see what the hero wants most, and the one person who warns against it.'],
    middle: ['The trade', 'The hero wins by breaking a promise.'],
    close: ['The empty room', 'The goal is reached. Nobody is left to share it with.'],
  },
  {
    tone: 'Comedy',
    title: 'Everything goes wrong',
    summary: 'A simple plan collapses in public, and the mess turns out better than the plan.',
    open: ['The plan', 'The hero explains a plan that cannot fail. It starts failing right away.'],
    middle: ['The cover-up', 'Each fix makes a bigger problem, and more people get pulled in.'],
    close: ['The confession', 'The truth comes out in the worst place and works anyway.'],
  },
];

function plots(prompt: string): unknown {
  const count = Math.max(1, Number(match(prompt, /exactly (\d+) items/)) || 3);
  return {
    directions: DIRECTIONS.map(direction => ({
      tone: direction.tone,
      title: direction.title,
      summary: direction.summary,
      acts: Array.from({ length: count }, (_, index) => {
        const [title, summary] =
          index === 0 ? direction.open : index === count - 1 ? direction.close : direction.middle;
        return { chapters: [{ title: count > 3 && index > 0 && index < count - 1 ? `${title} ${index}` : title, summary }] };
      }),
    })),
  };
}

function scenes(prompt: string): unknown {
  const chapter = match(prompt, /Chapter: (.*)/) || 'this chapter';
  return {
    scenes: [
      { setting: 'A quiet place, early morning', description: `Open on the calm before ${chapter}. Show what the hero stands to lose.` },
      { setting: 'On the way, midday', description: 'Something small goes wrong and the hero has to choose quickly.' },
      { setting: 'A crowded place, afternoon', description: 'The hero meets the person who stands in the way. They talk past each other.' },
      { setting: 'Somewhere high or narrow, dusk', description: 'The choice from earlier comes back. End on a question, not an answer.' },
    ],
  };
}

function continueScript(prompt: string): unknown {
  const names = match(prompt, /character names for dialogue: (.*?)\.\n/)
    .split(',')
    .map(name => name.trim())
    .filter(name => name && !name.startsWith('(none'));
  const [first, second] = names;
  const blocks: unknown[] = [{ type: 'action', text: 'A sudden noise cuts the moment short.' }];
  if (first) {
    blocks.push({ type: 'dialogue', character: first, kind: 'whisper', text: 'Did you hear that?' });
  }
  blocks.push({ type: 'action', text: `${first ?? 'Everyone'} turns toward the sound. Nothing moves.` });
  if (second) {
    blocks.push({ type: 'dialogue', character: second, kind: 'speak', text: "It's nothing. Keep going." });
  }
  blocks.push({ type: 'narration', text: 'Something had changed, and it would not change back.' });
  return { blocks };
}

function rewrite(prompt: string): unknown {
  const blocks = prompt
    .split('\n')
    .filter(line => line.startsWith('{"type"'))
    .map(line => {
      const block = JSON.parse(line) as { type: string; text: string; character?: string; kind?: string };
      return { ...block, text: polish(block.text) };
    });
  return { blocks };
}

function quoted(prompt: string): string {
  return match(prompt, /\n"([\s\S]*)"\n\nReturn/);
}

function shorten(prompt: string): unknown {
  const limit = Number(match(prompt, /at most (\d+) characters/)) || 60;
  const line = polish(quoted(prompt));
  return { text: line.length > limit ? `${line.slice(0, limit - 1).replace(/\s+\S*$/, '')}…` : line };
}

const SFX_HINTS: [RegExp, string[]][] = [
  [/rain|water|wave|splash|river|sea|drip/i, ['SPLASH', 'DRIP', 'SPLOSH']],
  [/run|jump|wind|fast|fly|leap|dash/i, ['WHOOSH', 'DASH', 'ZOOM']],
  [/door|knock|hit|punch|kick|fall|slam/i, ['BAM', 'THUD', 'CRACK']],
  [/laugh|smile|giggle/i, ['HAHA', 'HEHE', 'PFFT']],
  [/quiet|silence|stare|still/i, ['SHHH', 'HUSH', 'TICK']],
];

function sfx(prompt: string): unknown {
  const action = quoted(prompt);
  return { sfx: SFX_HINTS.find(([hint]) => hint.test(action))?.[1] ?? ['BAM', 'WHOOSH', 'THUD'] };
}

const DEMO_NAMES = ['Aki', 'Mio', 'Sora', 'Rin', 'Kai', 'Yuna', 'Taro', 'Nao'];

function character(prompt: string): unknown {
  const keywords = match(prompt, /from these keywords: (.*)/);
  const traits = keywords
    .split(/[,;]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const seed = [...keywords].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const villain = /villain|enemy|rival|evil/i.test(keywords);
  return {
    name: DEMO_NAMES[seed % DEMO_NAMES.length],
    role: villain ? 'villain' : 'support',
    age: String(16 + (seed % 20)),
    gender: '',
    traits: traits.length ? traits : ['stubborn', 'loyal', 'curious'],
    goal: villain ? 'To take the one thing the hero cannot give up.' : 'To prove they belong beside the hero.',
    weakness: 'Never asks for help, even when it is offered.',
    voice: 'Short sentences. Answers a question with a question.',
    bio: `Grew up being described as ${traits[0] ?? 'stubborn'} and decided to make it a strength. Left home early, and still carries one thing from there.`,
    appearance: 'Short dark hair that never stays combed, sharp eyes, a lean build. Wears a coat one size too big, with a patch on the left elbow.',
  };
}

function world(prompt: string): unknown {
  const title = match(prompt, /Write the wiki entry "(.*?)" \(type:/) || 'This entry';
  const existing = match(prompt, /keep what fits:\n([\s\S]*?)\n\nReturn/);
  const body = [
    existing,
    `${title} is known to everyone in the story, but few have seen it up close. People describe it by what it does to them: who it feeds, who it frightens, who it owes.`,
    'Give it one rule that is never broken and one rumour that might be true. Scenes set here should show the rule first and let the rumour arrive later.',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { body };
}

function plotHoles(): unknown {
  return {
    issues: [
      {
        issue: 'The first chapter does not say what the main character wants.',
        suggestion: 'Give them one line or one action in the opening scene that shows the goal.',
        chapter: '',
      },
      {
        issue: 'The antagonist has no reason to act now and not earlier.',
        suggestion: 'Add an event just before the story starts that forces their hand.',
        chapter: '',
      },
      {
        issue: 'Nothing is lost if the hero fails.',
        suggestion: 'Name a person or a place that is gone for good if the plan goes wrong.',
        chapter: '',
      },
    ],
  };
}

const ASSISTANT_HINTS: [RegExp, string][] = [
  [
    /how many panels|panels fit/i,
    'Four to six panels is a comfortable manga page. Use three or fewer for a big moment, and seven or more only for fast, quiet beats. One page should hold one idea.',
  ],
  [
    /plan .*chapter|20-page/i,
    'Split 20 pages into four parts: 3 pages to set the scene, 7 to build the problem, 7 for the turn, and 3 to close on a hook. Write one sentence per page before you draw anything.',
  ],
  [
    /face|expression/i,
    'Start from the eyebrows and the mouth, since they carry most of the feeling. Tilt the head with the emotion, and push the pose a little further than feels natural.',
  ],
  [
    /pace|pacing|dragging|space/i,
    'Give the widest panel to the moment the reader should remember. Cut any panel that repeats what the one before it showed, and end the page on a question.',
  ],
  [
    /camera|angle/i,
    'Open wide to show where we are, move to medium shots for talk, and save close-ups for a change of feeling. A low angle makes a character strong, a high one makes them small.',
  ],
  [
    /twist|next|happen/i,
    'Look for a promise you already made to the reader and pay it off earlier than expected. A good twist changes what an old scene meant.',
  ],
  [/title/i, 'Try the thing your hero wants, the place it happens, or the one object the story turns on. Short titles of two or three words are easiest to remember.'],
  [
    /opening|first line|stronger/i,
    'Open in the middle of an action, and let the first line show what the speaker wants. Cut the greeting and start one sentence later.',
  ],
];

function assistant(question: string): string {
  const answer =
    ASSISTANT_HINTS.find(([hint]) => hint.test(question))?.[1] ??
    'A good next step is to write one sentence for each page of your chapter, then mark the page where the feeling changes. That page deserves your biggest panel.';
  return `${answer}\n\nThis is a sample answer. Add an AI server in Profile for answers about your own story.`;
}

export function demoAnswer(messages: AiMessage[]): string {
  const system = messages[0]?.role === 'system' ? messages[0].content : '';
  const prompt = [...messages].reverse().find(message => message.role === 'user')?.content ?? '';
  if (system.startsWith('You translate')) {
    throw new AiError('not-configured', 'Translating needs your own AI server. Add one in Profile.');
  }
  if (system.includes('manga-making assistant')) {
    return assistant(prompt);
  }
  const answer = prompt.includes('Turn this idea into a manga pitch')
    ? storyIdea(prompt)
    : prompt.includes('clearly different plot directions')
    ? plots(prompt)
    : prompt.includes('Break this chapter into')
    ? scenes(prompt)
    : prompt.includes('Write the next 3 to 5 script blocks')
    ? continueScript(prompt)
    : prompt.includes('Rewrite these script blocks')
    ? rewrite(prompt)
    : prompt.includes('sounds exactly like this character')
    ? { text: polish(quoted(prompt)) }
    : prompt.includes('Shorten this manga dialogue line')
    ? shorten(prompt)
    : prompt.includes('manga sound effects')
    ? sfx(prompt)
    : prompt.includes('Create a character for this story')
    ? character(prompt)
    : prompt.includes('Write the wiki entry')
    ? world(prompt)
    : prompt.includes('a careful editor would raise')
    ? plotHoles()
    : null;
  if (!answer) {
    throw new AiError('not-configured', 'Set the AI server address in Profile first.');
  }
  return JSON.stringify(answer);
}

/** `onAnswer` lets the app tell the person that the answer was a sample. */
export function createDemoClient(onAnswer?: () => void, delayMs = DEMO_DELAY_MS): AiClient {
  return {
    complete: (request, signal) =>
      new Promise<string>((resolve, reject) => {
        const cancelled = () => reject(new AiError('cancelled', 'Cancelled.'));
        if (signal?.aborted) {
          cancelled();
          return;
        }
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          try {
            const answer = demoAnswer(request.messages);
            onAnswer?.();
            resolve(answer);
          } catch (error) {
            reject(error);
          }
        }, delayMs);
        const onAbort = () => {
          clearTimeout(timer);
          cancelled();
        };
        signal?.addEventListener('abort', onAbort);
      }),
  };
}
