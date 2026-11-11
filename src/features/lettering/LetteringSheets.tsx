import { View } from 'react-native';
import { ArrowDownIcon, ArrowUpIcon, BubbleIcon, CheckIcon, ChecklistIcon, CopyIcon, DeleteIcon, DoneIcon, HiddenIcon, OrderIcon, PreviewIcon, ScriptIcon, TranslateIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import type { PageBlock } from '../../core/lettering/script';
import { bubbleText } from '../../core/lettering/translation';
import { BUBBLE_TYPE_LABEL, EFFECT_LABEL } from '../../core/model/constants';
import type { EffectType } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { Button, Chip, ChipRow, IconButton, ListItem, Menu, Pressable, Sheet, Text, TextField } from '../../ui';
import { CharacterPicker } from '../characters/CharacterPicker';
import { ManageLanguagesSheet, progressLabel } from './Languages';
import { PresetSheet } from './PresetSheet';
import { TranslationSheet } from './TranslationSheet';
import type { LetteringController } from './useLetteringController';

const EFFECT_TYPES = Object.keys(EFFECT_LABEL) as EffectType[];

function EditorSheet({ c }: { c: LetteringController }) {
  const { state, dispatch, stored, lang } = c;
  const noOriginal = !stored?.text.trim();
  return (
    <Sheet
      visible={state.sheet === 'editor' && !!stored}
      onClose={c.closeEditor}
      title={lang ? t('Edit {lang} text', { lang }) : t('Edit text')}
      subtitle={lang ? t('Leave it empty to show the original') : undefined}
    >
      <View className="gap-3 p-4">
        {!!lang &&
          (state.originalOpen || noOriginal ? (
            <>
              <Text variant="caption" tone="secondary">
                {t('Original')}
              </Text>
              <TextField
                autoFocus={noOriginal}
                multiline
                value={stored?.text ?? ''}
                placeholder={stored?.type === 'sfx' ? t('Original sound effect') : t('Original text')}
                onFocus={() => dispatch({ type: 'editOriginal' })}
                onChangeText={text => stored && c.changeBubble(stored.id, { text }, 'text')}
              />
              <Text variant="caption" tone="secondary">
                {lang}
              </Text>
            </>
          ) : (
            <Pressable
              accessibilityLabel={t('Edit the original text')}
              onPress={() => dispatch({ type: 'editOriginal' })}
              className="gap-1 rounded-md bg-surface p-3"
            >
              <Text variant="caption" tone="secondary">
                {t('Original · tap to edit')}
              </Text>
              <Text>{stored?.text}</Text>
            </Pressable>
          ))}
        <TextField
          key={lang ?? 'original'}
          autoFocus={!lang || !noOriginal}
          multiline
          value={lang ? stored?.translations?.[lang] ?? '' : stored?.text ?? ''}
          placeholder={lang && !noOriginal ? stored?.text : stored?.type === 'sfx' ? t('Sound effect') : t('Type the text')}
          onChangeText={text => stored && (lang ? c.changeTranslation(stored.id, text) : c.changeBubble(stored.id, { text }, 'text'))}
          inputClassName="min-h-24"
          textAlignVertical="top"
        />
        <Button title={t('Done')} onPress={c.closeEditor} />
      </View>
    </Sheet>
  );
}

function EffectsSheet({ c }: { c: LetteringController }) {
  const { state, dispatch, page } = c;
  const close = () => dispatch({ type: 'closeSheet' });
  return (
    <Sheet visible={state.sheet === 'effects'} onClose={close} title={t('Effects')}>
      <View className="gap-2 p-4">
        <Text variant="caption" tone="secondary">
          {t('Pick a type, then tap a panel')}
        </Text>
        <ChipRow>
          {EFFECT_TYPES.map(type => (
            <Chip
              key={type}
              label={t(EFFECT_LABEL[type])}
              onPress={() => dispatch({ type: 'pend', pending: { kind: 'effect', type } })}
            />
          ))}
        </ChipRow>
      </View>
      {page.effects.map(effect => (
        <ListItem
          key={effect.id}
          title={t(EFFECT_LABEL[effect.type])}
          subtitle={t('Panel {n}', { n: c.panelNumber(effect.panelId) })}
          selected={state.selection?.id === effect.id}
          onPress={() => {
            dispatch({ type: 'select', selection: { kind: 'effect', id: effect.id } });
            close();
          }}
          right={
            <IconButton icon={DeleteIcon} color="danger" onPress={() => c.removeEffect(effect.id)} accessibilityLabel={t('Delete effect')} />
          }
        />
      ))}
    </Sheet>
  );
}

function DialogueListSheet({ c }: { c: LetteringController }) {
  const { state, dispatch, pageBlocks, unplaced, page } = c;
  const existing = (item: PageBlock) => page.bubbles.find(bubble => bubble.blockId === item.block.id);
  const differs = (item: PageBlock) => {
    const bubble = existing(item);
    return !!bubble && bubble.text.trim() !== item.block.text.trim();
  };
  const press = (item: PageBlock) => {
    const bubble = existing(item);
    if (bubble && differs(item)) {
      c.changeBubble(bubble.id, { text: item.block.text.trim() });
    } else if (bubble) {
      dispatch({ type: 'select', selection: { kind: 'bubble', id: bubble.id } });
      dispatch({ type: 'closeSheet' });
    } else {
      c.placeFromList(item);
    }
  };
  return (
    <Sheet
      visible={state.sheet === 'list'}
      onClose={() => dispatch({ type: 'closeSheet' })}
      title={t('Page dialogue list')}
      subtitle={t('{placed} / {total} placed', { placed: pageBlocks.length - unplaced.length, total: pageBlocks.length })}
    >
      {pageBlocks.length === 0 && (
        <Text tone="secondary" className="p-4 text-center">
          {t('No script lines are linked to this page.')}
        </Text>
      )}
      {pageBlocks.map(item => (
        <ListItem
          key={item.block.id}
          title={item.block.text || t('(empty)')}
          titleLines={2}
          subtitle={
            !item.placed
              ? t('Panel {n} · Tap to place', { n: item.panelIndex + 1 })
              : differs(item)
                ? t('Panel {n} · Differs from script · Tap to update', { n: item.panelIndex + 1 })
                : t('Panel {n} · Placed', { n: item.panelIndex + 1 })
          }
          icon={item.placed ? DoneIcon : BubbleIcon}
          iconColor={item.placed ? 'success' : 'text-secondary'}
          onPress={() => press(item)}
        />
      ))}
    </Sheet>
  );
}

export function LetteringSheets({ c }: { c: LetteringController }) {
  const navigation = useAppNavigation();
  const { state, dispatch, page, project, chapter, pageId, lang, setLang, stored } = c;
  const close = () => dispatch({ type: 'closeSheet' });
  const open = (sheet: 'list' | 'language' | 'manage' | 'translate') => dispatch({ type: 'openSheet', sheet });
  const languages = project.languages ?? [];
  const item = page.bubbles.find(bubble => bubble.id === state.itemId);
  return (
    <>
      <EditorSheet c={c} />
      <EffectsSheet c={c} />
      <PresetSheet c={c} />
      <DialogueListSheet c={c} />
      <Menu
        visible={state.sheet === 'menu'}
        onClose={close}
        items={[
          { label: t('Page dialogue list'), icon: ChecklistIcon, onPress: () => open('list') },
          {
            label: t('Language versions'),
            subtitle: lang ? t('Showing {lang}', { lang }) : t('Showing the original'),
            icon: TranslateIcon,
            onPress: () => open(languages.length ? 'language' : 'manage'),
          },
          {
            label: state.showOrder ? t('Hide reading order') : t('Show reading order'),
            icon: OrderIcon,
            onPress: () => dispatch({ type: 'toggleOrder' }),
          },
          {
            label: state.hideBubbles ? t('Show all bubbles') : t('Hide all bubbles'),
            icon: state.hideBubbles ? PreviewIcon : HiddenIcon,
            onPress: () => dispatch({ type: 'toggleBubbles' }),
          },
          { label: t('View script'), icon: ScriptIcon, onPress: () => navigation.navigate('Script', { chapterId: page.chapterId }) },
        ]}
      />
      <Menu
        visible={state.sheet === 'item' && !!item}
        onClose={close}
        title={item ? t(BUBBLE_TYPE_LABEL[item.type]) : undefined}
        subtitle={item ? bubbleText(item, lang) || undefined : undefined}
        items={
          item
            ? [
                { label: t('Duplicate'), icon: CopyIcon, onPress: () => c.duplicate(item.id) },
                { label: t('Bring forward'), icon: ArrowUpIcon, onPress: () => c.reorder(item.id, 1) },
                { label: t('Send backward'), icon: ArrowDownIcon, onPress: () => c.reorder(item.id, -1) },
                { label: t('Delete'), icon: DeleteIcon, destructive: true, onPress: () => c.removeBubble(item.id) },
              ]
            : []
        }
      />
      <Menu
        visible={state.sheet === 'language'}
        onClose={close}
        title={t('Language')}
        items={[
          { label: t('Original'), icon: lang ? undefined : CheckIcon, onPress: () => setLang(null) },
          ...languages.map(name => ({
            label: name,
            subtitle: progressLabel(page.bubbles, name),
            icon: lang === name ? CheckIcon : undefined,
            onPress: () => setLang(name),
          })),
          ...(lang ? [{ label: t('Translation list'), icon: ChecklistIcon, onPress: () => open('translate') }] : []),
          { label: t('Manage languages…'), icon: TranslateIcon, onPress: () => open('manage') },
        ]}
      />
      <ManageLanguagesSheet
        visible={state.sheet === 'manage'}
        onClose={close}
        project={project}
        onAdded={setLang}
        onRenamed={(from, to) => lang === from && setLang(to)}
      />
      {!!lang && (
        <TranslationSheet
          visible={state.sheet === 'translate'}
          onClose={close}
          lang={lang}
          project={project}
          chapter={chapter}
          pageId={pageId}
          onChangeCurrent={c.changeTranslation}
          onApplyCurrent={c.applyTranslations}
        />
      )}
      <CharacterPicker
        visible={state.sheet === 'speaker'}
        onClose={close}
        projectId={project.id}
        title={t('Speaker')}
        allowClear
        selectedIds={stored?.characterId ? [stored.characterId] : []}
        onPick={characterId => {
          if (stored) {
            c.changeBubble(stored.id, { characterId });
          }
        }}
      />
    </>
  );
}
