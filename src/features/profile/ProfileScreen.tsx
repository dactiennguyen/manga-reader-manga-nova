import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  AiIcon,
  AwakeIcon,
  CardsIcon,
  CharactersIcon,
  CircleIcon,
  DataIcon,
  DeleteIcon,
  DeviceIcon,
  DoneIcon,
  EditIcon,
  FlagIcon,
  HandIcon,
  IdeaIcon,
  InfoIcon,
  JourneyIcon,
  MagazineIcon,
  MailIcon,
  MoveToIcon,
  PaletteIcon,
  SlidersIcon,
  TranslateIcon,
} from '../../ui/icons';

import { ARCHIVE_EXTENSION } from '../../core/archive/bundle';
import { LOCALES, LOCALE_NAME, msg, t, tn, type LanguageChoice } from '../../core/i18n';
import { ART_STYLE_LABEL } from '../../core/model/constants';
import { initialOf } from '../../core/model/selectors';
import { storyStats } from '../../core/story/stats';
import { formatBytes } from '../../core/util/format';
import { DIRS, dirSize } from '../../native/files';
import { useAppNavigation } from '../../state/navigation';
import { useAiReports } from '../../state/useAiReports';
import { useSettings, type CreatorRole, type Handedness, type ThemeMode } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import {
  ART,
  ArtBanner,
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
import { ReportsSheet } from '../aiReport/ReportsSheet';
import { AiServerSheet } from './AiServerSheet';
import { ReminderRows } from './ReminderRows';
import { StreakCard } from './StreakCard';
import { useImportArchive } from './useImportArchive';

const PEN_NAME_MAX = 30;

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: msg('System') },
  { value: 'light', label: msg('Light') },
  { value: 'dark', label: msg('Dark') },
];

const LANGUAGE_OPTIONS: LanguageChoice[] = ['system', ...LOCALES];

const HAND_OPTIONS: { value: Handedness; label: string }[] = [
  { value: 'right', label: msg('Right') },
  { value: 'left', label: msg('Left') },
];

const ROLE_NAME: Record<CreatorRole, string> = {
  write: msg('Writing|role'),
  draw: msg('Drawing|role'),
  both: msg('Writing and drawing'),
};

function languageLabel(choice: LanguageChoice): string {
  return choice === 'system' ? t('System') : LOCALE_NAME[choice];
}

function Value({ children }: { children: string }) {
  return <Text tone="muted">{children}</Text>;
}

