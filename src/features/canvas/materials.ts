import type { ImageSourcePropType } from 'react-native';

import { msg } from '../../core/i18n';

export type MaterialKind = 'background' | 'pattern';

export type Material = { id: string; label: string; kind: MaterialKind; source: ImageSourcePropType };

/** Black ink on transparency, so a material sits on any layer without a white box around it. */
export const MATERIALS: Material[] = [
  { id: 'bg-classroom', label: msg('Classroom'), kind: 'background', source: require('../../assets/materials/bg-classroom.webp') },
  { id: 'bg-street', label: msg('Street'), kind: 'background', source: require('../../assets/materials/bg-street.webp') },
  { id: 'bg-rooftop', label: msg('Rooftop'), kind: 'background', source: require('../../assets/materials/bg-rooftop.webp') },
  { id: 'bg-bedroom', label: msg('Bedroom'), kind: 'background', source: require('../../assets/materials/bg-bedroom.webp') },
  { id: 'bg-forest', label: msg('Forest path'), kind: 'background', source: require('../../assets/materials/bg-forest.webp') },
  { id: 'bg-city', label: msg('City'), kind: 'background', source: require('../../assets/materials/bg-city.webp') },
  { id: 'fx-sparkles', label: msg('Sparkles'), kind: 'pattern', source: require('../../assets/materials/fx-sparkles.webp') },
  { id: 'fx-flowers', label: msg('Falling petals'), kind: 'pattern', source: require('../../assets/materials/fx-flowers.webp') },
  { id: 'fx-rain', label: msg('Rain'), kind: 'pattern', source: require('../../assets/materials/fx-rain.webp') },
  { id: 'fx-burst', label: msg('Impact burst'), kind: 'pattern', source: require('../../assets/materials/fx-burst.webp') },
  { id: 'fx-clouds', label: msg('Clouds'), kind: 'pattern', source: require('../../assets/materials/fx-clouds.webp') },
  { id: 'fx-leaves', label: msg('Falling leaves'), kind: 'pattern', source: require('../../assets/materials/fx-leaves.webp') },
];
