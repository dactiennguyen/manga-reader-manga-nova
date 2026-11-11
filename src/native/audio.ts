/**
 * Recording and playing voice clips through react-native-nitro-sound. Clips are AAC in an .m4a file,
 * 44.1 kHz mono at 64 kbps on both platforms: small enough to send over Wi-Fi, and the same format
 * everywhere so the clips of one chapter can be joined into one file.
 */
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import type { createSound } from 'react-native-nitro-sound';

import { MAX_CLIP_MS, clampClipMs } from '../core/nearby/dubClips';

/** Thrown when the person said no to the microphone, so the screen can explain and offer Settings. */
export class MicDenied extends Error {
  constructor() {
    super('Microphone permission denied');
  }
}

type Sound = ReturnType<typeof createSound>;

let sound: Sound | null = null;

/**
 * Loaded on first use: the native module only exists in a build that includes it, and tests or screens
 * that never record should not pay for it.
 */
function engine(): Sound {
  if (!sound) {
    const mod = require('react-native-nitro-sound') as typeof import('react-native-nitro-sound');
    sound = mod.createSound();
  }
  return sound;
}

function audioSet() {
  const mod = require('react-native-nitro-sound') as typeof import('react-native-nitro-sound');
  return {
    AudioSamplingRate: 44100,
    AudioChannels: 1,
    AudioEncodingBitRate: 64000,
    AVFormatIDKeyIOS: 'aac' as const,
    AVModeIOS: 'spokenAudio' as const,
    AudioSourceAndroid: mod.AudioSourceAndroidType.MIC,
    OutputFormatAndroid: mod.OutputFormatAndroidType.MPEG_4,
    AudioEncoderAndroid: mod.AudioEncoderAndroidType.AAC,
  };
}

/**
 * Asks for the microphone only when the person starts recording. iOS asks inside the recorder itself
 * (the Info.plist text explains why), so here only Android asks.
 */
export async function ensureMic(rationale: { title: string; message: string; ok: string }): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  if (await PermissionsAndroid.check(permission)) {
    return;
  }
  const result = await PermissionsAndroid.request(permission, { title: rationale.title, message: rationale.message, buttonPositive: rationale.ok });
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new MicDenied();
  }
}

export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}

let recordingStartedAt = 0;
let lastPosition = 0;

/**
 * Starts recording into `path` (absolute). `onTick` gets the length so far; recording stops by itself at the
 * cap and `onCap` is called, so a forgotten finger never makes a minute-long clip.
 */
export async function startRecording(path: string, onTick: (ms: number) => void, onCap: () => void): Promise<void> {
  const recorder = engine();
  lastPosition = 0;
  recorder.setSubscriptionDuration(0.1);
  recorder.addRecordBackListener(meta => {
    lastPosition = meta.currentPosition;
    onTick(meta.currentPosition);
    if (meta.currentPosition >= MAX_CLIP_MS) {
      onCap();
    }
  });
  try {
    await recorder.startRecorder(path, audioSet(), false);
    recordingStartedAt = Date.now();
  } catch (error) {
    recorder.removeRecordBackListener();
    // The iOS recorder reports a refused microphone as an error with this wording.
    if (/permission/i.test(String((error as Error)?.message ?? error))) {
      throw new MicDenied();
    }
    throw error;
  }
}

/** Stops and returns the clip's length in ms (capped). */
export async function stopRecording(): Promise<number> {
  const recorder = engine();
  recorder.removeRecordBackListener();
  await recorder.stopRecorder();
  const measured = lastPosition > 0 ? lastPosition : Date.now() - recordingStartedAt;
  return clampClipMs(measured);
}

/** Stops a take that will be thrown away. Never throws. */
export async function cancelRecording(): Promise<void> {
  try {
    await stopRecording();
  } catch {}
}

let playToken = 0;
let finishPlaying: ((finished: boolean) => void) | null = null;

/**
 * Plays a clip and resolves when it ends: true when played to the end, false when stopPlayback() or the
 * next clip cut it off (like speak() in speech.ts, so the table read treats both the same). `speed` is the
 * Listen sheet's speed; a phone that cannot change it (Android before 6) plays at normal speed.
 */
export function playFile(path: string, speed = 1): Promise<boolean> {
  const player = engine();
  finishPlaying?.(false);
  const mine = ++playToken;
  return new Promise<boolean>((resolve, reject) => {
    finishPlaying = finished => {
      if (finishPlaying && mine === playToken) {
        finishPlaying = null;
        player.removePlaybackEndListener();
      }
      resolve(finished);
    };
    player.addPlaybackEndListener(() => {
      if (mine === playToken) {
        finishPlaying?.(true);
      }
    });
    // iOS keeps the speed for the next player, so it is set first; Android sets it on the playing one,
    // which always starts at normal speed.
    if (Platform.OS === 'ios') {
      player.setPlaybackSpeed(speed).catch(() => {});
    }
    player.startPlayer(path).then(
      () => {
        if (Platform.OS !== 'ios' && speed !== 1 && mine === playToken) {
          player.setPlaybackSpeed(speed).catch(() => {});
        }
      },
      error => {
        if (mine === playToken) {
          finishPlaying = null;
          player.removePlaybackEndListener();
          reject(error);
        }
      },
    );
  });
}

export function stopPlayback(): void {
  if (!sound) {
    return;
  }
  playToken += 1;
  finishPlaying?.(false);
  finishPlaying = null;
  sound.removePlaybackEndListener();
  sound.stopPlayer().catch(() => {});
}
