/**
 * Playing a chapter "with voices": the dub's lines as table-read lines, so the Listen sheet plays a recorded
 * clip where there is one and falls back to the device's voice (same pitch and rate as a table read) where
 * there is not.
 */
import type { Character, DialogueKind, ID } from '../model/types';
import {
  KIND_TONE,
  NARRATOR_VOICE,
  PITCH_RANGE,
  RATE_RANGE,
  UNKNOWN_SPEAKER,
  castVoices,
  clamp,
  round,
  speakableText,
  type Utterance,
} from '../studio/tableRead';
import { NARRATOR_ROLE, UNKNOWN_ROLE, type DubItem } from './dub';
import { sourceOf, type ClipEntry, type LineSource } from './dubClips';

export type VoicedLine = Utterance & {
  /** The bubble this line comes from; also used as `blockId`, which the sheet keys its rows by. */
  bubbleId: ID;
  pageId: ID;
  source: LineSource;
};

const toneOf = (type: DubItem['type']): DialogueKind =>
  type === 'think' || type === 'shout' || type === 'whisper' ? type : 'speak';

/**
 * The dub as lines to play. `characters` gives voices to roles the phone knows; `names` names roles it does
 * not (a guest has the script, not the story).
 */
export function voicedLines(
  lines: DubItem[],
  characters: Record<ID, Character>,
  names: Record<string, string>,
  clips: Record<ID, ClipEntry>,
): VoicedLine[] {
  const spoken = lines.filter(line => speakableText(line.text));
  const speakers: (Character | null)[] = [];
  const seen = new Set<string>();
  for (const line of spoken) {
    if (line.role === NARRATOR_ROLE) {
      continue;
    }
    const character = line.characterId ? characters[line.characterId] ?? null : null;
    const key = character?.id ?? UNKNOWN_SPEAKER;
    if (!seen.has(key)) {
      seen.add(key);
      speakers.push(character);
    }
  }
  const voices = castVoices(speakers);
  return spoken.map(line => {
    const base = { blockId: line.bubbleId, bubbleId: line.bubbleId, pageId: line.pageId, text: speakableText(line.text), source: sourceOf(line.bubbleId, clips) };
    if (line.role === NARRATOR_ROLE) {
      return { ...base, type: 'narration', narrator: true, speakerId: null, speaker: null, pitch: NARRATOR_VOICE.pitch, rate: NARRATOR_VOICE.rate, gender: null };
    }
    const character = line.characterId ? characters[line.characterId] ?? null : null;
    const voice = voices.get(character?.id ?? UNKNOWN_SPEAKER) ?? NARRATOR_VOICE;
    const tone = KIND_TONE[toneOf(line.type)];
    const named = line.role === UNKNOWN_ROLE ? '' : names[line.role] ?? '';
    return {
      ...base,
      type: 'dialogue',
      narrator: false,
      speakerId: character?.id ?? (line.role === UNKNOWN_ROLE ? null : line.role),
      speaker: character?.name.trim() || named.trim() || null,
      pitch: round(clamp(voice.pitch + tone.pitch, PITCH_RANGE)),
      rate: round(clamp(voice.rate * tone.rate, RATE_RANGE)),
      gender: voice.gender,
    };
  });
}

/** Whether the "Play with voices" choice is worth offering: at least one line of the chapter has a clip. */
export function hasVoices(lines: Pick<DubItem, 'bubbleId'>[], clips: Record<ID, ClipEntry>): boolean {
  return lines.some(line => sourceOf(line.bubbleId, clips).kind === 'clip');
}
