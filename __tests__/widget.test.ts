import { setLocale } from '../src/core/i18n';
import type { Activity } from '../src/core/story/activity';
import { dailyPrompt } from '../src/core/studio/prompts';
import { WIDGET_HOME_LINK, WIDGET_PROMPT_LINK, parseWidgetLink } from '../src/core/widget/link';
import { WIDGET_SNAPSHOT_VERSION, widgetDayFor, widgetSnapshot, type WidgetInput } from '../src/core/widget/snapshot';
import { TODAY, emptyStory, sampleStory } from './helpers/studioStory';

const activity = (days: Record<string, number>): Activity => ({
  days,
  total: Object.values(days).reduce((a, b) => a + b, 0),
});

const input = (patch: Partial<WidgetInput> = {}): WidgetInput => ({
  state: sampleStory(),
  activity: activity({ '2026-11-09': 30, '2026-11-10': 12, [TODAY]: 40 }),
  goal: 100,
  promptDone: false,
  today: TODAY,
  theme: 'system',
  ...patch,
});

afterEach(() => setLocale('en'));

describe('widget snapshot', () => {
  it('shows the streak, today against the goal and today’s prompt', () => {
    const snapshot = widgetSnapshot(input());
    expect(snapshot.version).toBe(WIDGET_SNAPSHOT_VERSION);
    expect(snapshot.day).toBe(TODAY);
    expect(snapshot.theme).toBe('system');
    expect(snapshot.streakTitle).toBe('Drawing streak');
    expect(snapshot.promptTitle).toBe("Today's prompt");
    expect(snapshot.today).toEqual({
      streak: 3,
      streakText: '3 days',
      drawn: 40,
      goal: 100,
      progress: 0.4,
      goalMet: false,
      progressText: '40/100 today',
      nudge: '',
      prompt: dailyPrompt(sampleStory(), TODAY).text,
      promptDone: '',
    });
  });

  it('marks the goal met and the prompt done', () => {
    const snapshot = widgetSnapshot(input({ activity: activity({ [TODAY]: 250 }), promptDone: true }));
    expect(snapshot.today.streakText).toBe('1 day');
    expect(snapshot.today.progress).toBe(1);
    expect(snapshot.today.goalMet).toBe(true);
    expect(snapshot.today.promptDone).toBe('Done for today');
  });

  it('counts strokes when the daily goal is off', () => {
    const snapshot = widgetSnapshot(input({ goal: 0 }));
    expect(snapshot.today.progressText).toBe('40 strokes today');
    expect(snapshot.today.progress).toBe(0);
    expect(snapshot.today.goalMet).toBe(false);
    expect(snapshot.tomorrow.progressText).toBe('0 strokes today');
  });

  it('nudges before the first stroke of the day', () => {
    const kept = widgetSnapshot(input({ activity: activity({ '2026-11-10': 5 }) }));
    expect(kept.today.streak).toBe(1);
    expect(kept.today.drawn).toBe(0);
    expect(kept.today.nudge).toBe('A few strokes today keep your streak going.');
    const none = widgetSnapshot(input({ activity: activity({}) }));
    expect(none.today.nudge).toBe('Fresh start today. One small drawing begins a new streak.');
  });

  it('carries the streak past midnight only when today was drawn on', () => {
    const drawn = widgetSnapshot(input());
    expect(drawn.tomorrow).toMatchObject({ streak: 3, drawn: 0, progress: 0, progressText: '0/100 today', promptDone: '' });
    expect(drawn.tomorrow.nudge).toBe('A few strokes today keep your streak going.');
    expect(drawn.tomorrow.prompt).toBe(dailyPrompt(sampleStory(), '2026-11-12').text);
    const idle = widgetSnapshot(input({ activity: activity({ '2026-11-10': 5 }) }));
    expect(idle.tomorrow.streak).toBe(0);
    expect(idle.tomorrow.nudge).toBe('Fresh start today. One small drawing begins a new streak.');
    expect(drawn.later).toMatchObject({ streak: 0, streakText: '0 days', drawn: 0, prompt: '' });
    expect(drawn.promptMissing).toBe("Open Manganova for today's prompt.");
  });

  it('picks the day to show from the widget’s own date', () => {
    const snapshot = widgetSnapshot(input());
    expect(widgetDayFor(snapshot, TODAY)).toBe(snapshot.today);
    expect(widgetDayFor(snapshot, '2026-11-10')).toBe(snapshot.today);
    expect(widgetDayFor(snapshot, '2026-11-12')).toBe(snapshot.tomorrow);
    expect(widgetDayFor(snapshot, '2026-11-13')).toBe(snapshot.later);
    expect(widgetDayFor({ ...snapshot, day: '2026-11-30' }, '2026-12-01')).toBe(snapshot.tomorrow);
  });

  it('works without a story and in the app’s language', () => {
    setLocale('vi');
    const snapshot = widgetSnapshot(input({ state: emptyStory(), theme: 'dark' }));
    expect(snapshot.theme).toBe('dark');
    expect(snapshot.streakTitle).toBe('Chuỗi ngày vẽ');
    expect(snapshot.today.streakText).toBe('3 ngày');
    expect(snapshot.today.progressText).toBe('Hôm nay 40/100');
    expect(snapshot.today.prompt).not.toBe('');
    expect(snapshot.today.prompt).not.toMatch(/\{\w+\}/);
    expect(snapshot.promptMissing).toBe('Mở Manganova để xem đề bài hôm nay.');
  });

  it('survives a trip through JSON', () => {
    const snapshot = widgetSnapshot(input());
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe('widget links', () => {
  it('tells Home from the prompt and ignores other links', () => {
    expect(parseWidgetLink(WIDGET_HOME_LINK)).toBe('home');
    expect(parseWidgetLink(`${WIDGET_HOME_LINK}/`)).toBe('home');
    expect(parseWidgetLink(WIDGET_PROMPT_LINK)).toBe('prompt');
    expect(parseWidgetLink('MANGANOVA://widget/Prompt?from=ios')).toBe('prompt');
    expect(parseWidgetLink('manganova://widget/other')).toBe('home');
    for (const other of [null, undefined, '', 'manganova://join?h=1', 'manganova://widgets', 'https://widget', 'file:///widget']) {
      expect(parseWidgetLink(other)).toBeNull();
    }
  });
});
