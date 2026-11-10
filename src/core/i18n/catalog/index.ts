import type { CatalogPart } from '..';
import { canvas } from './canvas';
import { common } from './common';
import { core } from './core';
import { exporting } from './exporting';
import { home } from './home';
import { lettering } from './lettering';
import { outline } from './outline';
import { people } from './people';
import { project } from './project';
import { script } from './script';
import { shell } from './shell';

/** One part per area of the app. A text used in two areas belongs in `common`. */
export const CATALOG_PARTS: Record<string, CatalogPart> = {
  common,
  core,
  shell,
  home,
  project,
  outline,
  script,
  people,
  canvas,
  lettering,
  exporting,
};

export const CATALOG: CatalogPart = Object.assign({}, ...Object.values(CATALOG_PARTS));
