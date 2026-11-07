import { memo } from 'react';
import { View } from 'react-native';
import { CaretDownIcon, CaretUpIcon, CloseIcon } from '../../ui/icons';

import type { FindContext } from '../../core/script/blockOps';
import { Button, Chip, IconButton, SearchField, Text, TextField } from '../../ui';

export type FindBarProps = {
  query: string;
  replacement: string;
  matchCase: boolean;
  count: number;
  current: number;
  context?: FindContext;
  onQuery: (value: string) => void;
  onReplacement: (value: string) => void;
  onMatchCase: (value: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
};

export const FindBar = memo(function FindBarBase({
  query,
  replacement,
  matchCase,
  count,
  current,
  context,
  onQuery,
  onReplacement,
  onMatchCase,
  onNext,
  onPrevious,
  onReplace,
  onReplaceAll,
  onClose,
}: FindBarProps) {
  const none = count === 0;
  const status = !query ? '' : none ? 'No results' : `${current + 1} of ${count}`;
  return (
    <View className="gap-2 bg-raised px-3 py-2">
      <View className="flex-row items-center gap-1">
        <SearchField
          autoFocus
          value={query}
          onChangeText={onQuery}
          placeholder="Find in script"
          autoCapitalize="none"
          autoCorrect={false}
          submitBehavior="submit"
          onSubmitEditing={onNext}
          accessibilityLabel="Find in script"
          className="flex-1"
        />
        <IconButton icon={CaretUpIcon} onPress={onPrevious} disabled={none} accessibilityLabel="Previous match" />
        <IconButton icon={CaretDownIcon} onPress={onNext} disabled={none} accessibilityLabel="Next match" />
        <IconButton icon={CloseIcon} onPress={onClose} accessibilityLabel="Close find" />
      </View>
      <View className="flex-row items-center gap-2">
        <TextField
          value={replacement}
          onChangeText={onReplacement}
          placeholder="Replace with"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          submitBehavior="submit"
          accessibilityLabel="Replace with"
          className="flex-1"
        />
        <Button title="Replace" variant="secondary" small onPress={onReplace} disabled={none} />
        <Button title="All" small onPress={onReplaceAll} disabled={none} />
      </View>
      <View className="flex-row items-center gap-2">
        <Chip label="Match case" selected={matchCase} onPress={() => onMatchCase(!matchCase)} />
        <Text
          variant="caption"
          tone={query && none ? 'danger' : 'muted'}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          className="min-w-14"
        >
          {status}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1} ellipsizeMode="tail" className="flex-1 text-right">
          {context ? (
            <>
              {context.before}
              <Text variant="caption" tone="accent" className="underline">
                {context.match}
              </Text>
              {context.after}
            </>
          ) : (
            'Searches every block in this chapter'
          )}
        </Text>
      </View>
    </View>
  );
});
