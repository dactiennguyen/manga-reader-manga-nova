import { ScrollView, View } from 'react-native';
import { AiIcon, CutIcon, PenLineIcon, RepeatIcon, SfxIcon, VoiceIcon } from '../../ui/icons';

import { msg, t } from '../../core/i18n';
import { BLOCK_LABEL, LIMITS } from '../../core/model/constants';
import { MAX_SCENE_REWRITE, type AiAction, type BlockLocation, type RewriteScope } from '../../core/script/aiDrafts';
import { Button, Chip, ChipGroup, FieldLabel, ListItem, Text, TextField } from '../../ui';
import { Footer } from './AiDraftViews';

export const AI_TITLE: Record<AiAction, string> = {
  continue: msg('Continue writing'),
  rewrite: msg('Rewrite'),
  voice: msg('Change voice'),
  shorten: msg('Shorten'),
  sfx: msg('SFX ideas'),
};

const QUICK_INSTRUCTIONS = [msg('more dramatic'), msg('funnier'), msg('shorter'), msg('clearer')];

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
            ? t('Working on the focused {type} block. Nothing is changed until you accept a preview.', {
                type: t(BLOCK_LABEL[location.block.type]).toLowerCase(),
              })
            : t('No block is focused, so new text goes to the end of the script. Nothing is changed until you accept a preview.')}
        </Text>
      </View>
      <ListItem
        title={t(AI_TITLE.continue)}
        subtitle={location ? t('Write the next 3 to 5 blocks after this one') : t('Write the next 3 to 5 blocks at the end')}
        icon={PenLineIcon}
        iconColor="ai"
        onPress={() => onChoose('continue')}
      />
      <ListItem
        title={t(AI_TITLE.rewrite)}
        subtitle={available.rewrite ? t('This block or the whole scene, with an optional instruction') : t('Focus a written block first')}
        icon={RepeatIcon}
        iconColor="ai"
        disabled={!available.rewrite}
        onPress={() => onChoose('rewrite')}
      />
      <ListItem
        title={t(AI_TITLE.voice)}
        subtitle={
          available.voice
            ? speakerName
              ? t('Make the line sound like {name}', { name: speakerName })
              : t('Make the line sound like the character')
            : t('Dialogue with a character only')
        }
        icon={VoiceIcon}
        iconColor="ai"
        disabled={!available.voice}
        onPress={() => onChoose('voice')}
      />
      <ListItem
        title={t(AI_TITLE.shorten)}
        subtitle={
          available.shorten
            ? length > LIMITS.longDialogue
              ? t('{count} characters, too long for one bubble', { count: length })
              : t('Make the line fit one speech bubble')
            : t('Dialogue only')
        }
        icon={CutIcon}
        iconColor="ai"
        disabled={!available.shorten}
        onPress={() => onChoose('shorten')}
      />
      <ListItem
        title={t(AI_TITLE.sfx)}
        subtitle={available.sfx ? t('Three sound effects for this action') : t('Action blocks only')}
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
        <FieldLabel>{t('What to rewrite')}</FieldLabel>
        <ChipGroup>
          {blockHasText && <Chip label={t('This block')} selected={scope === 'block'} onPress={() => onScope('block')} />}
          {!sceneTooBig && <Chip label={t('Whole scene')} selected={scope === 'scene'} onPress={() => onScope('scene')} />}
        </ChipGroup>
        {sceneTooBig && (
          <Text variant="caption" tone="muted">
            {t('This scene has more than {max} blocks, so only the focused block is rewritten.', { max: MAX_SCENE_REWRITE })}
          </Text>
        )}
        <FieldLabel>{t('Instruction (optional)')}</FieldLabel>
        <TextField
          value={instruction}
          onChangeText={onInstruction}
          onClear={() => onInstruction('')}
          placeholder={t('e.g. more tension, fewer words')}
          accessibilityLabel={t('Instruction')}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          maxLength={INSTRUCTION_MAX}
        />
        <ChipGroup>
          {QUICK_INSTRUCTIONS.map(label => (
            <Chip
              key={label}
              label={t(label)}
              selected={instruction === label}
              onPress={() => onInstruction(instruction === label ? '' : label)}
            />
          ))}
        </ChipGroup>
      </ScrollView>
      <Footer>
        <Button title={scope === 'scene' ? t('Rewrite scene') : t('Rewrite block')} icon={AiIcon} variant="ai" onPress={onSubmit} />
      </Footer>
    </>
  );
}