export function ProfileScreen() {
  const navigation = useAppNavigation();
  const dockInset = useDockInset();
  const penName = useSettings(s => s.penName);
  const themeMode = useSettings(s => s.themeMode);
  const language = useSettings(s => s.language);
  const handedness = useSettings(s => s.handedness);
  const keepAwake = useSettings(s => s.keepAwakeWhileDrawing);
  const haptics = useSettings(s => s.haptics);
  const role = useSettings(s => s.role);
  const defaultStyle = useSettings(s => s.defaultStyle);
  const aiBaseUrl = useSettings(s => s.aiBaseUrl);
  const aiModel = useSettings(s => s.aiModel);
  const aiDemo = useSettings(s => s.aiDemo);
  const set = useSettings(s => s.set);

  const projects = useStory(s => s.projects);
  const chapters = useStory(s => s.chapters);
  const pages = useStory(s => s.pages);
  const characters = useStory(s => s.characters);

  const [menu, setMenu] = useState<'theme' | 'hand' | 'language' | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [aiSheet, setAiSheet] = useState(false);
  const [reportsSheet, setReportsSheet] = useState(false);
  const reportCount = useAiReports(s => s.reports.length);
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
  const themeLabel = t(THEME_OPTIONS.find(option => option.value === themeMode)?.label ?? '');
  const handLabel = t(HAND_OPTIONS.find(option => option.value === handedness)?.label ?? '');
  const statItems = [
    { value: stats.projectCount, label: t('stories') },
    { value: stats.donePages, label: t('pages done') },
    { value: stats.characterCount, label: t('characters') },
  ];

  return (
    <Screen scroll bottomInset={dockInset} contentClassName="pt-4">
      <ArtBanner source={ART.profileBanner} ratio={2}>
        <View className="absolute left-4 top-3">
          <Text variant="display" tone="onPaper" accessibilityRole="header">
            {t('Profile')}
          </Text>
        </View>
      </ArtBanner>

      <Card className="flex-row items-center gap-3 p-4">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Text variant="display" tone="onAccent">
            {initialOf(penName)}
          </Text>
        </View>
        <View className="flex-1">
          <Text variant="caption" tone="secondary">
            {t('Pen name')}
          </Text>
          <Text variant="title" tone={penName ? 'text' : 'muted'} numberOfLines={1}>
            {penName || t('No pen name yet')}
          </Text>
        </View>
        <IconButton icon={EditIcon} onPress={() => setEditingName(true)} accessibilityLabel={t('Edit pen name')} />
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

      <StreakCard />

      <Section title={t('Studio|section')}>
        <ListItem icon={JourneyIcon} title={t('Mangaka journey')} chevron onPress={() => navigation.navigate('Journey')} />
        <ListItem icon={CardsIcon} title={t('Character cards')} chevron onPress={() => navigation.navigate('Cards')} />
        <ListItem icon={CharactersIcon} title={t('Reading club')} chevron onPress={() => navigation.navigate('Club')} />
        <ListItem icon={MailIcon} title={t('Mailbox')} chevron onPress={() => navigation.navigate('Mailbox')} />
        <ListItem icon={MagazineIcon} title={t('My magazine')} chevron onPress={() => navigation.navigate('Magazine')} />
      </Section>

      <Section title={t('Appearance|settings')}>
        <ListItem
          icon={PaletteIcon}
          title={t('Theme')}
          right={<Value>{themeLabel}</Value>}
          chevron
          onPress={() => setMenu('theme')}
        />
        <ListItem
          icon={TranslateIcon}
          title={t('Language')}
          right={<Value>{languageLabel(language)}</Value>}
          chevron
          onPress={() => setMenu('language')}
        />
        <ListItem
          icon={HandIcon}
          title={t('Drawing hand')}
          subtitle={t('Flips the side of the drawing toolbar')}
          right={<Value>{handLabel}</Value>}
          chevron
          onPress={() => setMenu('hand')}
        />
      </Section>

      <Section title={t('Writing and drawing')}>
        <ListItem
          icon={SlidersIcon}
          title={t('Creative preferences')}
          subtitle={`${t(ROLE_NAME[role])} · ${t(ART_STYLE_LABEL[defaultStyle])}`}
          chevron
          onPress={() => navigation.navigate('Preferences', { edit: true })}
        />
        <SwitchRow
          icon={AwakeIcon}
          title={t('Keep screen on while drawing')}
          value={keepAwake}
          onValueChange={value => set({ keepAwakeWhileDrawing: value })}
        />
        <SwitchRow
          icon={DeviceIcon}
          title={t('Haptic feedback')}
          value={haptics}
          onValueChange={value => set({ haptics: value })}
        />
        <ReminderRows />
      </Section>

      <Section title="AI">
        <ListItem
          icon={AiIcon}
          iconColor="ai"
          title={t('AI server')}
          subtitle={aiAddress ? `${aiAddress} · ${aiModel}` : t('Add your own server to turn on AI help')}
          right={aiAddress ? undefined : <Value>{t('Not set')}</Value>}
          chevron
          onPress={() => setAiSheet(true)}
        />
        {!aiAddress && (
          <SwitchRow
            icon={IdeaIcon}
            title={t('Sample answers')}
            subtitle={t('Try the AI tools before you add a server')}
            value={aiDemo}
            onValueChange={value => set({ aiDemo: value })}
          />
        )}
        <ListItem
          icon={FlagIcon}
          title={t('Reported AI answers')}
          subtitle={reportCount ? tn(reportCount, '{count} report', '{count} reports') : t('Flag an AI answer to report it')}
          chevron
          onPress={() => setReportsSheet(true)}
        />
      </Section>

      <Section title={t('Privacy and data')}>
        <ListItem
          icon={MoveToIcon}
          title={t('Import project (.{ext})', { ext: ARCHIVE_EXTENSION })}
          subtitle={importing ? t('Importing…') : t('Add a backed-up story to your library')}
          chevron
          disabled={importing}
          onPress={onImport}
        />
        <ListItem icon={DeleteIcon} title={t('Trash ({count})', { count: stats.trashed })} chevron onPress={() => navigation.navigate('Trash')} />
        <ListItem
          icon={DataIcon}
          title={t('Storage used')}
          right={<Value>{usedBytes === null ? '…' : formatBytes(usedBytes)}</Value>}
        />
      </Section>

      <Section title={t('More|section')}>
        <ListItem icon={InfoIcon} title={t('About')} chevron onPress={() => navigation.navigate('About')} />
      </Section>

      <Menu
        visible={menu === 'theme'}
        onClose={() => setMenu(null)}
        title={t('Theme')}
        items={THEME_OPTIONS.map(option => ({
          label: t(option.label),
          icon: option.value === themeMode ? DoneIcon : CircleIcon,
          onPress: () => set({ themeMode: option.value }),
        }))}
      />
      <Menu
        visible={menu === 'language'}
        onClose={() => setMenu(null)}
        title={t('Language')}
        items={LANGUAGE_OPTIONS.map(option => ({
          label: languageLabel(option),
          icon: option === language ? DoneIcon : CircleIcon,
          onPress: () => set({ language: option }),
        }))}
      />
      <Menu
        visible={menu === 'hand'}
        onClose={() => setMenu(null)}
        title={t('Drawing hand')}
        items={HAND_OPTIONS.map(option => ({
          label: t(option.label),
          icon: option.value === handedness ? DoneIcon : CircleIcon,
          onPress: () => set({ handedness: option.value }),
        }))}
      />
      <AiServerSheet visible={aiSheet} onClose={() => setAiSheet(false)} />
      <ReportsSheet visible={reportsSheet} onClose={() => setReportsSheet(false)} />
      <PromptDialog
        visible={editingName}
        onClose={() => setEditingName(false)}
        onSubmit={value => {
          set({ penName: value.slice(0, PEN_NAME_MAX) });
          setEditingName(false);
        }}
        title={t('Pen name')}
        message={t('The author name printed on the credits page when you export.')}
        initialValue={penName}
        placeholder={t('Optional')}
        maxLength={PEN_NAME_MAX}
        allowEmpty
      />
    </Screen>
  );
}
