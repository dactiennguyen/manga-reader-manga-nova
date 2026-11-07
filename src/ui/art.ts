import type { ImageSourcePropType } from 'react-native';

import type { ArtStyle } from '../core/model/types';

/** Printed artwork on cream paper. Text over it uses the `onPaper` tone in both themes. */
export const ART = {
  homeHero: require('../assets/art/home-hero.webp'),
  welcomeWrite: require('../assets/art/welcome-write.webp'),
  welcomeDraw: require('../assets/art/welcome-draw.webp'),
  welcomeFinish: require('../assets/art/welcome-finish.webp'),
  profileBanner: require('../assets/art/profile-banner.webp'),
  assistantHero: require('../assets/art/assistant-hero.webp'),
  emptyLibrary: require('../assets/art/empty-library.webp'),
  emptyCharacters: require('../assets/art/empty-characters.webp'),
  emptyWorld: require('../assets/art/empty-world.webp'),
  emptyTrash: require('../assets/art/empty-trash.webp'),
  tileDraw: require('../assets/art/tile-draw.webp'),
  tileScript: require('../assets/art/tile-script.webp'),
  tileStoryboard: require('../assets/art/tile-storyboard.webp'),
  tileCharacters: require('../assets/art/tile-characters.webp'),
  tileWorld: require('../assets/art/tile-world.webp'),
  tileOutline: require('../assets/art/tile-outline.webp'),
  tileNotes: require('../assets/art/tile-notes.webp'),
  tileAi: require('../assets/art/tile-ai.webp'),
  tileExport: require('../assets/art/tile-export.webp'),
} satisfies Record<string, ImageSourcePropType>;

/** Doubles as the cover of a story with no image, so a new story already looks like a book. */
export const STYLE_ART: Record<ArtStyle, ImageSourcePropType> = {
  shounen: require('../assets/art/style-shounen.webp'),
  shoujo: require('../assets/art/style-shoujo.webp'),
  seinen: require('../assets/art/style-seinen.webp'),
  chibi: require('../assets/art/style-chibi.webp'),
  horror: require('../assets/art/style-horror.webp'),
  slice: require('../assets/art/style-slice.webp'),
};
