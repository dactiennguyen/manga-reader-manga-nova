import { View } from 'react-native';
import { AiIcon, CheckIcon, RefreshIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { ART_STYLE_LABEL, LIMITS } from '../../core/model/constants';
import { FORMATS, type FormatKey } from '../../core/story/newProject';
import { STARTERS, starterOf } from '../../core/story/starters';
import {
  AiErrorBox,
  AiLoading,
  AiNote,
  AiPanel,
  Button,
  Card,
  Chip,
  ChipGroup,
  ChipRow,
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
      <StepTitle>{t('Your story')}</StepTitle>
      {!!idea && (
        <Card className="p-3">
          <Text variant="bodySmall" tone="secondary">
            {t('Idea: {idea}', { idea })}
          </Text>
        </Card>
      )}
      {form.aiFilled && <AiNote text={t('Suggested by AI — edit anything')} />}
      <View className="gap-2">
        <FieldLabel>{t('Story title')}</FieldLabel>
        <TextField
          value={form.title}
          onChangeText={form.editTitle}
          placeholder={t('E.g. The Magic Pen')}
          accessibilityLabel={t('Story title')}
          maxLength={LIMITS.projectTitle}
          autoFocus={!idea && !form.draft}
        />
        {form.duplicate && (
          <Text variant="caption" tone="muted">
            {t('You already have a story with this title')}
          </Text>
        )}
      </View>
      <View className="gap-1">
        <FieldLabel>{t('Genres ({count}/{max})', { count: genres.length, max: LIMITS.genresPerProject })}</FieldLabel>
        <ChipGroup>
          {form.genreList.map(genre => (
            <Chip
              key={genre}
              label={t(genre)}
              selected={genres.includes(genre)}
              onPress={() => form.toggleGenre(genre)}
            />
          ))}
        </ChipGroup>
      </View>
      <View className="gap-2">
        <FieldLabel>{t('One-line summary')}</FieldLabel>
        <TextField
          value={logline}
          onChangeText={form.editLogline}
          placeholder={t('Who is it about, what do they want, what stands in the way?')}
          accessibilityLabel={t('One-line summary')}
          maxLength={LIMITS.logline}
          multiline
          textAlignVertical="top"
          inputClassName="min-h-[88px]"
        />
        <View className="flex-row items-center justify-between gap-2">
          <Button
            title={t('Suggest with AI')}
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
            {t('Type a title or a rough idea first, and AI can shape it into a pitch.')}
          </Text>
        )}
      </View>
      {ai.status === 'loading' && <AiLoading label={t('Writing a suggestion…')} onCancel={form.cancelAi} />}
      {ai.status === 'error' && (
        <AiErrorBox
          message={ai.message}
          onRetry={ai.code === 'not-configured' ? undefined : form.suggest}
          onCancel={form.resetAi}
        />
      )}
      {ai.status === 'done' && (
        <AiPanel title={t('AI suggestion')}>
          <Text variant="heading">{ai.data.title}</Text>
          {ai.data.genres.length > 0 && (
            <Text variant="caption" tone="secondary">
              {ai.data.genres.map(genre => t(genre)).join(' · ')}
            </Text>
          )}
          <Text>{ai.data.logline}</Text>
          <Text variant="caption" tone="secondary">
            {t('Use replaces the title, genres and summary above. Nothing changes until you tap it.')}
          </Text>
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button title={t('Discard')} variant="ghost" small onPress={form.resetAi} />
            <Button title={t('Try again')} variant="secondary" icon={RefreshIcon} small onPress={form.suggest} />
            <Button title={t('Use')} variant="ai" icon={CheckIcon} small onPress={() => form.acceptSuggestion(ai.data)} />
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
      <StepTitle>{t('Format')}</StepTitle>
      <View accessibilityRole="radiogroup" className="gap-3">
        {FORMATS.map(item => (
          <OptionCard
            key={item.key}
            label={t(item.label)}
            hint={t(item.hint)}
            selected={item.key === form.formatKey}
            onPress={() => form.setFormatKey(item.key)}
            left={<FormatArt kind={item.key} />}
          />
        ))}
      </View>
      <Text variant="caption" tone="muted">
        {t('Note: the format cannot be changed after you draw the first page.')}
      </Text>
      <StepTitle>{t('Start with')}</StepTitle>
      <Card className="gap-2 p-3">
        <ChipRow>
          {STARTERS.map(item => (
            <Chip
              key={item.key}
              label={t(item.label)}
              selected={item.key === form.starterKey}
              onPress={() => form.pickStarter(item.key)}
            />
          ))}
        </ChipRow>
        <Text variant="caption" tone="secondary">
          {t(starterOf(form.starterKey).hint)}
        </Text>
      </Card>
    </>
  );
}

export function StyleStep({ form }: { form: NewProjectForm }) {
  const { color, format, genres, logline, name, style } = form;
  return (
    <>
      <StepTitle>{t('Art style')}</StepTitle>
      <StylePicker value={style} onChange={form.setStyle} />
      <Card>
        <SwitchRow
          title={t('Color story')}
          subtitle={t('Turn off for classic black and white manga')}
          value={color}
          onValueChange={form.setColor}
        />
      </Card>
      <Card className="gap-1 p-3">
        <Text variant="caption" tone="muted">
          {t('Summary')}
        </Text>
        <Text variant="heading">{name}</Text>
        <Text tone="secondary">
          {[
            genres.map(genre => t(genre)).join(', ') || t('No genre'),
            t(format.label),
            t(ART_STYLE_LABEL[style]),
            color ? t('Color story') : t('Black and white'),
          ].join(' · ')}
        </Text>
        {!!logline.trim() && <Text>{logline.trim()}</Text>}
      </Card>
    </>
  );
}
