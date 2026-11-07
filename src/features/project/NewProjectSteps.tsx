import { View } from 'react-native';
import { AiIcon, CheckIcon, RefreshIcon } from '../../ui/icons';

import { ART_STYLE_LABEL, LIMITS } from '../../core/model/constants';
import { FORMATS, type FormatKey } from '../../core/story/newProject';
import {
  AiErrorBox,
  AiLoading,
  AiNote,
  AiPanel,
  Button,
  Card,
  Chip,
  ChipGroup,
  FieldLabel,
  SwitchRow,
  Text,
  TextField,
} from '../../ui';
import { OptionCard } from '../onboarding/OptionCard';
import { StylePicker } from '../onboarding/StylePicker';
import type { NewProjectForm } from './useNewProject';

function StepTitle({ children }: { children: string }) {
  return (
    <Text variant="display" accessibilityRole="header">
      {children}
    </Text>
  );
}

export function StoryStep({ form }: { form: NewProjectForm }) {
  const { ai, aiSource, genres, idea, logline } = form;
  return (
    <>
      <StepTitle>Your story</StepTitle>
      {!!idea && (
        <Card className="p-3">
          <Text variant="bodySmall" tone="secondary">
            Idea: {idea}
          </Text>
        </Card>
      )}
      {form.aiFilled && <AiNote text="Suggested by AI — edit anything" />}
      <View className="gap-2">
        <FieldLabel>Story title</FieldLabel>
        <TextField
          value={form.title}
          onChangeText={form.editTitle}
          placeholder="E.g. The Magic Pen"
          accessibilityLabel="Story title"
          maxLength={LIMITS.projectTitle}
          autoFocus={!idea && !form.draft}
        />
        {form.duplicate && (
          <Text variant="caption" tone="muted">
            You already have a story with this title
          </Text>
        )}
      </View>
      <View className="gap-1">
        <FieldLabel>{`Genres (${genres.length}/${LIMITS.genresPerProject})`}</FieldLabel>
        <ChipGroup>
          {form.genreList.map(genre => (
            <Chip
              key={genre}
              label={genre}
              selected={genres.includes(genre)}
              onPress={() => form.toggleGenre(genre)}
            />
          ))}
        </ChipGroup>
      </View>
      <View className="gap-2">
        <FieldLabel>One-line summary</FieldLabel>
        <TextField
          value={logline}
          onChangeText={form.editLogline}
          placeholder="Who is it about, what do they want, what stands in the way?"
          accessibilityLabel="One-line summary"
          maxLength={LIMITS.logline}
          multiline
          textAlignVertical="top"
          inputClassName="min-h-[88px]"
        />
        <View className="flex-row items-center justify-between gap-2">
          <Button
            title="Suggest with AI"
            variant="ai"
            icon={AiIcon}
            small
            onPress={form.suggest}
            disabled={!aiSource || ai.status === 'loading'}
          />
          <Text variant="caption" tone="muted">
            {logline.length}/{LIMITS.logline}
          </Text>
        </View>
        {!aiSource && (
          <Text variant="caption" tone="muted">
            Type a title or a rough idea first, and AI can shape it into a pitch.
          </Text>
        )}
      </View>
      {ai.status === 'loading' && <AiLoading label="Writing a suggestion…" onCancel={form.cancelAi} />}
      {ai.status === 'error' && (
        <AiErrorBox
          message={ai.message}
          onRetry={ai.code === 'not-configured' ? undefined : form.suggest}
          onCancel={form.resetAi}
        />
      )}
      {ai.status === 'done' && (
        <AiPanel title="AI suggestion">
          <Text variant="heading">{ai.data.title}</Text>
          {ai.data.genres.length > 0 && (
            <Text variant="caption" tone="secondary">
              {ai.data.genres.join(' · ')}
            </Text>
          )}
          <Text>{ai.data.logline}</Text>
          <Text variant="caption" tone="secondary">
            Use replaces the title, genres and summary above. Nothing changes until you tap it.
          </Text>
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button title="Discard" variant="ghost" small onPress={form.resetAi} />
            <Button title="Try again" variant="secondary" icon={RefreshIcon} small onPress={form.suggest} />
            <Button title="Use" variant="ai" icon={CheckIcon} small onPress={() => form.acceptSuggestion(ai.data)} />
          </View>
        </AiPanel>
      )}
    </>
  );
}

function FormatArt({ kind }: { kind: FormatKey }) {
  const size = kind === 'webtoon' ? 'h-[76px] w-[30px]' : kind === 'manga-A5' ? 'h-[60px] w-[42px]' : 'h-[70px] w-[50px]';
  return (
    <View className="h-[76px] w-14 items-center justify-center">
      <View className={`gap-0.5 rounded-xs bg-overlay p-1 ${size}`}>
        <View className="flex-7 rounded-xs bg-control-border" />
        {kind === 'webtoon' ? (
          <>
            <View className="flex-5 rounded-xs bg-control-border" />
            <View className="flex-7 rounded-xs bg-control-border" />
          </>
        ) : (
          <View className="flex-5 flex-row gap-0.5">
            <View className="flex-1 rounded-xs bg-control-border" />
            <View className="flex-1 rounded-xs bg-control-border" />
          </View>
        )}
      </View>
    </View>
  );
}

export function FormatStep({ form }: { form: NewProjectForm }) {
  return (
    <>
      <StepTitle>Format</StepTitle>
      <View accessibilityRole="radiogroup" className="gap-3">
        {FORMATS.map(item => (
          <OptionCard
            key={item.key}
            label={item.label}
            hint={item.hint}
            selected={item.key === form.formatKey}
            onPress={() => form.setFormatKey(item.key)}
            left={<FormatArt kind={item.key} />}
          />
        ))}
      </View>
      <Text variant="caption" tone="muted">
        Note: the format cannot be changed after you draw the first page.
      </Text>
    </>
  );
}

export function StyleStep({ form }: { form: NewProjectForm }) {
  const { color, format, genres, logline, name, style } = form;
  return (
    <>
      <StepTitle>Art style</StepTitle>
      <StylePicker value={style} onChange={form.setStyle} />
      <Card>
        <SwitchRow
          title="Color story"
          subtitle="Turn off for classic black and white manga"
          value={color}
          onValueChange={form.setColor}
        />
      </Card>
      <Card className="gap-1 p-3">
        <Text variant="caption" tone="muted">
          Summary
        </Text>
        <Text variant="heading">{name}</Text>
        <Text tone="secondary">
          {[
            genres.join(', ') || 'No genre',
            format.label,
            ART_STYLE_LABEL[style],
            color ? 'Color story' : 'Black and white',
          ].join(' · ')}
        </Text>
        {!!logline.trim() && <Text>{logline.trim()}</Text>}
      </Card>
    </>
  );
}
