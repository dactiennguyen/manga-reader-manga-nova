import type { ImageSourcePropType } from 'react-native';

import type { CastId, LevelId } from '../core/studio/types';

/** Printed artwork for the studio features on Home, on cream paper like ART. Text over it uses the `onPaper` tone. */
export const STUDIO_ART = {
  editor: require('../assets/art/studio/editor.webp'),
  /** The whole reading club together. */
  club: require('../assets/art/studio/club.webp'),
  gift: require('../assets/art/studio/gift.webp'),
  giftOpen: require('../assets/art/studio/gift-open.webp'),
  mail: require('../assets/art/studio/mail.webp'),
  magazine: require('../assets/art/studio/magazine.webp'),
  cards: require('../assets/art/studio/cards.webp'),
  trailer: require('../assets/art/studio/trailer.webp'),
  journey: require('../assets/art/studio/journey.webp'),
  prompt: require('../assets/art/studio/prompt.webp'),
} satisfies Record<string, ImageSourcePropType>;

/** Square portraits of the editor and each reading club member, all drawn the same way so they sit well in a row. */
export const READER_ART: Record<CastId, ImageSourcePropType> = {
  mori: require('../assets/art/studio/reader-mori.webp'),
  hana: require('../assets/art/studio/reader-hana.webp'),
  kenta: require('../assets/art/studio/reader-kenta.webp'),
  aiko: require('../assets/art/studio/reader-aiko.webp'),
  daichi: require('../assets/art/studio/reader-daichi.webp'),
  mai: require('../assets/art/studio/reader-mai.webp'),
  minh: require('../assets/art/studio/reader-minh.webp'),
  linh: require('../assets/art/studio/reader-linh.webp'),
  sora: require('../assets/art/studio/reader-sora.webp'),
  tetsu: require('../assets/art/studio/reader-tetsu.webp'),
  yui: require('../assets/art/studio/reader-yui.webp'),
  bao: require('../assets/art/studio/reader-bao.webp'),
  rin: require('../assets/art/studio/reader-rin.webp'),
};

/** One picture per mangaka journey level. */
export const LEVEL_ART: Record<LevelId, ImageSourcePropType> = {
  rookie: require('../assets/art/studio/level-rookie.webp'),
  assistant: require('../assets/art/studio/level-assistant.webp'),
  oneshot: require('../assets/art/studio/level-oneshot.webp'),
  serial: require('../assets/art/studio/level-serial.webp'),
  cover: require('../assets/art/studio/level-cover.webp'),
  anime: require('../assets/art/studio/level-anime.webp'),
};
