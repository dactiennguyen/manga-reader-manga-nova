import type { ImageSourcePropType } from 'react-native';

/** Printed artwork for the "Play together nearby" features, on cream paper like ART. Text over it uses the `onPaper` tone. */
export const NEARBY_ART = {
  /** Wide banner: friends around a table drawing together on their phones. */
  hub: require('../assets/art/nearby/hub.webp'),
  codraw: require('../assets/art/nearby/codraw.webp'),
  relay: require('../assets/art/nearby/relay.webp'),
  battle: require('../assets/art/nearby/battle.webp'),
  read: require('../assets/art/nearby/read.webp'),
  dub: require('../assets/art/nearby/dub.webp'),
  cards: require('../assets/art/nearby/cards.webp'),
  mangakaCard: require('../assets/art/nearby/mangaka-card.webp'),
  send: require('../assets/art/nearby/send.webp'),
  /** Two phones on the same Wi-Fi, for the connection hint. */
  wifi: require('../assets/art/nearby/wifi.webp'),
} satisfies Record<string, ImageSourcePropType>;
