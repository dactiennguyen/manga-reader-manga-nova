import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { Icon } from '../../../ui';
import { StarIcon } from '../../../ui/icons';
import { ICON } from '../../../ui/tokens';

/** Five stars for a club score from 1 to 5. An average rounds to whole stars; the label reads the exact number. */
export function ScoreStars({ score, size = ICON.sm }: { score: number; size?: number }) {
  const shown = Math.max(0, Math.min(5, Math.round(score)));
  const exact = Math.round(score * 10) / 10;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('{score} out of 5 stars', { score: exact })}
      className="flex-row items-center gap-0.5"
    >
      {[0, 1, 2, 3, 4].map(index => (
        <Icon
          key={index}
          icon={StarIcon}
          size={size}
          color={index < shown ? 'warning' : 'text-muted'}
          weight={index < shown ? 'fill' : 'regular'}
        />
      ))}
    </View>
  );
}
