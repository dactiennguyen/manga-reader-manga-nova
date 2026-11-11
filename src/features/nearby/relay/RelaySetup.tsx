/** The host sets up a relay: the page layout, who draws in which order, and how long a turn lasts. */
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { t } from '../../../core/i18n';
import {
  DEFAULT_RELAY_SECONDS,
  RELAY_SECONDS,
  RELAY_TEMPLATES,
  type RelaySetup as Setup,
} from '../../../core/nearby/relay';
import type { Member } from '../../../core/nearby/types';
import { Button, Chip, ChipRow, IconButton, Pressable, SectionHeader, Text } from '../../../ui';
import { ArrowDownIcon, ArrowUpIcon, PlayIcon } from '../../../ui/icons';
import { inkOf } from '../draw/members';
import { RelayPage } from '../draw/RelayPage';

const THUMB = 64;

export function RelaySetup({ members, onStart }: { members: Member[]; onStart: (setup: Setup) => void }) {
  const [templateId, setTemplateId] = useState(() => RELAY_TEMPLATES.find(item => item.count === 4)?.id ?? RELAY_TEMPLATES[0].id);
  const [order, setOrder] = useState(() => members.map(member => member.id));
  const [seconds, setSeconds] = useState<number>(DEFAULT_RELAY_SECONDS);

  // People who join keep their place at the end; people who leave drop out of the order.
  useEffect(() => {
    setOrder(current => {
      const ids = members.map(member => member.id);
      const kept = current.filter(id => ids.includes(id));
      return [...kept, ...ids.filter(id => !kept.includes(id))];
    });
  }, [members]);

  const move = (index: number, delta: -1 | 1) =>
    setOrder(current => {
      const next = [...current];
      const [id] = next.splice(index, 1);
      next.splice(index + delta, 0, id);
      return next;
    });

  const template = RELAY_TEMPLATES.find(item => item.id === templateId)!;
  const enough = order.length >= 2;
  return (
    <View className="gap-4">
      <View className="gap-2">
        <SectionHeader>{t('Page layout')}</SectionHeader>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-1">
          {RELAY_TEMPLATES.map(item => {
            const selected = item.id === templateId;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTemplateId(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('{n} panels', { n: item.count })}
                className={`items-center gap-1 rounded-md p-1.5 ${selected ? 'bg-accent' : 'bg-overlay'}`}
              >
                <RelayPage template={item} width={THUMB} pictures={{}} />
                <Text variant="caption" tone={selected ? 'onAccent' : 'secondary'}>
                  {item.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text variant="caption" tone="muted">
          {t('{n} panels: turns go round until every panel is drawn.', { n: template.count })}
        </Text>
      </View>

      <View className="gap-2">
        <SectionHeader>{t('Drawing order')}</SectionHeader>
        {order.map((id, index) => {
          const member = members.find(item => item.id === id);
          return (
            <View key={id} className="h-12 flex-row items-center gap-3 rounded-md bg-surface pl-3">
              <Text variant="mono" tone="secondary">
                {index + 1}
              </Text>
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: inkOf(member) }} />
              <Text variant="label" numberOfLines={1} className="flex-1">
                {member?.name ?? ''}
              </Text>
              <IconButton
                icon={ArrowUpIcon}
                disabled={index === 0}
                onPress={() => move(index, -1)}
                accessibilityLabel={t('Move {name} earlier', { name: member?.name ?? '' })}
              />
              <IconButton
                icon={ArrowDownIcon}
                disabled={index === order.length - 1}
                onPress={() => move(index, 1)}
                accessibilityLabel={t('Move {name} later', { name: member?.name ?? '' })}
              />
            </View>
          );
        })}
      </View>

      <View className="gap-2">
        <SectionHeader>{t('Time per panel')}</SectionHeader>
        <ChipRow>
          {RELAY_SECONDS.map(value => (
            <Chip
              key={value}
              label={t('{n} min', { n: value / 60 })}
              selected={value === seconds}
              onPress={() => setSeconds(value)}
            />
          ))}
        </ChipRow>
      </View>

      <Button
        title={enough ? t('Start the relay') : t('Waiting for a second person')}
        icon={PlayIcon}
        disabled={!enough}
        onPress={() => onStart({ templateId, order, seconds })}
      />
    </View>
  );
}
