import { View } from 'react-native';
import { ArchiveIcon, DocumentIcon, ImagesIcon, LongImageIcon, PanelFrameIcon } from '../../ui/icons';

import type { ExportFormat, ExportOptions, ExportQuality, LongWidth, SocialShape } from '../../core/export/plan';
import { msg, t, tn } from '../../core/i18n';
import { chapterLabel } from '../../core/model/selectors';
import type { Chapter, ID, Page, Project } from '../../core/model/types';
import { useStory } from '../../state/useStory';
import {
  Card,
  Checkbox,
  Chip,
  ChipRow,
  Section,
  SectionHeader,
  Segmented,
  SwitchRow,
  Text,
  TextField,
  type IconGlyph,
} from '../../ui';
import { FORMAT_LABEL, FormatCard, OptionRow } from './ExportParts';

const FORMATS: { value: ExportFormat; icon: IconGlyph; description: string }[] = [
  { value: 'png', icon: ImagesIcon, description: msg('One image per page, packed in a ZIP.') },
  { value: 'pdf', icon: DocumentIcon, description: msg('For printing or sending to beta readers.') },
  { value: 'cbz', icon: ArchiveIcon, description: msg('Opens in comic reader apps.') },
  { value: 'long', icon: LongImageIcon, description: msg('Stitches pages into a vertical strip for webtoon platforms.') },
  { value: 'social', icon: PanelFrameIcon, description: msg('One image per panel, framed for a feed or a story.') },
];

