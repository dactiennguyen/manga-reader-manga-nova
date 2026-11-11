import type { CatalogPart } from '..';
import { canvas } from './canvas';
import { club } from './club';
import { clubChat } from './clubChat';
import { clubLetters } from './clubLetters';
import { clubPrompts } from './clubPrompts';
import { clubReviews } from './clubReviews';
import { clubVoices } from './clubVoices';
import { common } from './common';
import { core } from './core';
import { exporting } from './exporting';
import { extras } from './extras';
import { home } from './home';
import { homeStudio } from './homeStudio';
import { lettering } from './lettering';
import { media } from './media';
import { outline } from './outline';
import { people } from './people';
import { project } from './project';
import { script } from './script';
import { shell } from './shell';
import { studio } from './studio';
import { studioScreens } from './studioScreens';

/** One part per area of the app. A text used in two areas belongs in `common`. */
export const CATALOG_PARTS: Record<string, CatalogPart> = {
  common,
  core,
  shell,
  home,
  homeStudio,
  project,
  outline,
  script,
  people,
  canvas,
  lettering,
  exporting,
  extras,
  club,
  clubChat,
  clubPrompts,
  clubReviews,
  clubVoices,
  clubLetters,
  media,
  studio,
  studioScreens,
};

export const CATALOG: CatalogPart = Object.assign({}, ...Object.values(CATALOG_PARTS));
