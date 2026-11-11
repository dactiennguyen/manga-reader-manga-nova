import { layerBounds } from '../src/core/art/artMath';
import { normalizeColor, SAVED_COLORS_MAX } from '../src/core/art/palette';
import { BONUS_POSES, POSES, buildPoseStrokes, posesOffered, type JointName } from '../src/core/art/poses';
import { BONUS_PRESETS, PRESETS, SFX_GROUPS, presetOffered } from '../src/core/lettering/presets';
import type { MetaRepo } from '../src/core/ports';
import {
  PROMPTS_PER_GIFT,
  REWARDS,
  availableGifts,
  earnedGifts,
  giftReason,
  openGift,
  unlockedOf,
  withPalette,
} from '../src/core/studio/gifts';
import { EMPTY_METRICS } from '../src/core/studio/metrics';
import { parseStudio } from '../src/core/studio/studioState';
import { EMPTY_STUDIO, type Metrics } from '../src/core/studio/types';
import { useSettings } from '../src/state/useSettings';
import { connectStudio, useStudio } from '../src/state/useStudio';

const TODAY = '2026-11-11';
const withMetrics = (patch: Partial<Metrics>): Metrics => ({ ...EMPTY_METRICS, ...patch });
const assistant = { projects: 1, pagesDone: 1, bestStreak: 3 };

function memoryRepo(initial: Record<string, string> = {}): MetaRepo & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    get: key => data[key] ?? null,
    set: (key, value) => {
      data[key] = value;
    },
    remove: key => {
      delete data[key];
    },
  };
}

describe('gifts', () => {
  it('are earned by streaks, levels and every ten prompts, each with a stable id', () => {
    expect(earnedGifts(EMPTY_METRICS)).toEqual([]);
    const ids = earnedGifts(withMetrics({ ...assistant, bestStreak: 7, promptsDone: 2 * PROMPTS_PER_GIFT + 3 })).map(gift => gift.id);
    expect(ids).toEqual(['streak-3', 'streak-7', 'level-assistant', 'prompts-10', 'prompts-20']);
    expect(earnedGifts(withMetrics({ bestStreak: 100 })).map(gift => gift.id)).toEqual([
      'streak-3',
      'streak-7',
      'streak-14',
      'streak-30',
      'streak-60',
      'streak-100',
    ]);
  });

  it('says what earned them', () => {
    const [streak, level] = earnedGifts(withMetrics(assistant));
    expect(giftReason(streak)).toBe('For a 3-day streak');
    expect(giftReason(level)).toBe('For reaching Assistant');
    expect(giftReason({ id: 'prompts-20', reason: 'For finishing {count} daily prompts' })).toBe('For finishing 20 daily prompts');
  });

  it('opens once: an opened gift is no longer available and opening it again changes nothing', () => {
    const m = withMetrics(assistant);
    const [first] = availableGifts(m, EMPTY_STUDIO, TODAY);
    const opened = openGift(first, EMPTY_STUDIO);
    expect(opened.studio.giftsOpened).toEqual([first.id]);
    expect(opened.studio.unlocked).toEqual([opened.reward.id]);
    expect(availableGifts(m, opened.studio, TODAY).map(gift => gift.id)).not.toContain(first.id);
    const again = openGift(first, opened.studio);
    expect(again.studio).toBe(opened.studio);
    expect(opened.fresh).toBe(true);
    expect(again.fresh).toBe(false);
  });

  it('gives the same reward again when an opened gift is opened again, such as on a double tap', () => {
    let studio = EMPTY_STUDIO;
    for (const id of ['streak-3', 'streak-7', 'prompts-10']) {
      const first = openGift({ id, reason: '' }, studio);
      const again = openGift({ id, reason: '' }, first.studio);
      expect(again.reward).toBe(first.reward);
      expect(again.studio).toBe(first.studio);
      expect(first.studio.giftRewards[id]).toBe(first.reward.id);
      studio = first.studio;
    }
    // Survives a restart.
    const saved = parseStudio(JSON.stringify(studio));
    expect(openGift({ id: 'streak-7', reason: '' }, saved).reward.id).toBe(studio.giftRewards['streak-7']);
    // A gift opened before rewards were recorded still answers with something the person won.
    const legacy = { ...EMPTY_STUDIO, giftsOpened: ['streak-3'], unlocked: ['pose:victory'] };
    expect(openGift({ id: 'streak-3', reason: '' }, legacy)).toMatchObject({ reward: { id: 'pose:victory' }, studio: legacy, fresh: false });
  });

  it('picks the same reward for the same gift and collection, and never one already won', () => {
    const gift = { id: 'streak-7', reason: '' };
    expect(openGift(gift, EMPTY_STUDIO).reward.id).toBe(openGift(gift, EMPTY_STUDIO).reward.id);
    let studio = EMPTY_STUDIO;
    for (let i = 0; i < REWARDS.length; i++) {
      const { reward, studio: next } = openGift({ id: `prompts-${(i + 1) * 10}`, reason: '' }, studio);
      expect(studio.unlocked).not.toContain(reward.id);
      studio = next;
    }
    expect([...studio.unlocked].sort()).toEqual(REWARDS.map(reward => reward.id).sort());
    // Everything is won: a gift still holds something, and unlocks nothing new.
    const extra = openGift({ id: 'streak-100', reason: '' }, studio);
    expect(extra.studio.unlocked).toBe(studio.unlocked);
    expect(extra.studio.giftsOpened).toContain('streak-100');
  });
});

