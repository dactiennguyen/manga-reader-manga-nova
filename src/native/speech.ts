import NativeSpeech, { type SpeechVoice } from '../../specs/NativeSpeech';

export type { SpeechVoice };

/** The app's languages as the speech engines name them. */
const SPEECH_TAG: Record<string, string> = { en: 'en-US', vi: 'vi-VN', ja: 'ja-JP' };

export function speechTag(language: string): string {
  return SPEECH_TAG[language] ?? language;
}

/** False when the device has no speech engine, or no voice for the language. Never throws. */
export async function speechAvailable(language: string): Promise<boolean> {
  if (!NativeSpeech) {
    return false;
  }
  try {
    return await NativeSpeech.isAvailable(speechTag(language));
  } catch {
    return false;
  }
}

export async function speechVoices(language: string): Promise<SpeechVoice[]> {
  if (!NativeSpeech) {
    return [];
  }
  try {
    return [...(await NativeSpeech.voices(speechTag(language)))];
  } catch {
    return [];
  }
}

let counter = 0;

/**
 * Reads one line aloud and resolves when it ends: true when read to the end, false when stopSpeech() or the
 * next line cut it off. Rejects when the engine fails on it.
 */
export function speak(
  text: string,
  options: { language: string; pitch: number; rate: number; voiceId?: string | null },
): Promise<boolean> {
  if (!NativeSpeech) {
    return Promise.reject(new Error('Speech is not supported on this device.'));
  }
  counter += 1;
  return NativeSpeech.speak(
    `line-${counter}`,
    text,
    speechTag(options.language),
    options.pitch,
    options.rate,
    options.voiceId ?? null,
  );
}

export function stopSpeech(): void {
  NativeSpeech?.stop();
}
