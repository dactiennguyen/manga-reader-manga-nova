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
  shareFile(path: string, mimeType: string, title: string): Promise<void>;
  copyText(text: string): void;
}

export default TurboModuleRegistry.get<Spec>('NativeFiles');
