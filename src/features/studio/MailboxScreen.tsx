import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { activeProjects } from '../../core/model/selectors';
import { castMember } from '../../core/studio/cast';
import { lettersOf } from '../../core/studio/fanMail';
import { levelIndexOf } from '../../core/studio/journey';
import type { Letter } from '../../core/studio/types';
import { formatDate } from '../../core/util/time';
import { panelHasArt } from '../../state/artStore';
import { useStoryData } from '../../state/hooks';
import { useMetrics, useStudioState } from '../../state/useMetrics';
import { useAppNavigation } from '../../state/navigation';
import { useStudio } from '../../state/useStudio';
import { Button, Card, EmptyState, Text } from '../../ui';
import { STUDIO_ART } from '../../ui/studioArt';
import { CastAvatar } from './parts';
import { StudioPage } from './StudioPage';

function LetterRow({ letter, unread, open, onPress }: { letter: Letter; unread: boolean; open: boolean; onPress: () => void }) {
  const navigation = useAppNavigation();
  const member = castMember(letter.fromId);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${unread ? `${t('Unread')}. ` : ''}${t('From {name}', { name: member.name })}: ${letter.subject}`}
      className={`gap-3 p-3 ${unread ? 'border-l-4 border-accent' : ''}`}
    >
      <View className="flex-row gap-3">
        <CastAvatar id={letter.fromId} size={open ? 56 : 44} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text variant={unread ? 'label' : 'bodySmall'} tone={unread ? 'text' : 'secondary'} numberOfLines={1} className="shrink">
              {member.name}
            </Text>
            <Text variant="caption" tone="muted">
              {formatDate(letter.at)}
            </Text>
          </View>
          <Text variant={unread ? 'heading' : 'body'} tone={unread ? 'text' : 'secondary'} numberOfLines={open ? undefined : 1}>
            {letter.subject}
          </Text>
          {!open && (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {letter.body}
            </Text>
          )}
        </View>
      </View>
      {open && (
        <View className="gap-3">
          <Text>{letter.body}</Text>
          <Text variant="caption" tone="muted">
            {t('{name} · {role}', { name: member.name, role: t(member.role) })}
          </Text>
          {!!letter.chapterId && (
            <Button
              title={t("See the club's votes")}
              variant="secondary"
              small
              className="self-start"
              onPress={() => navigation.navigate('Club', { chapterId: letter.chapterId })}
            />
          )}
        </View>
      )}
    </Card>
  );
}

/** Letters from the reading club about the person's own work. Unread ones come first and stand out. */
export function MailboxScreen() {
  const navigation = useAppNavigation();
  const state = useStoryData();
  const metrics = useMetrics();
  const studio = useStudioState();
  const [openId, setOpenId] = useState<string | null>(null);
  // Sorted by what was unread on arrival, so a letter does not jump away the moment it is opened.
  const [readOnArrival] = useState(() => new Set(useStudio.getState().mailRead));
  const read = useMemo(() => new Set(studio.mailRead), [studio.mailRead]);
  const letters = useMemo(() => {
    const all = lettersOf(state, metrics, studio, levelIndexOf(metrics), { hasArt: panelHasArt });
    return [...all.filter(letter => !readOnArrival.has(letter.id)), ...all.filter(letter => readOnArrival.has(letter.id))];
  }, [state, metrics, studio, readOnArrival]);
  const unread = letters.filter(letter => !read.has(letter.id)).length;
  const latest = activeProjects(state)[0];

  const onPress = (letter: Letter) => {
    setOpenId(current => (current === letter.id ? null : letter.id));
    useStudio.getState().markMailRead(letter.id);
  };

  return (
    <StudioPage title={t('Mailbox')} subtitle={letters.length > 0 ? tn(unread, '{count} unread', '{count} unread') : undefined}>
      {letters.length === 0 ? (
        <EmptyState
          art={STUDIO_ART.mail}
          title={t('No letters yet')}
          message={t('The reading club writes when you finish a chapter, your first page, a long streak or a new level.')}
          action={
            latest
              ? { label: t('Open your story'), onPress: () => navigation.navigate('Project', { projectId: latest.id }) }
              : { label: t('Start a story'), onPress: () => navigation.navigate('NewProject') }
          }
        />
      ) : (
        letters.map(letter => (
          <LetterRow key={letter.id} letter={letter} unread={!read.has(letter.id)} open={openId === letter.id} onPress={() => onPress(letter)} />
        ))
      )}
    </StudioPage>
  );
}
