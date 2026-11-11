import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { READERS } from '../../../core/studio/cast';
import { ArtBanner, Button, Card, Text } from '../../../ui';
import { STUDIO_ART } from '../../../ui/studioArt';
import { CastAvatar } from '../parts';

/** Who the reading club is, said plainly: twelve characters of the app who read on this device. */
export function ClubIntro({ onDone, doneLabel }: { onDone: () => void; doneLabel: string }) {
  return (
    <>
      <ArtBanner source={STUDIO_ART.club} ratio={2} />
      <View className="gap-1">
        <Text variant="title" accessibilityRole="header">
          {t('The Manganova reading club')}
        </Text>
        <Text tone="secondary">
          {t(
            'Twelve characters who live in this app. They read the chapters you write and draw, right here on your device, and each one says what they think in their own way.',
          )}
        </Text>
      </View>
      <Card>
        {READERS.map((member, index) => (
          <View key={member.id} className={`flex-row gap-3 p-3 ${index > 0 ? 'border-t border-divider' : ''}`}>
            <CastAvatar id={member.id} size={52} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row flex-wrap items-baseline gap-x-2">
                <Text variant="label">{member.name}</Text>
                <Text variant="caption" tone="accent">
                  {t(member.role)}
                </Text>
              </View>
              <Text variant="bodySmall" tone="secondary">
                {t(member.bio)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
      <Button title={doneLabel} onPress={onDone} />
    </>
  );
}