describe('rewards', () => {
  it('have unique ids and real content', () => {
    expect(new Set(REWARDS.map(reward => reward.id)).size).toBe(REWARDS.length);
    const palettes = REWARDS.filter(reward => reward.kind === 'palette');
    expect(palettes.length).toBeGreaterThanOrEqual(6);
    for (const palette of palettes) {
      expect(palette.payload.length).toBeGreaterThanOrEqual(4);
      expect(palette.payload.length).toBeLessThanOrEqual(6);
      expect(palette.payload.every(color => normalizeColor(color) === color)).toBe(true);
    }
    expect(REWARDS.filter(reward => reward.kind === 'cardFrame').map(reward => reward.payload[0])).toEqual(['ink', 'sakura', 'gold', 'tone']);
  });

  it('point at bonus presets and poses that carry the reward as their unlock', () => {
    for (const reward of REWARDS.filter(item => item.kind === 'sfx' || item.kind === 'bubble')) {
      const preset = BONUS_PRESETS.find(item => item.id === reward.payload[0]);
      expect(preset?.unlock).toBe(reward.id);
      expect(preset?.type === 'sfx').toBe(reward.kind === 'sfx');
    }
    for (const reward of REWARDS.filter(item => item.kind === 'pose')) {
      expect(BONUS_POSES.find(item => item.id === reward.payload[0])?.unlock).toBe(reward.id);
    }
    expect(BONUS_PRESETS.every(preset => REWARDS.some(reward => reward.id === preset.unlock))).toBe(true);
    expect(BONUS_POSES.every(pose => REWARDS.some(reward => reward.id === pose.unlock))).toBe(true);
  });

  it('lists what was won by kind', () => {
    expect(unlockedOf({ unlocked: ['frame:gold', 'palette:riso', 'nope'] }, 'cardFrame').map(reward => reward.id)).toEqual(['frame:gold']);
  });

  it('adds palette colours to the saved ones without repeats, up to the limit', () => {
    expect(withPalette(['#f15060'], ['#F15060', '#3D5588'])).toEqual({ list: ['#F15060', '#3D5588'], added: 1 });
    const nearlyFull = Array.from({ length: SAVED_COLORS_MAX - 2 }, (_, i) => `#0000${String(i).padStart(2, '0')}`);
    const out = withPalette(nearlyFull, ['#111111', '#222222', '#333333']);
    expect(out.added).toBe(2);
    expect(out.list).toHaveLength(SAVED_COLORS_MAX);
  });
});

