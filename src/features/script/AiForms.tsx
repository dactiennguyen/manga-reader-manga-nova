import { ScrollView, View } from 'react-native';
import { AiIcon, CutIcon, PenLineIcon, RepeatIcon, SfxIcon, VoiceIcon } from '../../ui/icons';

import { BLOCK_LABEL, LIMITS } from '../../core/model/constants';
import { MAX_SCENE_REWRITE, type AiAction, type BlockLocation, type RewriteScope } from '../../core/script/aiDrafts';
import { Button, Chip, ChipGroup, FieldLabel, ListItem, Text, TextField } from '../../ui';
import { Footer } from './AiDraftViews';

export const AI_TITLE: Record<AiAction, string> = {
  continue: 'Continue writing',
  rewrite: 'Rewrite',
  voice: 'Change voice',
  shorten: 'Shorten',
  sfx: 'SFX ideas',
};

const QUICK_INSTRUCTIONS = ['more dramatic', 'funnier', 'shorter', 'clearer'];

const INSTRUCTION_MAX = 120;

export function AiActionMenu({
  location,
  speakerName,
  available,
  onChoose,
}: {
  location: BlockLocation | undefined;
  speakerName: string | undefined;
  available: Record<AiAction, boolean>;
  onChoose: (action: AiAction) => void;
}) {
  const length = location?.block.text.trim().length ?? 0;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View className="px-4 pb-2">
        <Text variant="caption" tone="muted">
          {location
            ? `Working on the focused ${BLOCK_LABEL[
                location.block.type
              ].toLowerCase()} block. Nothing is changed until you accept a preview.`
            : 'No block is focused, so new text goes to the end of the script. Nothing is changed until you accept a preview.'}
        </Text>
      </View>
      <ListItem
        title={AI_TITLE.continue}
        subtitle={location ? 'Write the next 3 to 5 blocks after this one' : 'Write the next 3 to 5 blocks at the end'}
        icon={PenLineIcon}
        iconColor="ai"
        onPress={() => onChoose('continue')}
      />
      <ListItem
        title={AI_TITLE.rewrite}
        subtitle={available.rewrite ? 'This block or the whole scene, with an optional instruction' : 'Focus a written block first'}
        icon={RepeatIcon}
        iconColor="ai"
        disabled={!available.rewrite}
        onPress={() => onChoose('rewrite')}
      />
      <ListItem
        title={AI_TITLE.voice}
        subtitle={available.voice ? `Make the line sound like ${speakerName || 'the character'}` : 'Dialogue with a character only'}
        icon={VoiceIcon}
        iconColor="ai"
        disabled={!available.voice}
        onPress={() => onChoose('voice')}
      />
      <ListItem
        title={AI_TITLE.shorten}
        subtitle={
          available.shorten
            ? length > LIMITS.longDialogue
              ? `${length} characters, too long for one bubble`
              : 'Make the line fit one speech bubble'
            : 'Dialogue only'
        }
        icon={CutIcon}
        iconColor="ai"
        disabled={!available.shorten}
        onPress={() => onChoose('shorten')}
      />
      <ListItem
        title={AI_TITLE.sfx}
        subtitle={available.sfx ? 'Three sound effects for this action' : 'Action blocks only'}
        icon={SfxIcon}
        iconColor="ai"
        disabled={!available.sfx}
        onPress={() => onChoose('sfx')}
      />
    </ScrollView>
  );
}

export function AiRewriteForm({
  blockHasText,
  sceneTooBig,
  scope,
  instruction,
  onScope,
  onInstruction,
  onSubmit,
}: {
  blockHasText: boolean;
  sceneTooBig: boolean;
  scope: RewriteScope;
  instruction: string;
  onScope: (scope: RewriteScope) => void;
  onInstruction: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4" keyboardShouldPersistTaps="handled">
        <FieldLabel>What to rewrite</FieldLabel>
        <ChipGroup>
          {blockHasText && <Chip label="This block" selected={scope === 'block'} onPress={() => onScope('block')} />}
          {!sceneTooBig && <Chip label="Whole scene" selected={scope === 'scene'} onPress={() => onScope('scene')} />}
        </ChipGroup>
        {sceneTooBig && (
          <Text variant="caption" tone="muted">
            This scene has more than {MAX_SCENE_REWRITE} blocks, so only the focused block is rewritten.
          </Text>
        )}
        <FieldLabel>Instruction (optional)</FieldLabel>
        <TextField
          value={instruction}
          onChangeText={onInstruction}
          onClear={() => onInstruction('')}
          placeholder="e.g. more tension, fewer words"
          accessibilityLabel="Instruction"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          maxLength={INSTRUCTION_MAX}
        />
        <ChipGroup>
          {QUICK_INSTRUCTIONS.map(label => (
            <Chip
              key={label}
              label={label}
              selected={instruction === label}
              onPress={() => onInstruction(instruction === label ? '' : label)}
            />
          ))}
        </ChipGroup>
      </ScrollView>
      <Footer>
        <Button title={scope === 'scene' ? 'Rewrite scene' : 'Rewrite block'} icon={AiIcon} variant="ai" onPress={onSubmit} />
      </Footer>
    </>
  );
}
