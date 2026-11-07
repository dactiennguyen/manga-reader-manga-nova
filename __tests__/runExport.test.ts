import type { ExportOptions } from '../src/core/export/plan';
import type { Project } from '../src/core/model/types';
import { ExportCancelled, runExport } from '../src/features/export/runExport';
import { imagesToPdf, removeFile, zipDir } from '../src/native/files';
import { renderPageImage } from '../src/render/drawPage';
import { useStory } from '../src/state/useStory';

const fakeImage = () => ({ dispose: jest.fn(), encodeToBase64: () => 'b64' });

jest.mock('@shopify/react-native-skia', () => {
  const image = () => ({ dispose: jest.fn(), encodeToBase64: () => 'b64' });
  const canvas = { drawColor: jest.fn(), drawImage: jest.fn(), drawRect: jest.fn(), drawImageRect: jest.fn() };
  const paragraph = { layout: jest.fn(), getHeight: () => 40, paint: jest.fn() };
  return {
    ImageFormat: { PNG: 'png', JPEG: 'jpeg' },
    TextAlign: { Center: 'center' },
    Skia: {
      Color: (value: string) => value,
      Paint: () => ({ setColor: jest.fn() }),
      XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
      ParagraphBuilder: { Make: () => ({ addText: jest.fn(), build: () => paragraph }) },
      Surface: {
        Make: () => ({ getCanvas: () => canvas, flush: jest.fn(), makeImageSnapshot: image, dispose: jest.fn() }),
      },
    },
  };
});
jest.mock('../src/render/drawPage', () => ({
  pageContext: () => ({ size: { w: 1000, h: 1412 } }),
  renderPageImage: jest.fn(),
}));
jest.mock('../src/render/fonts', () => ({
  FONT_FAMILY: { display: 'Anton', sans: 'Sans', sansBold: 'SansBold' },
  loadFonts: async () => ({}),
}));
jest.mock('../src/render/images', () => ({ loadImage: async () => null }));
jest.mock('../src/native/files', () => ({
  DIRS: { exports: '/files/exports', tmp: '/cache/tmp' },
  MIME: { png: 'image/png', pdf: 'application/pdf', zip: 'application/zip', cbz: 'application/vnd.comicbook+zip' },
  RNFS: { exists: jest.fn(async () => false), mkdir: jest.fn(async () => {}), writeFile: jest.fn(async () => {}), copyFile: jest.fn(async () => {}) },
  ensureDirs: jest.fn(async () => {}),
  fileSize: jest.fn(async () => 2048),
  imagesToPdf: jest.fn(async () => {}),
  removeFile: jest.fn(async () => {}),
  resetDir: jest.fn(async () => {}),
  zipDir: jest.fn(async () => {}),
}));

require('../src/core/util/paths').setFilesRoot('/files');

const { RNFS } = require('../src/native/files');

const render = renderPageImage as jest.Mock;
const pdf = imagesToPdf as jest.Mock;
const zip = zipDir as jest.Mock;
const remove = removeFile as jest.Mock;

const base: ExportOptions = {
  format: 'pdf',
  quality: 1,
  spread: false,
  cover: false,
  info: false,
  penName: '',
  longWidth: 800,
  autoCut: true,
  gap: 0,
  lang: null,
};

function story(patch: Partial<Project> = {}) {
  useStory.setState({
    projects: {
      p1: { id: 'p1', title: 'My Story', format: 'manga', pageSize: 'B5', ...patch } as Project,
    },
  });
}

const run = (options: Partial<ExportOptions> = {}, pageIds = ['a', 'b'], cancelled = () => false) =>
  runExport('p1', pageIds, { ...base, ...options }, () => {}, cancelled);

beforeEach(() => {
  jest.clearAllMocks();
  render.mockImplementation(async () => fakeImage());
  RNFS.exists.mockImplementation(async () => false);
  story();
});

describe('PDF page width (old bug #8)', () => {
  it('uses 516pt for B5', async () => {
    await run();
    expect(pdf.mock.calls[0][4]).toBe(516);
  });

  it('uses 420pt for A5', async () => {
    story({ pageSize: 'A5' });
    await run();
    expect(pdf.mock.calls[0][4]).toBe(420);
  });

  it('passes spread, reading direction and the page files in order', async () => {
    await run({ spread: true });
    const [paths, out, spread, rtl] = pdf.mock.calls[0];
    expect(paths.map((path: string) => path.split('/').pop())).toEqual(['001.jpg', '002.jpg']);
    expect(out).toMatch(/^\/files\/exports\/p1\/my-story-.*\.pdf$/);
    expect(spread).toBe(true);
    expect(rtl).toBe(true);
  });

  it('reads left to right for a webtoon', async () => {
    story({ format: 'webtoon' });
    await run();
    expect(pdf.mock.calls[0][3]).toBe(false);
  });
});

