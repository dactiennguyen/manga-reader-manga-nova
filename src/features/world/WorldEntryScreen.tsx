import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { AiIcon, CheckIcon, DeleteIcon, MoreIcon, ShapesIcon } from '../../ui/icons';

import { WORLD_TYPES, WORLD_TYPE_LABEL } from '../../core/model/constants';
import type { WorldEntry } from '../../core/model/types';
import { BODY_MAX } from '../../core/story/plotHoles';
import { UNTITLED } from '../../core/world/worldTools';
import { useChapters } from '../../state/hooks';
import { useAppNavigation, type ScreenProps } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { AppBar, Button, EmptyState, IconButton, Menu, Screen, Text, confirm, useColor } from '../../ui';
import { AutoField, useDraft } from '../characters/fields';
import { DescribeSheet } from './DescribeSheet';
import { EntryImages } from './EntryImages';
import { EntryLinks, EntryTypeFields } from './EntryLinks';
import { WORLD_TYPE_ICON } from './worldShared';

const TITLE_MAX = 80;

export function WorldEntryScreen({ route, navigation }: ScreenProps<'WorldEntry'>) {
  const entry = useStory(s => s.world[route.params.entryId]);
  if (!entry) {
    return (
      <Screen>
        <AppBar title="World" onBack={() => navigation.goBack()} />
        <EmptyState title="Entry not found" message="This entry has been deleted." />
      </Screen>
    );
  }
  return <EntryBody key={entry.id} entry={entry} />;
}

function EntryBody({ entry }: { entry: WorldEntry }) {
  const navigation = useAppNavigation();
  const muted = useColor('text-muted');
  const accent = useColor('accent');
  const update = useStory(s => s.updateWorldEntry);
  const chapters = useChapters(entry.projectId);
  const [isNew] = useState(() => !entry.title.trim());
  const [menu, setMenu] = useState(false);
  const [typeMenu, setTypeMenu] = useState(false);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [bodyVersion, setBodyVersion] = useState(0);
  const title = useDraft(entry.title, value => update(entry.id, { title: value.trim() }));
  const titleText = title.text.trim();

  const openDescribe = () => {
    title.onBlur();
    setDescribeOpen(true);
  };

  const remove = async () => {
    const ok = await confirm(`Delete "${entry.title.trim() || UNTITLED}"?`, 'This entry will be removed from the story world.', {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) {
      navigation.goBack();
      useStory.getState().removeWorldEntry(entry.id);
    }
  };

  return (
    <Screen padded={false}>
      <AppBar
        title={WORLD_TYPE_LABEL[entry.type]}
        onBack={() => navigation.goBack()}
        right={<IconButton icon={MoreIcon} onPress={() => setMenu(true)} accessibilityLabel="More" />}
      />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerClassName="pb-12">
        <EntryImages entry={entry} />
        <View className="p-4">
          <TextInput
            value={title.text}
            onChangeText={title.onChangeText}
            onBlur={title.onBlur}
            placeholder="Title"
            placeholderTextColor={muted}
            selectionColor={accent}
            cursorColor={accent}
            accessibilityLabel="Title"
            maxLength={TITLE_MAX}
            autoFocus={isNew}
            className="mb-4 border-b border-control-border px-0 py-2 text-title font-inter-semibold text-text"
          />
          <EntryTypeFields entry={entry} chapters={chapters} />
          <AutoField
            key={bodyVersion}
            label="Content"
            value={entry.body}
            onCommit={body => update(entry.id, { body })}
            placeholder="Description, details to remember, rules…"
            multiline
            maxLength={BODY_MAX}
            minHeight={160}
          />
          <View className="-mt-2 mb-4 flex-row items-center gap-3">
            <Text variant="caption" tone="muted" className="flex-1">
              {titleText ? 'Let the AI draft this entry from its title.' : 'Add a title to write this entry with AI.'}
            </Text>
            <Button title="Write with AI" icon={AiIcon} variant="ai" small disabled={!titleText} onPress={openDescribe} />
          </View>
          <EntryLinks entry={entry} chapters={chapters} />
        </View>
      </KeyboardAwareScrollView>

      <Menu
        visible={menu}
        onClose={() => setMenu(false)}
        title={entry.title.trim() || UNTITLED}
        items={[
          { label: 'Change type', icon: ShapesIcon, subtitle: WORLD_TYPE_LABEL[entry.type], onPress: () => setTypeMenu(true) },
          { label: 'Delete', icon: DeleteIcon, destructive: true, onPress: remove },
        ]}
      />
      <Menu
        visible={typeMenu}
        onClose={() => setTypeMenu(false)}
        title="Change type"
        items={WORLD_TYPES.map(type => ({
          label: WORLD_TYPE_LABEL[type],
          icon: entry.type === type ? CheckIcon : WORLD_TYPE_ICON[type],
          onPress: () => update(entry.id, { type }),
        }))}
      />
      {describeOpen && (
        <DescribeSheet
          entryId={entry.id}
          title={titleText}
          onClose={() => setDescribeOpen(false)}
          onApplied={() => setBodyVersion(version => version + 1)}
        />
      )}
    </Screen>
  );
}
