import { ScrollView, View } from 'react-native';
import { BubbleIcon, CheckIcon, DoneIcon, EffectIcon, MoreIcon, NoteIcon, RedoIcon, SfxIcon, UndoIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { BLOCK_LABEL } from '../../core/model/constants';
import type { Chapter, BubbleType } from '../../core/model/types';
import type { PageContext } from '../../render/drawPage';
import { usePageContext } from '../../render/PageView';
import { useChapter } from '../../state/hooks';
import type { ScreenProps } from '../../state/navigation';
import { AppBar, Banner, Chip, IconButton, Screen } from '../../ui';
import { ModeBar } from '../page/ModeBar';
import { setPagesDone } from '../page/pageActions';
import { LetteringSheets } from './LetteringSheets';
import { LetteringStage } from './LetteringStage';
import { useLetteringController } from './useLetteringController';

const ADD_BUTTONS: { type: BubbleType; label: string; icon: typeof BubbleIcon }[] = [
  { type: 'speak', label: BLOCK_LABEL.dialogue, icon: BubbleIcon },
  { type: 'narration', label: BLOCK_LABEL.narration, icon: NoteIcon },
  { type: 'sfx', label: BLOCK_LABEL.sfx, icon: SfxIcon },
];

function LetteringBody({ ctx, chapter, onBack }: { ctx: PageContext; chapter: Chapter; onBack: () => void }) {
  const c = useLetteringController({ ctx, chapter });
  const { state, dispatch, page, pageId } = c;
  const { pending } = state;
  return (
    <Screen padded={false} bottom={false}>
      <AppBar
        title={t('Page {n} / {total}', { n: chapter.pageIds.indexOf(pageId) + 1, total: chapter.pageIds.length })}
        onBack={onBack}
        right={
          <>
            <IconButton icon={UndoIcon} disabled={!c.canUndo} onPress={c.undo} accessibilityLabel={t('Undo')} />
            <IconButton icon={RedoIcon} disabled={!c.canRedo} onPress={c.redo} accessibilityLabel={t('Redo')} />
            <IconButton
              icon={page.done ? DoneIcon : CheckIcon}
              active={page.done}
              onPress={() => setPagesDone([pageId], !page.done)}
              accessibilityLabel={page.done ? t('Mark page as not done') : t('Mark page as done')}
            />
            <IconButton
              icon={MoreIcon}
              onPress={() => dispatch({ type: 'openSheet', sheet: 'menu' })}
              accessibilityLabel={t('Menu')}
            />
          </>
        }
      />
      {c.noArt && (
        <View className="px-2 pb-2">
          <Banner text={t('This page has no art yet. Bubble positions may need adjusting later.')} />
        </View>
      )}
      <LetteringStage c={c} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="grow-0"
        contentContainerClassName="grow items-center justify-around gap-2 px-2 py-2"
      >
        {ADD_BUTTONS.map(item => {
          const picked = pending?.kind === 'bubble' && pending.type === item.type;
          return (
            <Chip
              key={item.type}
              label={t(item.label)}
              icon={item.icon}
              selected={picked}
              onPress={() => dispatch({ type: 'pend', pending: picked ? null : { kind: 'bubble', type: item.type } })}
            />
          );
        })}
        <Chip
          label={t('Effects')}
          icon={EffectIcon}
          count={page.effects.length || undefined}
          selected={pending?.kind === 'effect'}
          onPress={() => dispatch({ type: 'openSheet', sheet: 'effects' })}
        />
      </ScrollView>
      <ModeBar pageId={pageId} mode="lettering" />
      <LetteringSheets c={c} />
    </Screen>
  );
}

export function LetteringScreen({ navigation, route }: ScreenProps<'Lettering'>) {
  const ctx = usePageContext(route.params.pageId);
  const chapter = useChapter(ctx?.page.chapterId);
  if (!ctx || !chapter) {
    return (
      <Screen>
        <AppBar title={t('Lettering')} onBack={() => navigation.goBack()} />
      </Screen>
    );
  }
  const onBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.replace('Storyboard', { chapterId: chapter.id });
  return <LetteringBody ctx={ctx} chapter={chapter} onBack={onBack} />;
}