describe('output', () => {
  it('stores a path relative to the files root, inside the story folder', async () => {
    const result = await run();
    expect(result.path).toMatch(/^exports\/p1\/my-story-.*\.pdf$/);
    expect(RNFS.mkdir).toHaveBeenCalledWith('/files/exports/p1');
    expect(result).toMatchObject({ mime: 'application/pdf', size: 2048, pages: 2, format: 'pdf' });
  });

  it('draws every page through src/render at the chosen width', async () => {
    await run({ quality: 2, lang: null });
    expect(render.mock.calls).toEqual([
      ['a', 2400, { lang: undefined }],
      ['b', 2400, { lang: undefined }],
    ]);
  });

  it('passes a language the story has and ignores one it does not', async () => {
    story({ languages: ['French'] });
    const kept = await run({ lang: 'French' }, ['a']);
    expect(render).toHaveBeenLastCalledWith('a', 1200, { lang: 'French' });
    expect(kept.fileName).toContain('-French-');
    await run({ lang: 'German' }, ['a']);
    expect(render).toHaveBeenLastCalledWith('a', 1200, { lang: undefined });
  });

  it('frees each page image once it is on disk', async () => {
    const images = [fakeImage(), fakeImage()];
    render.mockImplementationOnce(async () => images[0]).mockImplementationOnce(async () => images[1]);
    await run();
    images.forEach(image => expect(image.dispose).toHaveBeenCalledTimes(1));
  });

  it('picks a free name instead of overwriting', async () => {
    RNFS.exists.mockImplementationOnce(async () => true);
    const result = await run();
    expect(result.fileName).toMatch(/-2\.pdf$/);
  });

  it('packs PNG and CBZ into their own archives', async () => {
    expect((await run({ format: 'png' })).mime).toBe('application/zip');
    expect((await run({ format: 'cbz' })).mime).toBe('application/vnd.comicbook+zip');
    expect(zip).toHaveBeenCalledTimes(2);
  });

  it('adds cover and info pages around the story', async () => {
    const result = await run({ cover: true, info: true, penName: 'Pen' });
    expect(result.pages).toBe(4);
    const names = pdf.mock.calls[0][0].map((path: string) => path.split('/').pop());
    expect(names).toEqual(['000.jpg', '001.jpg', '002.jpg', '003.jpg']);
  });

  it('copies a single long strip and zips several', async () => {
    const one = await run({ format: 'long' }, ['a']);
    expect(one).toMatchObject({ mime: 'image/png', pages: 1 });
    expect(RNFS.copyFile).toHaveBeenCalledTimes(1);

    const many = await run({ format: 'long', longWidth: 1080 }, ['a', 'b', 'c', 'd']);
    expect(many.mime).toBe('application/zip');
    expect(many.fileName).toContain('-long');
    expect(many.pages).toBeGreaterThan(1);
  });
});

describe('failure and cancelling', () => {
  it('stops with a clear message when a page cannot be drawn', async () => {
    render.mockImplementationOnce(async () => fakeImage()).mockImplementationOnce(async () => null);
    await expect(run()).rejects.toThrow("Page 2 couldn't be rendered.");
    expect(pdf).not.toHaveBeenCalled();
  });

  it('always clears its working folder', async () => {
    render.mockImplementation(async () => null);
    await expect(run()).rejects.toThrow();
    expect(remove.mock.calls.flat().filter(Boolean).some((path: string) => path.startsWith('/cache/tmp/export-'))).toBe(true);
  });

  it('removes a half-written file when the PDF step fails', async () => {
    pdf.mockRejectedValueOnce(new Error('disk full'));
    await expect(run()).rejects.toThrow('disk full');
    const out = pdf.mock.calls[0][1];
    expect(remove).toHaveBeenCalledWith(out);
  });

  it('stops at the next page when cancelled', async () => {
    let checks = 0;
    await expect(run({}, ['a', 'b', 'c'], () => ++checks > 1)).rejects.toBeInstanceOf(ExportCancelled);
    expect(render).toHaveBeenCalledTimes(1);
    expect(pdf).not.toHaveBeenCalled();
  });

  it('refuses a story that no longer exists', async () => {
    useStory.setState({ projects: {} });
    await expect(run()).rejects.toThrow('There are no pages to export.');
  });
});
