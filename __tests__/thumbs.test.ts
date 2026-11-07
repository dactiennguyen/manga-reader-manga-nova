import type { Page, Project } from '../src/core/model/types';
import type { RenderDeps } from '../src/render/config';

jest.mock('../src/render/drawPage', () => ({ renderPageToFile: jest.fn() }));

/** The queue keeps module state, so every test gets a fresh copy. */
function fresh() {
  jest.resetModules();
  require('../src/core/util/paths').setFilesRoot('/files');
  const { configureRender } = require('../src/render/config') as typeof import('../src/render/config');
  const { requestThumb, thumbPath } = require('../src/render/thumbs') as typeof import('../src/render/thumbs');
  const render = require('../src/render/drawPage').renderPageToFile as jest.Mock;
  return { configureRender, requestThumb, thumbPath, render };
}

const page = (id: string, artRev = 1) => ({ id, artRev, updatedAt: 5 } as unknown as Page);

function setup(ensureDir: () => Promise<void>) {
  const queue = fresh();
  const store = new Map<string, string>();
  const deps: RenderDeps = {
    loadArt: () => null,
    pageSource: id => ({ page: page(id), project: {} as Project }),
    usePage: () => undefined,
    useProjectOfPage: () => undefined,
    files: { writeBase64: async () => {}, remove: async () => {}, ensureDir },
    stamps: {
      get: key => store.get(key) ?? null,
      set: (key, value) => void store.set(key, value),
      remove: key => void store.delete(key),
    },
  };
  queue.configureRender(deps);
  return { ...queue, store };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
};

describe('thumbnail queue', () => {
  it('renders into the thumbs folder and records the version', async () => {
    const { store, render, requestThumb, thumbPath } = setup(async () => {});
    render.mockResolvedValue(true);
    requestThumb('a');
    await settle();
    expect(render).toHaveBeenCalledWith('a', 360, '/files/thumbs/a.png', 'png');
    expect(thumbPath('a')).toBe('/files/thumbs/a.png');
    expect(store.get('thumb:a')).toBe('1.5');
  });

  it('survives a failed folder: the queue is released and the failure is not cached', async () => {
    let fail = true;
    const ensureDir = jest.fn(async () => {
      if (fail) {
        throw new Error('no disk');
      }
    });
    const { store, render, requestThumb } = setup(ensureDir);
    render.mockResolvedValue(true);
    requestThumb('b');
    await settle();
    expect(render).not.toHaveBeenCalled();
    fail = false;
    requestThumb('c');
    await settle();
    expect(ensureDir).toHaveBeenCalledTimes(2);
    expect(store.has('thumb:b')).toBe(true);
    expect(store.has('thumb:c')).toBe(true);
  });

  it('one page failing does not stop the pages behind it', async () => {
    const { store, render, requestThumb } = setup(async () => {});
    render.mockRejectedValueOnce(new Error('bad page')).mockResolvedValue(true);
    requestThumb('d');
    requestThumb('e');
    await settle();
    expect(store.has('thumb:d')).toBe(false);
    expect(store.has('thumb:e')).toBe(true);
  });

  it('asks only once for a page already waiting', async () => {
    const { render, requestThumb } = setup(async () => {});
    render.mockResolvedValue(true);
    requestThumb('f');
    requestThumb('f');
    await settle();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
