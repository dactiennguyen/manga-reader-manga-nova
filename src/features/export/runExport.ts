import { ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';

import type { ExportRecord } from '../../core/export/history';
import {
  LONG_CUT_HEIGHT,
  LONG_MAX_HEIGHT,
  PDF_PAGE_WIDTH_PT,
  SOCIAL_SIZE,
  longSegments,
  padNumber,
  pageImageWidth,
  socialPageWidth,
  socialPlacement,
  type ExportOptions,
  type ExportProgress,
} from '../../core/export/plan';
import { t } from '../../core/i18n';
import { isRtl, pageSize, panelOrder } from '../../core/layout/layout';
import { languageFileTag } from '../../core/lettering/translation';
import type { ID, Project } from '../../core/model/types';
import { slugify, uid } from '../../core/util/id';
import { toRelative } from '../../core/util/paths';
import { dayKey } from '../../core/util/time';
import { DIRS, MIME, RNFS, fileSize, imagesToPdf, removeFile, resetDir, zipDir } from '../../native/files';
import { pageContext, renderPageImage } from '../../render/drawPage';
import { PAPER } from '../../render/ink';
import { useStory } from '../../state/useStory';
import { ensureProjectExportDir } from './exportFiles';
import { loadFonts } from '../../render/fonts';
import { drawSignature, renderCover, renderInfo, signImage } from './exportSheets';

export class ExportCancelled extends Error {}

type Step = (done: number) => Promise<void>;

type Job = {
  project: Project;
  pageIds: ID[];
  options: ExportOptions;
  lang: string | undefined;
  tmpDir: string;
  outDir: string;
  base: string;
  step: Step;
  /** Named before any bytes are written, so a failure can remove a half-written file. */
  claim: (path: string) => void;
};

type Output = { path: string; fileName: string; mime: string; pages: number };

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function writeImage(image: SkImage, path: string, format: 'png' | 'jpg'): Promise<void> {
  const base64 =
    format === 'jpg' ? image.encodeToBase64(ImageFormat.JPEG, 92) : image.encodeToBase64(ImageFormat.PNG, 100);
  await RNFS.writeFile(path, base64, 'base64');
}

async function writeAndFree(image: SkImage, path: string, format: 'png' | 'jpg'): Promise<void> {
  await writeImage(image, path, format);
  image.dispose();
}

async function freeOutPath(dir: string, base: string, ext: string): Promise<{ path: string; fileName: string }> {
  let fileName = `${base}.${ext}`;
  let n = 2;
  while (await RNFS.exists(`${dir}/${fileName}`)) {
    fileName = `${base}-${n}.${ext}`;
    n++;
  }
  return { path: `${dir}/${fileName}`, fileName };
}

async function exportLong({ pageIds, options, lang, tmpDir, outDir, base, step, claim }: Job): Promise<Output> {
  const width = options.longWidth;
  const heights = pageIds.map(id => {
    const ctx = pageContext(id);
    return ctx ? Math.round((ctx.size.h * width) / ctx.size.w) : 0;
  });
  const limit = options.autoCut ? LONG_CUT_HEIGHT : LONG_MAX_HEIGHT;
  const segments = longSegments(heights, options.gap, limit);
  if (segments.length === 0) {
    throw new Error(t('No pages could be rendered.'));
  }
  let done = 0;
  const files: string[] = [];
  const fonts = options.signature ? await loadFonts() : null;
  for (let s = 0; s < segments.length; s++) {
    const segment = segments[s];
    const surface = Skia.Surface.Make(width, segment.height);
    if (!surface) {
      throw new Error(t('Not enough memory to stitch the long image. Turn on auto-cut or pick a smaller width.'));
    }
    const canvas = surface.getCanvas();
    canvas.drawColor(Skia.Color(PAPER));
    let y = 0;
    for (const index of segment.indices) {
      const image = await renderPageImage(pageIds[index], width, { lang });
      if (!image) {
        throw new Error(t("Page {n} couldn't be rendered.", { n: index + 1 }));
      }
      canvas.drawImage(image, 0, y);
      image.dispose();
      if (fonts) {
        drawSignature(canvas, fonts, options.penName, { x: 0, y, w: width, h: heights[index] });
      }
      y += heights[index] + options.gap;
      done++;
      await step(done);
    }
    surface.flush();
    const file = `${tmpDir}/${padNumber(s + 1)}.png`;
    await writeAndFree(surface.makeImageSnapshot(), file, 'png');
    surface.dispose();
    files.push(file);
  }
  if (files.length === 1) {
    const out = await freeOutPath(outDir, base, 'png');
    claim(out.path);
    await RNFS.copyFile(files[0], out.path);
    return { ...out, mime: MIME.png, pages: 1 };
  }
  const out = await freeOutPath(outDir, `${base}-long`, 'zip');
  claim(out.path);
  await zipDir(tmpDir, out.path);
  return { ...out, mime: MIME.zip, pages: files.length };
}

/** One framed image per panel, in reading order. Each page is drawn once and its panels are cut from it. */
async function exportSocial({ pageIds, options, lang, tmpDir, outDir, base, step, claim }: Job): Promise<Output> {
  const frame = SOCIAL_SIZE[options.socialShape];
  const files: string[] = [];
  const fonts = options.signature ? await loadFonts() : null;
  for (let i = 0; i < pageIds.length; i++) {
    const ctx = pageContext(pageIds[i]);
    const ordered = ctx
      ? panelOrder(ctx.page, ctx.rtl)
          .map(id => ctx.shapes.find(shape => shape.id === id))
          .filter(shape => shape !== undefined)
      : [];
    if (ctx && ordered.length > 0) {
      const boxes = ordered.map(shape => shape.bbox);
      const pageWidth = socialPageWidth(boxes, ctx.size.w, frame);
      const image = await renderPageImage(pageIds[i], pageWidth, { lang });
      if (!image) {
        throw new Error(t("Page {n} couldn't be rendered.", { n: i + 1 }));
      }
      const pixels = image.width() / ctx.size.w;
      for (const box of boxes) {
        const surface = Skia.Surface.Make(frame.w, frame.h);
        if (!surface) {
          image.dispose();
          throw new Error(t('Not enough memory to draw the panels.'));
        }
        const canvas = surface.getCanvas();
        canvas.drawColor(Skia.Color(PAPER));
        const place = socialPlacement(box, frame);
        canvas.drawImageRectCubic(
          image,
          Skia.XYWHRect(box.x * pixels, box.y * pixels, box.w * pixels, box.h * pixels),
          Skia.XYWHRect(place.x, place.y, place.w, place.h),
          1 / 3,
          1 / 3,
        );
        if (fonts) {
          drawSignature(canvas, fonts, options.penName, { x: 0, y: 0, w: frame.w, h: frame.h });
        }
        surface.flush();
        const file = `${tmpDir}/${padNumber(files.length + 1)}.png`;
        await writeAndFree(surface.makeImageSnapshot(), file, 'png');
        surface.dispose();
        files.push(file);
      }
      image.dispose();
    }
    await step(i + 1);
  }
  if (files.length === 0) {
    throw new Error(t('These pages have no panels to export.'));
  }
  if (files.length === 1) {
    const out = await freeOutPath(outDir, `${base}-${options.socialShape}`, 'png');
    claim(out.path);
    await RNFS.copyFile(files[0], out.path);
    return { ...out, mime: MIME.png, pages: 1 };
  }
  const out = await freeOutPath(outDir, `${base}-${options.socialShape}`, 'zip');
  claim(out.path);
  await zipDir(tmpDir, out.path);
  return { ...out, mime: MIME.zip, pages: files.length };
}

async function exportPaged({ project, pageIds, options, lang, tmpDir, outDir, base, step, claim }: Job): Promise<Output> {
  const width = pageImageWidth(options.quality);
  const imageFormat = options.format === 'pdf' ? 'jpg' : 'png';
  const sheet = pageSize({ format: 'manga', pageSize: project.pageSize });
  const sheetH = Math.round((width * sheet.h) / sheet.w);
  const paths: string[] = [];
  const fonts = options.signature ? await loadFonts() : null;
  if (options.cover) {
    const cover = await renderCover(project, options.penName, width, sheetH);
    if (cover) {
      const file = `${tmpDir}/000.${imageFormat}`;
      await writeAndFree(cover, file, imageFormat);
      paths.push(file);
    }
  }
  for (let i = 0; i < pageIds.length; i++) {
    const image = await renderPageImage(pageIds[i], width, { lang });
    if (!image) {
      throw new Error(t("Page {n} couldn't be rendered.", { n: i + 1 }));
    }
    const file = `${tmpDir}/${padNumber(i + 1)}.${imageFormat}`;
    await writeAndFree(fonts ? signImage(image, fonts, options.penName) : image, file, imageFormat);
    paths.push(file);
    await step(i + 1);
  }
  if (options.info) {
    const info = await renderInfo(project, options.penName, width, sheetH);
    if (info) {
      const file = `${tmpDir}/${padNumber(pageIds.length + 1)}.${imageFormat}`;
      await writeAndFree(info, file, imageFormat);
      paths.push(file);
    }
  }
  if (paths.length === 0) {
    throw new Error(t('No pages could be rendered.'));
  }
  if (options.format === 'pdf') {
    const out = await freeOutPath(outDir, base, 'pdf');
    claim(out.path);
    await imagesToPdf(paths, out.path, options.spread, isRtl(project), PDF_PAGE_WIDTH_PT[project.pageSize]);
    return { ...out, mime: MIME.pdf, pages: paths.length };
  }
  const cbz = options.format === 'cbz';
  const out = await freeOutPath(outDir, base, cbz ? 'cbz' : 'zip');
  claim(out.path);
  await zipDir(tmpDir, out.path);
  return { ...out, mime: cbz ? MIME.cbz : MIME.zip, pages: paths.length };
}

/**
 * Reads the story from the store and draws through src/render, so it needs nothing from a mounted
 * screen. The caller only supplies progress and cancellation.
 */
export async function runExport(
  projectId: ID,
  pageIds: ID[],
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
  isCancelled: () => boolean,
): Promise<ExportRecord> {
  const project = useStory.getState().projects[projectId];
  if (!project || pageIds.length === 0) {
    throw new Error(t('There are no pages to export.'));
  }
  const outDir = await ensureProjectExportDir(projectId);
  const tmpDir = `${DIRS.tmp}/export-${uid()}`;
  await resetDir(tmpDir);
  const lang = options.lang && project.languages?.includes(options.lang) ? options.lang : undefined;
  const base = `${slugify(project.title)}${lang ? `-${languageFileTag(lang)}` : ''}-${dayKey()}`;
  const total = pageIds.length;
  let outPath: string | null = null;
  const step: Step = async done => {
    onProgress({ done, total });
    await yieldToUi();
    if (isCancelled()) {
      throw new ExportCancelled();
    }
  };
  const job: Job = {
    project,
    pageIds,
    options,
    lang,
    tmpDir,
    outDir,
    base,
    step,
    claim: path => {
      outPath = path;
    },
  };

  try {
    await step(0);
    const out =
      options.format === 'long'
        ? await exportLong(job)
        : options.format === 'social'
        ? await exportSocial(job)
        : await exportPaged(job);
    if (isCancelled()) {
      throw new ExportCancelled();
    }
    return {
      path: toRelative(out.path),
      fileName: out.fileName,
      mime: out.mime,
      size: await fileSize(out.path),
      pages: out.pages,
      format: options.format,
      createdAt: Date.now(),
    };
  } catch (error) {
    await removeFile(outPath);
    throw error;
  } finally {
    await removeFile(tmpDir);
  }
}
