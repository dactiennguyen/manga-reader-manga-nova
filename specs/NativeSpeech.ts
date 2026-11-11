import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** A voice installed on the device. `gender` is 'male', 'female' or '' when the system does not say. */
export type SpeechVoice = {
  id: string;
  name: string;
  language: string;
  quality: number;
  gender: string;
};

export interface Spec extends TurboModule {
  /**
   * Reads text aloud with the device's own speech engine: nothing goes over the network. `language` is a
   * BCP 47 tag such as 'vi-VN'. Resolves when there is a speech engine with a voice for that language.
   */
  isAvailable(language: string): Promise<boolean>;
  /** Installed voices for the language, best first. Voices that need a download are left out. */
  voices(language: string): Promise<Array<SpeechVoice>>;
  /**
   * Speaks one line. Pitch and rate are 1 for normal. Resolves true when the line was read to the end and
   * false when stop() or a newer line cut it off. A null voice uses the system voice for the language.
   */
  speak(utteranceId: string, text: string, language: string, pitch: number, rate: number, voiceId: string | null): Promise<boolean>;
  /** Stops at once. The line being read resolves false. */
  stop(): void;
}

export default TurboModuleRegistry.get<Spec>('NativeSpeech');
