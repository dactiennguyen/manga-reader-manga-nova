import { View } from 'react-native';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleCheck,
  Copy,
  Eye,
  EyeOff,
  Languages,
  ListChecks,
  ListOrdered,
  MessageCircle,
  ScrollText,
  Trash2,
} from 'lucide-react-native';

import type { PageBlock } from '../../core/lettering/script';
import { bubbleText } from '../../core/lettering/translation';
import { BUBBLE_TYPE_LABEL, EFFECT_LABEL } from '../../core/model/constants';
import type { EffectType } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { Button, Chip, ChipRow, IconButton, ListItem, Menu, Pressable, Sheet, Text, TextField } from '../../ui';
import { CharacterPicker } from '../characters/CharacterPicker';
import { ManageLanguagesSheet, progressLabel } from './Languages';
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
      title={lang ? `Edit ${lang} text` : 'Edit text'}
      subtitle={lang ? 'Leave it empty to show the original' : undefined}
    >
      <View className="gap-3 p-4">
        {!!lang &&
          (state.originalOpen || noOriginal ? (
            <>
              <Text variant="caption" tone="secondary">
                Original
              </Text>
              <TextField
                autoFocus={noOriginal}
                multiline
                value={stored?.text ?? ''}
                placeholder={stored?.type === 'sfx' ? 'Original sound effect' : 'Original text'}
                onFocus={() => dispatch({ type: 'editOriginal' })}
                onChangeText={text => stored && c.changeBubble(stored.id, { text }, 'text')}
              />
              <Text variant="caption" tone="secondary">
                {lang}
              </Text>
            </>
          ) : (
            <Pressable
              accessibilityLabel="Edit the original text"
              onPress={() => dispatch({ type: 'editOriginal' })}
              className="gap-1 rounded-md bg-surface p-3"
            >
              <Text variant="caption" tone="secondary">
                Original · tap to edit
              </Text>
              <Text>{stored?.text}</Text>
            </Pressable>
          ))}
        <TextField
          key={lang ?? 'original'}
          autoFocus={!lang || !noOriginal}
          multiline
          value={lang ? stored?.translations?.[lang] ?? '' : stored?.text ?? ''}
          placeholder={lang && !noOriginal ? stored?.text : stored?.type === 'sfx' ? 'Sound effect' : 'Type the text'}
          onChangeText={text => stored && (lang ? c.changeTranslation(stored.id, text) : c.changeBubble(stored.id, { text }, 'text'))}
          inputClassName="min-h-24"
          textAlignVertical="top"
        />
        <Button title="Done" onPress={c.closeEditor} />
      </View>
    </Sheet>
  );
}

function EffectsSheet({ c }: { c: LetteringController }) {
  const { state, dispatch, page } = c;
  const close = () => dispatch({ type: 'closeSheet' });
  return (
    <Sheet visible={state.sheet === 'effects'} onClose={close} title="Effects">
      <View className="gap-2 p-4">
        <Text variant="caption" tone="secondary">
          Pick a type, then tap a panel
        </Text>
        <ChipRow>
          {EFFECT_TYPES.map(type => (
            <Chip
              key={type}
              label={EFFECT_LABEL[type]}
              onPress={() => dispatch({ type: 'pend', pending: { kind: 'effect', type } })}
            />
          ))}
        </ChipRow>
      </View>
      {page.effects.map(effect => (
        <ListItem
          key={effect.id}
          title={EFFECT_LABEL[effect.type]}
          subtitle={`Panel ${c.panelNumber(effect.panelId)}`}
          selected={state.selection?.id === effect.id}
          onPress={() => {
            dispatch({ type: 'select', selection: { kind: 'effect', id: effect.id } });
            close();
          }}
          right={
            <IconButton icon={Trash2} color="danger" onPress={() => c.removeEffect(effect.id)} accessibilityLabel="Delete effect" />
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
      title="Page dialogue list"
      subtitle={`${pageBlocks.length - unplaced.length} / ${pageBlocks.length} placed`}
    >
      {pageBlocks.length === 0 && (
        <Text tone="secondary" className="p-4 text-center">
          No script lines are linked to this page.
        </Text>
      )}
      {pageBlocks.map(item => (
        <ListItem
          key={item.block.id}
          title={item.block.text || '(empty)'}
          titleLines={2}
          subtitle={`Panel ${item.panelIndex + 1} · ${
            !item.placed ? 'Tap to place' : differs(item) ? 'Differs from script · Tap to update' : 'Placed'
          }`}
          icon={item.placed ? CircleCheck : MessageCircle}
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
      <DialogueListSheet c={c} />
      <Menu
        visible={state.sheet === 'menu'}
        onClose={close}
        items={[
          { label: 'Page dialogue list', icon: ListChecks, onPress: () => open('list') },
          {
            label: 'Language versions',
            subtitle: lang ? `Showing ${lang}` : 'Showing the original',
            icon: Languages,
            onPress: () => open(languages.length ? 'language' : 'manage'),
          },
          {
            label: state.showOrder ? 'Hide reading order' : 'Show reading order',
            icon: ListOrdered,
            onPress: () => dispatch({ type: 'toggleOrder' }),
          },
          {
            label: state.hideBubbles ? 'Show all bubbles' : 'Hide all bubbles',
            icon: state.hideBubbles ? Eye : EyeOff,
            onPress: () => dispatch({ type: 'toggleBubbles' }),
          },
          { label: 'View script', icon: ScrollText, onPress: () => navigation.navigate('Script', { chapterId: page.chapterId }) },
        ]}
      />
      <Menu
        visible={state.sheet === 'item' && !!item}
        onClose={close}
        title={item ? BUBBLE_TYPE_LABEL[item.type] : undefined}
        subtitle={item ? bubbleText(item, lang) || undefined : undefined}
        items={
          item
            ? [
                { label: 'Duplicate', icon: Copy, onPress: () => c.duplicate(item.id) },
                { label: 'Bring forward', icon: ArrowUp, onPress: () => c.reorder(item.id, 1) },
                { label: 'Send backward', icon: ArrowDown, onPress: () => c.reorder(item.id, -1) },
                { label: 'Delete', icon: Trash2, destructive: true, onPress: () => c.removeBubble(item.id) },
              ]
            : []
        }
      />
      <Menu
        visible={state.sheet === 'language'}
        onClose={close}
        title="Language"
        items={[
          { label: 'Original', icon: lang ? undefined : Check, onPress: () => setLang(null) },
          ...languages.map(name => ({
            label: name,
            subtitle: progressLabel(page.bubbles, name),
            icon: lang === name ? Check : undefined,
            onPress: () => setLang(name),
          })),
          ...(lang ? [{ label: 'Translation list', icon: ListChecks, onPress: () => open('translate') }] : []),
          { label: 'Manage languages…', icon: Languages, onPress: () => open('manage') },
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
        title="Speaker"
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
