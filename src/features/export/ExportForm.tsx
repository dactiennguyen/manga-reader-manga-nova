import { View } from 'react-native';
import { Archive, FileText, GalleryVertical, Images } from 'lucide-react-native';

import type { ExportFormat, ExportOptions, ExportQuality, LongWidth } from '../../core/export/plan';
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
  type LucideIcon,
} from '../../ui';
import { FORMAT_LABEL, FormatCard, OptionRow } from './ExportParts';

const FORMATS: { value: ExportFormat; icon: LucideIcon; description: string }[] = [
  { value: 'png', icon: Images, description: 'One image per page, packed in a ZIP. Good for social posts.' },
  { value: 'pdf', icon: FileText, description: 'For printing or sending to beta readers.' },
  { value: 'cbz', icon: Archive, description: 'Opens in comic reader apps.' },
  { value: 'long', icon: GalleryVertical, description: 'Stitches pages into a vertical strip for webtoon platforms.' },
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
    <Section title="Chapters">
      <View className="px-4 py-1">
        {selectable.length > 1 && <Checkbox checked={allSelected} onChange={onSelectAll} label="Select all" />}
        {chapters.map(chapter => {
          const ids = chapterPages[chapter.id];
          const notDone = ids.filter(id => !pages[id].done).length;
          if (ids.length === 0) {
            return (
              <View key={chapter.id} className="py-1">
                <Text tone="muted">{chapterLabel(state, chapter.id)}</Text>
                <Text variant="caption" tone="muted">
                  No pages
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
                {ids.length} {ids.length === 1 ? 'page' : 'pages'}
                {notDone ? ` · ${notDone} not done` : ''}
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
      <SectionHeader>Format</SectionHeader>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-3">
        {FORMATS.map(item => (
          <FormatCard
            key={item.value}
            icon={item.icon}
            title={FORMAT_LABEL[item.value]}
            description={item.description}
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
      <SectionHeader>Language</SectionHeader>
      <Card className="gap-2 p-3">
        <ChipRow>
          <Chip label="Original" selected={!lang} onPress={() => onChange(null)} />
          {languages.map(name => (
            <Chip key={name} label={name} selected={lang === name} onPress={() => onChange(name)} />
          ))}
        </ChipRow>
        <Text variant="caption" tone="secondary">
          {translated
            ? translated.done < translated.total
              ? `${translated.done} of ${translated.total} bubbles translated. The rest are exported with the original text.`
              : `All ${translated.total} bubbles are translated.`
            : 'Bubbles are exported with the original text.'}
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
      <Section title="Options">
        <OptionRow label="Width">
          <Segmented<LongWidth>
            options={[
              { value: 800, label: '800 px' },
              { value: 1080, label: '1080 px' },
            ]}
            value={form.longWidth}
            onChange={longWidth => onChange({ longWidth })}
          />
        </OptionRow>
        <OptionRow label="Page gap">
          <Segmented
            options={[
              { value: 0, label: 'None' },
              { value: 24, label: 'Small' },
              { value: 64, label: 'Large' },
            ]}
            value={form.gap}
            onChange={gap => onChange({ gap })}
          />
        </OptionRow>
        <SwitchRow
          title="Auto-cut every 4000 px"
          subtitle="Splits between pages so each image stays easy to upload"
          value={form.autoCut}
          onValueChange={autoCut => onChange({ autoCut })}
        />
      </Section>
    );
  }
  return (
    <Section title="Options">
      <OptionRow label="Quality">
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
        <OptionRow label="Layout">
          <Segmented
            options={[
              { value: 'single', label: 'Single page' },
              { value: 'spread', label: 'Spread' },
            ]}
            value={form.spread ? 'spread' : 'single'}
            onChange={value => onChange({ spread: value === 'spread' })}
          />
        </OptionRow>
      )}
      <SwitchRow
        title="Add cover page"
        subtitle={project.coverUri ? 'Uses the story cover' : 'Builds a title cover from the story name'}
        value={form.cover}
        onValueChange={cover => onChange({ cover })}
      />
      {form.format === 'pdf' && (
        <SwitchRow
          title="Add info page"
          subtitle="Title, author and export date"
          value={form.info}
          onValueChange={info => onChange({ info })}
        />
      )}
      {(form.cover || withInfo) && (
        <OptionRow label="Author">
          <TextField
            value={form.penName}
            onChangeText={penName => onChange({ penName })}
            placeholder="Pen name"
            accessibilityLabel="Pen name"
            maxLength={60}
          />
        </OptionRow>
      )}
    </Section>
  );
}
