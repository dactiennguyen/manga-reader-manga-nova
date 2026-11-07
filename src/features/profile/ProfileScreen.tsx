import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Circle,
  CircleCheck,
  Database,
  FolderInput,
  Hand,
  Info,
  Palette,
  Pencil,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Trash,
} from 'lucide-react-native';

import { ARCHIVE_EXTENSION } from '../../core/archive/bundle';
import { ART_STYLE_LABEL } from '../../core/model/constants';
import { initialOf } from '../../core/model/selectors';
import { storyStats } from '../../core/story/stats';
import { formatBytes } from '../../core/util/format';
import { DIRS, dirSize } from '../../native/files';
import { useAppNavigation } from '../../state/navigation';
import { useSettings, type CreatorRole, type Handedness, type ThemeMode } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import {
  Card,
  IconButton,
  ListItem,
  Menu,
  PromptDialog,
  Screen,
  Section,
  SwitchRow,
  Text,
  useDockInset,
} from '../../ui';
import { AiServerSheet } from './AiServerSheet';
import { useImportArchive } from './useImportArchive';

const PEN_NAME_MAX = 30;

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const HAND_OPTIONS: { value: Handedness; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
];

const ROLE_NAME: Record<CreatorRole, string> = { write: 'Writing', draw: 'Drawing', both: 'Writing and drawing' };

function Value({ children }: { children: string }) {
  return <Text tone="muted">{children}</Text>;
}

export function ProfileScreen() {
  const navigation = useAppNavigation();
  const dockInset = useDockInset();
  const penName = useSettings(s => s.penName);
  const themeMode = useSettings(s => s.themeMode);
  const handedness = useSettings(s => s.handedness);
  const keepAwake = useSettings(s => s.keepAwakeWhileDrawing);
  const haptics = useSettings(s => s.haptics);
  const role = useSettings(s => s.role);
  const defaultStyle = useSettings(s => s.defaultStyle);
  const aiBaseUrl = useSettings(s => s.aiBaseUrl);
  const aiModel = useSettings(s => s.aiModel);
  const set = useSettings(s => s.set);

  const projects = useStory(s => s.projects);
  const chapters = useStory(s => s.chapters);
  const pages = useStory(s => s.pages);
  const characters = useStory(s => s.characters);

  const [menu, setMenu] = useState<'theme' | 'hand' | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [aiSheet, setAiSheet] = useState(false);
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const { importing, onImport } = useImportArchive();

  const stats = useMemo(
    () => storyStats({ projects, chapters, pages, characters }),
    [projects, chapters, pages, characters],
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      dirSize(DIRS.root)
        .then(size => alive && setUsedBytes(size))
        .catch(() => alive && setUsedBytes(0));
      return () => {
        alive = false;
      };
    }, []),
  );

  const aiAddress = aiBaseUrl.trim();
  const themeLabel = THEME_OPTIONS.find(option => option.value === themeMode)?.label ?? '';
  const handLabel = HAND_OPTIONS.find(option => option.value === handedness)?.label ?? '';
  const statItems = [
    { value: stats.projectCount, label: 'stories' },
    { value: stats.donePages, label: 'pages done' },
    { value: stats.characterCount, label: 'characters' },
  ];

  return (
    <Screen scroll bottomInset={dockInset} contentClassName="pt-4">
      <Text variant="display" accessibilityRole="header">
        Profile
      </Text>

      <Card className="flex-row items-center gap-3 p-4">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Text variant="display" tone="onAccent">
            {initialOf(penName)}
          </Text>
        </View>
        <View className="flex-1">
          <Text variant="caption" tone="secondary">
            Pen name
          </Text>
          <Text variant="title" tone={penName ? 'text' : 'muted'} numberOfLines={1}>
            {penName || 'No pen name yet'}
          </Text>
        </View>
        <IconButton icon={Pencil} onPress={() => setEditingName(true)} accessibilityLabel="Edit pen name" />
      </Card>

      <View className="flex-row gap-3">
        {statItems.map(item => (
          <Card key={item.label} className="flex-1 items-center px-1 py-3">
            <Text variant="display">{item.value}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {item.label}
            </Text>
          </Card>
        ))}
      </View>

      <Section title="Appearance">
        <ListItem
          icon={Palette}
          title="Theme"
          right={<Value>{themeLabel}</Value>}
          chevron
          onPress={() => setMenu('theme')}
        />
        <ListItem
          icon={Hand}
          title="Drawing hand"
          subtitle="Flips the side of the drawing toolbar"
          right={<Value>{handLabel}</Value>}
          chevron
          onPress={() => setMenu('hand')}
        />
      </Section>

      <Section title="Writing and drawing">
        <ListItem
          icon={SlidersHorizontal}
          title="Creative preferences"
          subtitle={`${ROLE_NAME[role]} · ${ART_STYLE_LABEL[defaultStyle]}`}
          chevron
          onPress={() => navigation.navigate('Preferences', { edit: true })}
        />
        <SwitchRow
          icon={Sun}
          title="Keep screen on while drawing"
          value={keepAwake}
          onValueChange={value => set({ keepAwakeWhileDrawing: value })}
        />
        <SwitchRow
          icon={Smartphone}
          title="Haptic feedback"
          value={haptics}
          onValueChange={value => set({ haptics: value })}
        />
      </Section>

      <Section title="AI">
        <ListItem
          icon={Sparkles}
          iconColor="ai"
          title="AI server"
          subtitle={aiAddress ? `${aiAddress} · ${aiModel}` : 'Add your own server to turn on AI help'}
          right={aiAddress ? undefined : <Value>Not set</Value>}
          chevron
          onPress={() => setAiSheet(true)}
        />
      </Section>

      <Section title="Privacy and data">
        <ListItem
          icon={FolderInput}
          title={`Import project (.${ARCHIVE_EXTENSION})`}
          subtitle={importing ? 'Importing…' : 'Add a backed-up story to your library'}
          chevron
          disabled={importing}
          onPress={onImport}
        />
        <ListItem icon={Trash} title={`Trash (${stats.trashed})`} chevron onPress={() => navigation.navigate('Trash')} />
        <ListItem
          icon={Database}
          title="Storage used"
          right={<Value>{usedBytes === null ? '…' : formatBytes(usedBytes)}</Value>}
        />
      </Section>

      <Section title="More">
        <ListItem icon={Info} title="About" chevron onPress={() => navigation.navigate('About')} />
      </Section>

      <Menu
        visible={menu === 'theme'}
        onClose={() => setMenu(null)}
        title="Theme"
        items={THEME_OPTIONS.map(option => ({
          label: option.label,
          icon: option.value === themeMode ? CircleCheck : Circle,
          onPress: () => set({ themeMode: option.value }),
        }))}
      />
      <Menu
        visible={menu === 'hand'}
        onClose={() => setMenu(null)}
        title="Drawing hand"
        items={HAND_OPTIONS.map(option => ({
          label: option.label,
          icon: option.value === handedness ? CircleCheck : Circle,
          onPress: () => set({ handedness: option.value }),
        }))}
      />
      <AiServerSheet visible={aiSheet} onClose={() => setAiSheet(false)} />
      <PromptDialog
        visible={editingName}
        onClose={() => setEditingName(false)}
        onSubmit={value => {
          set({ penName: value.slice(0, PEN_NAME_MAX) });
          setEditingName(false);
        }}
        title="Pen name"
        message="The author name printed on the credits page when you export."
        initialValue={penName}
        placeholder="Optional"
        maxLength={PEN_NAME_MAX}
        allowEmpty
      />
    </Screen>
  );
}
