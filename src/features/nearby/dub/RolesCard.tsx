import { View } from 'react-native';

import { t, tn } from '../../../core/i18n';
import { voiceOf, type CastEntry } from '../../../core/nearby/dub';
import type { Member, MemberId } from '../../../core/nearby/types';
import { Dropdown, SectionHeader, Text } from '../../../ui';

/** The host gives each role to someone in the room. Everyone sees only the lines of their roles. */
export function RolesCard({
  cast,
  names,
  roles,
  members,
  hostId,
  onAssign,
}: {
  cast: CastEntry[];
  names: Record<string, string>;
  roles: Record<string, MemberId>;
  members: Member[];
  hostId: MemberId;
  onAssign: (role: string, member: MemberId) => void;
}) {
  const options = members.map(member => ({ value: member.id, label: member.host ? t('{name} (host)', { name: member.name }) : member.name }));
  const present = members.map(member => member.id);
  return (
    <View className="gap-2">
      <SectionHeader>{t('Who voices whom')}</SectionHeader>
      <View className="gap-1 rounded-lg bg-surface p-1">
        {cast.map(entry => {
          const name = names[entry.role] ?? t('Someone');
          return (
            <View key={entry.role} className="min-h-12 flex-row items-center gap-3 px-3 py-1">
              <View className="flex-1">
                <Text variant="body" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="caption" tone="muted">
                  {tn(entry.lines, '{count} line', '{count} lines')}
                </Text>
              </View>
              <Dropdown
                value={voiceOf(roles, entry.role, hostId, present)}
                options={options}
                onChange={member => onAssign(entry.role, member)}
                accessibilityLabel={t('Who voices {name}', { name })}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
