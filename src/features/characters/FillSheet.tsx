import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AiIcon, RefreshIcon } from '../../ui/icons';

import { storyBrief } from '../../core/ai/context';
import { suggestCharacter, type CharacterDraft } from '../../core/ai/people';
import type { Character } from '../../core/model/types';
import { fillKeywords, fillPatch, fillRows, type FillMode } from '../../core/story/characterFill';
import { plural } from '../../core/util/format';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { Button, Divider, FieldLabel, Segmented, Sheet, Tag, Text, TextField, toast } from '../../ui';
import { AiBusy, AiFailure, AiMark, AiSetupNotice, SheetFooter, useSheetClose } from '../outline/AiParts';

const KEYWORDS_MAX = 300;

const MODES: readonly { value: FillMode; label: string }[] = [
  { value: 'empty', label: 'Fill empty fields only' },
  { value: 'all', label: 'Replace all fields' },
];

export function FillSheet({
  character,
  onClose,
  onApplied,
}: {
  character: Character;
  onClose: () => void;
  onApplied: (patch: Partial<CharacterDraft>) => void;
}) {
  const navigation = useAppNavigation();
  const configured = useAiConfigured();
  const sheet = useSheetClose(onClose);
  const { state, start, cancel, reset } = useAiTask<CharacterDraft>();
  const [keywords, setKeywords] = useState(() => fillKeywords(character));
  const [mode, setMode] = useState<FillMode>('empty');

  const generate = () => {
    const words = keywords.trim();
    if (!words) {
      return;
    }
    const brief = storyBrief(useStory.getState(), character.projectId).text;
    start(signal => suggestCharacter(brief, words, signal));
  };

  const openProfile = () => sheet.closeThen(() => navigation.navigate('Tabs', { screen: 'Profile' }));

  const apply = (draft: CharacterDraft) => {
    const store = useStory.getState();
    const current = store.characters[character.id];
    if (!current) {
      return;
    }
    const patch = fillPatch(current, draft, mode);
    const count = Object.keys(patch).length;
    if (!count) {
      toast('Every field already has a value');
      return;
    }
    store.updateCharacter(character.id, patch);
    onApplied(patch);
    sheet.close();
    toast(`${plural(count, 'field')} filled by AI`);
  };

  const renderDraft = (draft: CharacterDraft) => {
    const current = useStory.getState().characters[character.id] ?? character;
    const rows = fillRows(current, draft, mode).filter(row => row.value);
    const applied = rows.filter(row => row.applied).length;
    return (
      <>
        <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
          <AiMark />
          <Text variant="caption" tone="muted">
            Nothing is saved until you fill the profile. You can edit every field afterwards.
          </Text>
          <Segmented options={MODES} value={mode} onChange={setMode} />
          {mode === 'empty' && (
            <Text variant="caption" tone="muted">
              Fields you already filled in, including the name, are kept.
            </Text>
          )}
          <View className="rounded-lg bg-surface px-3">
            {rows.map((row, index) => (
              <View key={row.key}>
                {index > 0 && <Divider />}
                <View className="gap-0.5 py-2">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text variant="caption" tone={row.applied ? 'ai' : 'muted'}>
                      {row.label}
                    </Text>
                    {!row.applied && <Tag label="Kept" />}
                  </View>
                  <Text tone={row.applied ? 'text' : 'muted'}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        <SheetFooter>
          <Button
            title={applied ? `Fill ${plural(applied, 'field')}` : 'Nothing to fill'}
            icon={AiIcon}
            variant="ai"
            disabled={!applied}
            onPress={() => apply(draft)}
          />
          <View className="flex-row gap-2">
            <Button title="Try again" icon={RefreshIcon} variant="secondary" onPress={generate} className="flex-1" />
            <Button title="Discard" variant="ghost" onPress={sheet.close} className="flex-1" />
          </View>
        </SheetFooter>
      </>
    );
  };

  const renderBody = () => {
    if (!configured) {
      return <AiSetupNotice onOpenProfile={openProfile} />;
    }
    if (state.status === 'loading') {
      return <AiBusy label="Writing the character…" onCancel={cancel} />;
    }
    if (state.status === 'error') {
      return (
        <>
          <AiFailure message={state.message} onRetry={generate} />
          <SheetFooter>
            <Button title="Back" variant="ghost" onPress={reset} />
          </SheetFooter>
        </>
      );
    }
    if (state.status === 'done') {
      return renderDraft(state.data);
    }
    return (
      <>
        <ScrollView contentContainerClassName="gap-3 px-4 pb-4" keyboardShouldPersistTaps="handled">
          <Text tone="secondary">
            Describe the character in a few keywords. The AI drafts the name, role, traits, goal, weakness, way of speaking,
            backstory and appearance for you to review.
          </Text>
          <View className="gap-1">
            <FieldLabel>Keywords</FieldLabel>
            <TextField
              value={keywords}
              onChangeText={setKeywords}
              placeholder="shy swordswoman, hides a scar, hates lying"
              accessibilityLabel="Keywords"
              multiline
              maxLength={KEYWORDS_MAX}
              autoFocus
              textAlignVertical="top"
              inputClassName="min-h-18"
            />
          </View>
        </ScrollView>
        <SheetFooter>
          <Button title="Suggest character" icon={AiIcon} variant="ai" disabled={!keywords.trim()} onPress={generate} />
        </SheetFooter>
      </>
    );
  };

  return (
    <Sheet
      visible={sheet.visible}
      onClose={sheet.close}
      onClosed={sheet.onClosed}
      title="Fill with AI"
      subtitle={character.name.trim() || 'New character'}
      scroll={false}
      maxHeight="90%"
    >
      {renderBody()}
    </Sheet>
  );
}
