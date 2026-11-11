import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  zip(sourceDir: string, outPath: string): Promise<void>;
  unzip(zipPath: string, destDir: string): Promise<void>;
  imagesToPdf(
    imagePaths: Array<string>,
    outPath: string,
    spread: boolean,
    rtl: boolean,
    pageWidthPt: number,
  ): Promise<void>;
  /** Same-sized images in, an MP4 out: one image per frame. */
  framesToVideo(framePaths: Array<string>, outPath: string, fps: number): Promise<void>;
  /**
   * AAC (.m4a) clips in, one .m4a out, played in turn with `gapMs` of silence between. Resolves with how many
   * clips went in: a clip in a different format than the first is left out rather than breaking the file.
   */
  concatAudio(paths: Array<string>, outPath: string, gapMs: number): Promise<number>;
  /** An MP4 video and an audio file in, an MP4 with both out. The audio stops where the video ends. */
  addAudioToVideo(videoPath: string, audioPath: string, outPath: string): Promise<void>;
  shareFile(path: string, mimeType: string, title: string): Promise<void>;
  copyText(text: string): void;
}

export default TurboModuleRegistry.get<Spec>('NativeFiles');
