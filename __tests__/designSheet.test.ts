import type { CharacterSheet } from '../src/core/model/types';
import { slotLabel, slotPath, withSlot } from '../src/core/story/designSheet';

const sheet: CharacterSheet = { face: 'f.jpg', expressions: { happy: 'h.jpg' } };

describe('design sheet slots', () => {
  it('labels slots', () => {
    expect(slotLabel('body')).toBe('Full body');
    expect(slotLabel('face')).toBe('Face');
  });

  it('reads both kinds of slot', () => {
    expect(slotPath(sheet, 'face')).toBe('f.jpg');
    expect(slotPath(sheet, 'happy')).toBe('h.jpg');
    expect(slotPath(sheet, 'sad')).toBeUndefined();
  });

  it('writes and clears without touching the original', () => {
    expect(withSlot(sheet, 'body', 'b.jpg').body).toBe('b.jpg');
    expect(withSlot(sheet, 'happy', undefined).expressions).toEqual({});
    expect(sheet.expressions).toEqual({ happy: 'h.jpg' });
  });
});