export function ChapterPicker({
  chapters,
  chapterPages,
  pages,
  selectable,
  selected,
  allSelected,
  onToggle,
  onSelectAll,
}: {
  chapters: Chapter[];
  chapterPages: Record<ID, ID[]>;
  pages: Record<ID, Page>;
  selectable: ID[];
  selected: ID[];
  allSelected: boolean;
  onToggle: (id: ID, on: boolean) => void;
  onSelectAll: (on: boolean) => void;
}) {
  const state = useStory.getState();
  return (
    <Section title={t('Chapters')}>
      <View className="px-4 py-1">
        {selectable.length > 1 && <Checkbox checked={allSelected} onChange={onSelectAll} label={t('Select all')} />}
        {chapters.map(chapter => {
          const ids = chapterPages[chapter.id];
          const notDone = ids.filter(id => !pages[id].done).length;
          if (ids.length === 0) {
            return (
              <View key={chapter.id} className="py-1">
                <Text tone="muted">{chapterLabel(state, chapter.id)}</Text>
                <Text variant="caption" tone="muted">
                  {t('No pages')}
                </Text>
              </View>
            );
          }
          return (
            <View key={chapter.id}>
              <Checkbox
                checked={selected.includes(chapter.id)}
                onChange={on => onToggle(chapter.id, on)}
                label={chapterLabel(state, chapter.id)}
              />
              <Text variant="caption" tone={notDone ? 'warning' : 'secondary'} className="ml-9">
                {tn(ids.length, '{count} page', '{count} pages')}
                {notDone ? ` · ${t('{n} not done', { n: notDone })}` : ''}
              </Text>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

export function FormatPicker({ format, onChange }: { format: ExportFormat; onChange: (format: ExportFormat) => void }) {
  return (
    <View className="gap-2">
      <SectionHeader>{t('Format')}</SectionHeader>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-3">
        {FORMATS.map(item => (
          <FormatCard
            key={item.value}
            icon={item.icon}
            title={t(FORMAT_LABEL[item.value])}
            description={t(item.description)}
            selected={format === item.value}
            onPress={() => onChange(item.value)}
          />
        ))}
      </View>
    </View>
  );
}

export function LanguagePicker({
  languages,
  lang,
  translated,
  onChange,
}: {
  languages: string[];
  lang: string | null | undefined;
  translated: { done: number; total: number } | null;
  onChange: (lang: string | null) => void;
}) {
  return (
    <View className="gap-2">
      <SectionHeader>{t('Language')}</SectionHeader>
      <Card className="gap-2 p-3">
        <ChipRow>
          <Chip label={t('Original')} selected={!lang} onPress={() => onChange(null)} />
          {languages.map(name => (
            <Chip key={name} label={name} selected={lang === name} onPress={() => onChange(name)} />
          ))}
        </ChipRow>
        <Text variant="caption" tone="secondary">
          {translated
            ? translated.done < translated.total
              ? t('{done} of {total} bubbles translated. The rest are exported with the original text.', {
                  done: translated.done,
                  total: translated.total,
                })
              : t('All {total} bubbles are translated.', { total: translated.total })
            : t('Bubbles are exported with the original text.')}
        </Text>
      </Card>
    </View>
  );
}

export function OptionsForm({
  project,
  form,
  withInfo,
  onChange,
}: {
  project: Project;
  form: ExportOptions;
  withInfo: boolean;
  onChange: (patch: Partial<ExportOptions>) => void;
}) {
  if (form.format === 'long') {
    return (
      <Section title={t('Options')}>
        <OptionRow label={t('Width')}>
          <Segmented<LongWidth>
            options={[
              { value: 800, label: '800 px' },
              { value: 1080, label: '1080 px' },
            ]}
            value={form.longWidth}
            onChange={longWidth => onChange({ longWidth })}
          />
        </OptionRow>
        <OptionRow label={t('Page gap')}>
          <Segmented
            options={[
              { value: 0, label: t('None') },
              { value: 24, label: t('Small') },
              { value: 64, label: t('Large') },
            ]}
            value={form.gap}
            onChange={gap => onChange({ gap })}
          />
        </OptionRow>
        <SwitchRow
          title={t('Auto-cut every 4000 px')}
          subtitle={t('Splits between pages so each image stays easy to upload')}
          value={form.autoCut}
          onValueChange={autoCut => onChange({ autoCut })}
        />
      </Section>
    );
  }
  if (form.format === 'social') {
    return (
      <Section title={t('Options')}>
        <OptionRow label={t('Frame')}>
          <Segmented<SocialShape>
            options={[
              { value: 'square', label: t('Square') },
              { value: 'portrait', label: '4:5' },
              { value: 'story', label: '9:16' },
            ]}
            value={form.socialShape}
            onChange={socialShape => onChange({ socialShape })}
          />
        </OptionRow>
      </Section>
    );
  }
  return (
    <Section title={t('Options')}>
      <OptionRow label={t('Quality')}>
        <Segmented<ExportQuality>
          options={[
            { value: 1, label: '1x · 1200 px' },
            { value: 2, label: '2x · 2400 px' },
          ]}
          value={form.quality}
          onChange={quality => onChange({ quality })}
        />
      </OptionRow>
      {form.format === 'pdf' && (
        <OptionRow label={t('Layout|pages')}>
          <Segmented
            options={[
              { value: 'single', label: t('Single page') },
              { value: 'spread', label: t('Spread') },
            ]}
            value={form.spread ? 'spread' : 'single'}
            onChange={value => onChange({ spread: value === 'spread' })}
          />
        </OptionRow>
      )}
      <SwitchRow
        title={t('Add cover page')}
        subtitle={project.coverUri ? t('Uses the story cover') : t('Builds a title cover from the story name')}
        value={form.cover}
        onValueChange={cover => onChange({ cover })}
      />
      {form.format === 'pdf' && (
        <SwitchRow
          title={t('Add info page')}
          subtitle={t('Title, author and export date')}
          value={form.info}
          onValueChange={info => onChange({ info })}
        />
      )}
      {(form.cover || withInfo) && (
        <OptionRow label={t('Author')}>
          <TextField
            value={form.penName}
            onChangeText={penName => onChange({ penName })}
            placeholder={t('Pen name')}
            accessibilityLabel={t('Pen name')}
            maxLength={60}
          />
        </OptionRow>
      )}
    </Section>
  );
}
