import { View } from 'react-native';

import { t } from '../../core/i18n';
import type { JoinMode } from '../../core/nearby/types';
import { Radio } from '../../ui';

/**
 * Who can join a hosted room. Code only is first and the default: on school or café Wi-Fi, anyone could
 * otherwise tap the room in their list. Used when opening a room and, by the host, inside it.
 */
export function JoinModeChoice({ value, onChange }: { value: JoinMode; onChange: (mode: JoinMode) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('Who can join')}>
      <Radio
        selected={value === 'code'}
        onPress={() => onChange('code')}
        label={t('Only with the room code or QR')}
        description={t('Your room shows a lock in the list. Best on school or café Wi-Fi.')}
      />
      <Radio
        selected={value === 'open'}
        onPress={() => onChange('open')}
        label={t('Anyone on this Wi-Fi can join')}
        description={t('Friends tap your room in their list. Good for Wi-Fi at home.')}
      />
    </View>
  );
}