describe('bonus presets and poses', () => {
  it('hide until won, and keep every built-in one offered', () => {
    expect(BONUS_PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(BONUS_PRESETS.every(preset => !presetOffered(preset, []))).toBe(true);
    expect(PRESETS.filter(preset => !preset.unlock).every(preset => presetOffered(preset, []))).toBe(true);
    expect(presetOffered(BONUS_PRESETS[0], [BONUS_PRESETS[0].unlock as string])).toBe(true);
    const keys = SFX_GROUPS.map(group => group.key as string);
    expect(BONUS_PRESETS.filter(preset => preset.type === 'sfx').every(preset => keys.includes(preset.group))).toBe(true);
    expect(posesOffered([])).toEqual(POSES);
    expect(posesOffered(['pose:waving']).map(pose => pose.id)).toEqual([...POSES.map(pose => pose.id), 'waving']);
  });

  const span = (pose: (typeof POSES)[number], a: JointName, b: JointName) => {
    const p = pose.joints[a]!;
    const q = pose.joints[b]!;
    return Math.hypot((q[0] - p[0]) * pose.aspect, q[1] - p[1]) / pose.headSize;
  };

  it.each(BONUS_POSES.map(pose => [pose.id, pose] as const))('%s has the proportions of the built-in poses and fits its box', (_, pose) => {
    for (const side of ['L', 'R'] as const) {
      expect(span(pose, `hip${side}`, `knee${side}`)).toBeLessThanOrEqual(1.92);
      expect(span(pose, `knee${side}`, `ankle${side}`)).toBeCloseTo(1.6, 1);
      expect(span(pose, `shoulder${side}`, `elbow${side}`)).toBeLessThanOrEqual(1.52);
      expect(span(pose, `shoulder${side}`, `elbow${side}`)).toBeGreaterThan(1.3);
      expect(span(pose, `elbow${side}`, `wrist${side}`)).toBeLessThanOrEqual(1.27);
    }
    expect(span(pose, 'neck', 'head')).toBeCloseTo(0.9, 1);
    const box = { x: 40, y: 70, w: 480 * pose.aspect, h: 480 };
    const bounds = layerBounds({ strokes: buildPoseStrokes(pose, box, '#5B9BD5') })!;
    expect(bounds.x).toBeGreaterThanOrEqual(box.x);
    expect(bounds.y).toBeGreaterThanOrEqual(box.y);
    expect(bounds.x + bounds.w).toBeLessThanOrEqual(box.x + box.w);
    expect(bounds.y + bounds.h).toBeLessThanOrEqual(box.y + box.h);
    expect(bounds.h).toBeGreaterThan(box.h * 0.85);
  });
});

describe('studio record', () => {
  it('survives garbage', () => {
    for (const raw of [null, '', 'nope', '[]', '42', 'null', '"text"', '{"promptDays": 5}']) {
      expect(parseStudio(raw)).toEqual(EMPTY_STUDIO);
    }
  });

  it('keeps good fields and drops bad ones', () => {
    const raw = JSON.stringify({
      promptDays: { '2026-11-10': 'p1', bad: 'x', '2026-11-09': 3 },
      giftsOpened: ['streak-3', 'streak-3', 7, ''],
      unlocked: 'palette:riso',
      giftRewards: { 'streak-3': 'palette:riso', 'streak-7': 'nope', 'level-x': 4 },
      badgesSeen: ['first-ink'],
      mailRead: null,
      levelSeen: -2,
      clubIntroSeen: 'yes',
      issueWeekday: 9,
      editorHiddenDay: '2026-11-10',
      chatHiddenDay: 'today',
    });
    expect(parseStudio(raw)).toEqual({
      ...EMPTY_STUDIO,
      promptDays: { '2026-11-10': 'p1' },
      giftsOpened: ['streak-3'],
      giftRewards: { 'streak-3': 'palette:riso' },
      badgesSeen: ['first-ink'],
      editorHiddenDay: '2026-11-10',
    });
  });
});

describe('studio store', () => {
  beforeEach(() => {
    useSettings.setState({ savedColors: [] });
  });

  it('saves under the studio key and reads it back on the next start', () => {
    const repo = memoryRepo();
    connectStudio(repo);
    const store = useStudio.getState();
    store.markPromptDone('2026-11-10', 'prompt-a');
    store.markBadgesSeen(['first-ink', 'first-ink']);
    store.setLevelSeen(2);
    store.setLevelSeen(1);
    store.setIssueWeekday(8);
    store.setClubIntroSeen();
    store.hideEditor(TODAY);
    connectStudio(memoryRepo(repo.data));
    expect(useStudio.getState()).toMatchObject({
      promptDays: { '2026-11-10': 'prompt-a' },
      badgesSeen: ['first-ink'],
      levelSeen: 2,
      issueWeekday: 5,
      clubIntroSeen: true,
      editorHiddenDay: TODAY,
    });
    expect(Object.keys(JSON.parse(repo.data.studio)).sort()).toEqual(Object.keys(EMPTY_STUDIO).sort());
  });

  it('opens a gift once and puts a won palette into the saved colours', () => {
    connectStudio(memoryRepo());
    // Find a gift id whose reward is a palette, so the test does not depend on the pick.
    let id = '';
    for (let n = 3; !id; n++) {
      if (openGift({ id: `streak-${n}`, reason: '' }, EMPTY_STUDIO).reward.kind === 'palette') {
        id = `streak-${n}`;
      }
    }
    const { reward, added } = useStudio.getState().openGift({ id, reason: '' });
    expect(reward.kind).toBe('palette');
    expect(added).toBe(reward.payload.length);
    expect(useSettings.getState().savedColors).toEqual(reward.payload);
    expect(useStudio.getState().giftsOpened).toEqual([id]);
    expect(useStudio.getState().giftRewards).toEqual({ [id]: reward.id });
    // Opening it again shows the same reward, unlocks nothing and adds no colours.
    useSettings.setState({ savedColors: [] });
    expect(useStudio.getState().openGift({ id, reason: '' })).toEqual({ reward, added: 0 });
    expect(useStudio.getState().unlocked).toEqual([reward.id]);
    expect(useSettings.getState().savedColors).toEqual([]);
  });
});
