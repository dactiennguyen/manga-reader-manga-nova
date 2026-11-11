import { memo, useMemo } from 'react';
import { Image, View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { castMember } from '../../core/studio/cast';
import { lettersOf } from '../../core/studio/fanMail';
import { panelHasArt } from '../../state/artStore';
import { useAppNavigation } from '../../state/navigation';
import { Badge, Card, ICON, Icon, Text } from '../../ui';
import { CaretRightIcon } from '../../ui/icons';
import { STUDIO_ART } from '../../ui/studioArt';
import { CastAvatar } from '../studio/parts';
import type { HomeData } from './useHomeData';

/** The newest letter from the reading club and how many are still unread. */
export const LettersCard = memo(function LettersCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, m, studio, levelIndex, projects, club } = data;
  const letters = useMemo(
    () => lettersOf(state, m, studio, levelIndex, { hasArt: panelHasArt, reviews: club.reviews }),
    [state, m, studio, levelIndex, club],
  );
  const unread = useMemo(() => {
    const read = new Set(studio.mailRead);
    return letters.filter(letter => !read.has(letter.id)).length;
  }, [letters, studio.mailRead]);

  if (!projects.length) {
    return null;
  }
  const latest = letters[0];
  const from = latest ? castMember(latest.fromId).name : '';
  const unreadText = unread > 0 ? tn(unread, '{count} unread', '{count} unread') : '';
  return (
    <Card
      accessibilityLabel={[t('Letters'), unreadText, latest ? `${from}: ${latest.subject}` : ''].filter(Boolean).join('. ')}
      onPress={() => navigation.navigate('Mailbox')}
      className="flex-row items-start gap-3 p-3"
    >
      {latest ? (
        <CastAvatar id={latest.fromId} size={48} />
      ) : (
        <Image accessibilityIgnoresInvertColors source={STUDIO_ART.mail} style={{ width: 56, height: 56 }} className="rounded-md bg-paper" />
      )}
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text variant="heading" className="flex-1">
            {t('Letters')}
          </Text>
          {unread > 0 && <Badge text={unreadText} />}
        </View>
        {latest ? (
          <>
            <Text variant="label" numberOfLines={1}>
              {t('{name}: {subject}', { name: from, subject: latest.subject })}
            </Text>
            <Text variant="bodySmall" tone="secondary" numberOfLines={2}>
              {latest.body}
            </Text>
          </>
        ) : (
          <Text variant="bodySmall" tone="secondary">
            {t('The reading club writes to you when you finish pages and chapters.')}
          </Text>
        )}
      </View>
      <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />
    </Card>
  );
});
