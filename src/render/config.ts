import type { ID, Page, PanelArt, Project } from '../core/model/types';
import type { MetaRepo } from '../core/ports';

export type PageSource = { page: Page; project: Project };

/** Everything render needs from the layers above it. src/app wires this once at boot. */
export type RenderDeps = {
  loadArt: (panelId: ID) => PanelArt | null;
  pageSource: (pageId: ID) => PageSource | null;
  /** Hooks, so PageView and useThumb re-render when the page changes. */
  usePage: (pageId: ID | undefined) => Page | undefined;
  useProjectOfPage: (pageId: ID | undefined) => Project | undefined;
  files: {
    writeBase64: (absolutePath: string, base64: string) => Promise<void>;
    remove: (absolutePath: string) => Promise<void>;
    ensureDir: (absolutePath: string) => Promise<void>;
  };
  /** Remembers which version of a page each thumbnail shows. */
  stamps: MetaRepo;
};

let deps: RenderDeps | null = null;

export function configureRender(next: RenderDeps): void {
  deps = next;
}

export function renderDeps(): RenderDeps {
  if (!deps) {
    throw new Error('configureRender has not been called.');
  }
  return deps;
}
