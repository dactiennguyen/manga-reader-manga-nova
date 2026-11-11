import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, DeleteIcon, DoneIcon, MoreIcon, PlusIcon, PreviewIcon, ScriptIcon, ShareIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { isRtl, pageSize } from '../../core/layout/layout';
import { chapterLabel, scriptOutdated } from '../../core/model/selectors';
import type { ID, Page, Scene } from '../../core/model/types';
import { useChapter, useLastOpened, useProjectOfChapter } from '../../state/hooks';
import type { ScreenProps } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { AppBar, Banner, Button, Fab, IconButton, ProgressBar, Screen, Text } from '../../ui';
import { setPagesDone } from '../page/pageActions';
import { AutoPaginateSheet } from './AutoPaginateSheet';
import { StoryboardGrid } from './StoryboardGrid';
import { StoryboardList } from './StoryboardList';
import { StoryboardMenus } from './StoryboardMenus';
import { useStoryboardActions } from './useStoryboardActions';

const FAB_GAP = 16;

export function StoryboardScreen({ navigation, route }: ScreenProps<'Storyboard'>) {
  const { chapterId } = route.params;
  const insets = useSafeAreaInsets();
  const chapter = useChapter(chapterId);
  const project = useProjectOfChapter(chapterId);
  const allPages = useStory(s => s.pages);
  const allScenes = useStory(s => s.scenes);
  const label = useStory(s => chapterLabel(s, chapterId));
  const [listView, setListView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useLastOpened(project?.id, { screen: 'Storyboard', chapterId });

  const pages = useMemo(
    () => (chapter?.pageIds ?? []).map(id => allPages[id]).filter((page): page is Page => !!page),
    [chapter, allPages],
  );
  const scenes = useMemo(
    () => (chapter?.sceneIds ?? []).map(id => allScenes[id]).filter((scene): scene is Scene => !!scene),
    [chapter, allScenes],
  );
  const usedBlockIds = useMemo(() => {
    const used = new Set<ID>();
    for (const page of pages) {
      for (const panel of Object.values(page.panels)) {
        panel.blockIds.forEach(id => used.add(id));
      }
    }
    return used;
  }, [pages]);
  const pageIds = useMemo(() => pages.map(page => page.id), [pages]);
  const pageSizes = useMemo(() => (project ? pages.map(page => pageSize(project, page)) : []), [pages, project]);
  const actions = useStoryboardActions({ chapterId, project, pages: allPages, pageIds });
  const { selection, setSelection, setPaginating } = actions;

  if (!chapter || !project) {
    return (
      <Screen>
        <AppBar title={t('Storyboard')} onBack={() => navigation.goBack()} />
      </Screen>
    );
  }

  const hasScript = scenes.some(scene => scene.blocks.some(block => block.text.trim()));
  const hasUnassigned = scenes.some(scene => scene.blocks.some(block => block.text.trim() && !usedBlockIds.has(block.id)));
  const webtoon = project.format === 'webtoon';
  const rtl = isRtl(project);
  const doneCount = pages.filter(page => page.done).length;
  const flagCount = pages.filter(page => page.flag).length;
  const shared = {
    pageSizes,
    webtoon,
    rtl,
    selection,
    onPressPage: actions.pressPage,
    onLongPressPage: actions.longPressPage,
  };

  return (
    <Screen padded={false} bottom={false}>
      <AppBar
        title={t('Storyboard')}
        subtitle={label}
        onBack={() => navigation.goBack()}
        right={
          selection ? (
            <IconButton icon={CloseIcon} onPress={() => setSelection(null)} accessibilityLabel={t('Cancel selection')} />
          ) : (
            <>
              <IconButton
                icon={PreviewIcon}
                disabled={pages.length === 0}
                onPress={() => navigation.navigate('Preview', { projectId: project.id, chapterId })}
                accessibilityLabel={t('Preview')}
              />
              <IconButton
                icon={ShareIcon}
                disabled={pages.length === 0}
                onPress={() => navigation.navigate('Export', { projectId: project.id, chapterId })}
                accessibilityLabel={t('Export')}
              />
              <IconButton icon={MoreIcon} onPress={() => setMenuOpen(true)} accessibilityLabel={t('More')} />
            </>
          )
        }
      />
      {scriptOutdated(chapter) && (
        <View className="px-4 md:px-6">
          <Banner
            text={t('The script changed after pagination.')}
            action={{ label: t('View script'), onPress: () => navigation.navigate('Script', { chapterId }) }}
          />
        </View>
      )}
      {pages.length > 0 && (
        <View className="gap-1 px-4 pt-3 md:px-6">
          <Text variant="caption" tone="secondary">
            {selection
              ? t('{count} selected', { count: selection.length })
              : `${tn(pages.length, '{count} page · {done} done · {flagged} flagged', '{count} pages · {done} done · {flagged} flagged', {
                  done: doneCount,
                  flagged: flagCount,
                })}   ${webtoon ? t('↓ vertical scroll') : t('← reading direction')}`}
          </Text>
          <ProgressBar value={doneCount / pages.length} />
        </View>
      )}
      {pages.length > 0 && hasUnassigned && !selection && (
        <View className="items-start px-4 pt-3 md:px-6">
          <Button
            title={t('Auto-paginate from script')}
            variant="secondary"
            icon={ScriptIcon}
            small
            onPress={() => setPaginating(true)}
          />
        </View>
      )}
      {pages.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text tone="secondary" className="text-center">
            {hasScript
              ? t('This chapter has a script. Paginate from it, or add a blank page.')
              : t('Write the script first, or start drawing right away.')}
          </Text>
          {hasScript ? (
            <Button title={t('Auto-paginate from script')} icon={ScriptIcon} onPress={() => setPaginating(true)} />
          ) : (
            <Button title={t('Write script')} icon={ScriptIcon} onPress={() => navigation.navigate('Script', { chapterId })} />
          )}
          <Button title={t('Add blank page')} variant="secondary" icon={PlusIcon} onPress={() => actions.addPage()} />
        </View>
      ) : listView ? (
        <StoryboardList pages={pages} {...shared} />
      ) : (
        <StoryboardGrid
          pageIds={pageIds}
          {...shared}
          onMove={(from, to) => useStory.getState().movePage(chapterId, from, to)}
        />
      )}
      {selection ? (
        <View className="flex-row gap-3 bg-raised px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Button
            title={t('Delete')}
            variant="danger"
            icon={DeleteIcon}
            disabled={selection.length === 0}
            onPress={() => actions.removePages(selection)}
            className="flex-1"
          />
          <Button
            title={t('Mark done')}
            variant="secondary"
            icon={DoneIcon}
            disabled={selection.length === 0}
            onPress={() => {
              setPagesDone(selection, true);
              setSelection(null);
            }}
            className="flex-1"
          />
        </View>
      ) : (
        pages.length > 0 && <Fab icon={PlusIcon} label={t('Page')} onPress={() => actions.addPage()} bottom={insets.bottom + FAB_GAP} />
      )}
      <StoryboardMenus
        chapter={chapter}
        pages={allPages}
        actions={actions}
        webtoon={webtoon}
        rtl={rtl}
        listView={listView}
        menuOpen={menuOpen}
        onCloseMenu={() => setMenuOpen(false)}
        onToggleList={() => setListView(view => !view)}
      />
      <AutoPaginateSheet
        visible={actions.paginating}
        scenes={scenes}
        skipBlockIds={usedBlockIds}
        firstPageNumber={pages.length + 1}
        onClose={() => setPaginating(false)}
        onApply={actions.applyPlans}
      />
    </Screen>
  );
}
