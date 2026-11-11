import { useRef, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import { ExportIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { AppBar, Button, EmptyState, Screen, SectionHeader, Text } from '../../ui';
import { ChapterPicker, FormatPicker, LanguagePicker, OptionsForm } from './ExportForm';
import { HistoryList, ThumbStrip } from './ExportParts';
import { ExportStatus } from './ExportStatus';
import { useExportScreen } from './useExportScreen';

export function ExportScreen() {
  const navigation = useAppNavigation();
  const { projectId, chapterId } = useAppRoute<'Export'>().params;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const revealResult = useRef(false);
  const screen = useExportScreen(projectId, chapterId, () => {
    revealResult.current = true;
  });
  const { project, phase, pageIds, unfinished, totalPages } = screen;
  const running = phase.kind === 'running';

  if (!project || screen.selectable.length === 0) {
    return (
      <Screen padded={false}>
        <AppBar title={t('Export')} subtitle={project?.title} onBack={navigation.goBack} />
        <View className="flex-1 justify-center">
          <EmptyState
            title={project ? t('Nothing to export yet. Build a storyboard first.') : t('This story no longer exists.')}
            action={{
              label: project ? t('Go to story') : t('Go back'),
              onPress: () => (project ? navigation.navigate('Project', { projectId }) : navigation.goBack()),
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} keyboard>
      <AppBar title={t('Export')} subtitle={project.title} onBack={navigation.goBack} />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="gap-4 px-4 py-4 md:px-6"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (revealResult.current) {
            revealResult.current = false;
            scrollRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        <ChapterPicker
          chapters={screen.chapters}
          chapterPages={screen.chapterPages}
          pages={screen.pages}
          selectable={screen.selectable}
          selected={screen.selected}
          allSelected={screen.allSelected}
          onToggle={screen.toggle}
          onSelectAll={on => screen.setSelected(on ? screen.selectable : [])}
        />

        <FormatPicker format={screen.form.format} onChange={format => screen.patch({ format })} />

        {screen.languages.length > 0 && (
          <LanguagePicker
            languages={screen.languages}
            lang={screen.options.lang}
            translated={screen.translated}
            onChange={lang => screen.patch({ lang })}
          />
        )}

        <OptionsForm project={project} form={screen.form} withInfo={screen.options.info} onChange={screen.patch} />

        <View className="gap-2">
          <SectionHeader>{t('Preview')}</SectionHeader>
          <ThumbStrip pageIds={pageIds} />
          <Text variant="caption" tone="secondary">
            {pageIds.length === 0
              ? t('Pick at least one chapter')
              : `${tn(totalPages, '{count} page', '{count} pages')}${
                  unfinished ? ` · ${t('{n} not done', { n: unfinished })}` : ''
                }`}
          </Text>
        </View>

        <ExportStatus
          phase={phase}
          onCancel={screen.cancel}
          onRetry={screen.start}
          onShare={screen.share}
          onSave={screen.save}
        />

        {screen.history.length > 0 && (
          <View className="gap-2">
            <SectionHeader>{t('Recent exports')}</SectionHeader>
            <HistoryList
              items={screen.history}
              missing={screen.missing}
              onPress={screen.share}
              onDelete={screen.remove}
            />
          </View>
        )}
      </ScrollView>
      <View className="bg-bg p-4">
        <Button
          title={running ? t('Exporting…') : t('Export file')}
          icon={ExportIcon}
          loading={running}
          disabled={running || pageIds.length === 0}
          onPress={screen.start}
        />
      </View>
    </Screen>
  );
}
