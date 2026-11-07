import type { ImageSourcePropType } from 'react-native';

export type MaterialKind = 'background' | 'pattern';

export type Material = { id: string; label: string; kind: MaterialKind; source: ImageSourcePropType };

/** Black ink on transparency, so a material sits on any layer without a white box around it. */
export const MATERIALS: Material[] = [
  { id: 'bg-classroom', label: 'Classroom', kind: 'background', source: require('../../assets/materials/bg-classroom.webp') },
  { id: 'bg-street', label: 'Street', kind: 'background', source: require('../../assets/materials/bg-street.webp') },
  { id: 'bg-rooftop', label: 'Rooftop', kind: 'background', source: require('../../assets/materials/bg-rooftop.webp') },
  { id: 'bg-bedroom', label: 'Bedroom', kind: 'background', source: require('../../assets/materials/bg-bedroom.webp') },
  { id: 'bg-forest', label: 'Forest path', kind: 'background', source: require('../../assets/materials/bg-forest.webp') },
  { id: 'bg-city', label: 'City', kind: 'background', source: require('../../assets/materials/bg-city.webp') },
  { id: 'fx-sparkles', label: 'Sparkles', kind: 'pattern', source: require('../../assets/materials/fx-sparkles.webp') },
  { id: 'fx-flowers', label: 'Falling petals', kind: 'pattern', source: require('../../assets/materials/fx-flowers.webp') },
  { id: 'fx-rain', label: 'Rain', kind: 'pattern', source: require('../../assets/materials/fx-rain.webp') },
  { id: 'fx-burst', label: 'Impact burst', kind: 'pattern', source: require('../../assets/materials/fx-burst.webp') },
  { id: 'fx-clouds', label: 'Clouds', kind: 'pattern', source: require('../../assets/materials/fx-clouds.webp') },
  { id: 'fx-leaves', label: 'Falling leaves', kind: 'pattern', source: require('../../assets/materials/fx-leaves.webp') },
];
