import { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { AiIcon, CaretDownIcon, CheckIcon, CopyIcon, DeleteIcon, LockIcon, MoreIcon, ReadIcon } from '../../ui/icons';

import { msg, t } from '../../core/i18n';
import { LIMITS, ROLE_LABEL } from '../../core/model/constants';
import { chapterLabel, characterUsage } from '../../core/model/selectors';
import type { Character, CharacterRole, ID } from '../../core/model/types';
import { useAppNavigation, type ScreenProps } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import {
  AppBar,
  Avatar,
  Banner,
  Button,
  EmptyState,
  ICON,
  Icon,
  IconButton,
  ListItem,
  Menu,
  Pressable,
  PromptDialog,
  Screen,
  Sheet,
  Tabs,
  Text,
  confirm,
  toast,
  useColor,
} from '../../ui';
import { DesignTab } from './DesignTab';
import { FillSheet } from './FillSheet';
import { ProfileTab } from './ProfileTab';
import { RelationsTab } from './RelationsTab';
import { useDraft } from './fields';

type TabKey = 'profile' | 'design' | 'relations';

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'profile', label: msg('Profile') },
  { key: 'design', label: msg('Design') },
  { key: 'relations', label: msg('Relations') },
];

const ROLES = Object.keys(ROLE_LABEL) as CharacterRole[];

const AGE_MAX = 20;
const STICKY_TABS = [1];

export function CharacterScreen({ route, navigation }: ScreenProps<'Character'>) {
  const character = useStory(s => s.characters[route.params.characterId]);
  if (!character) {
    return (
      <Screen>
        <AppBar title={t('Character')} onBack={() => navigation.goBack()} />
        <EmptyState title={t('Character not found')} message={t('This character has been deleted.')} />
      </Screen>
    );
  }
  return <CharacterBody key={character.id} character={character} />;
}

function CharacterBody({ character }: { character: Character }) {
  const navigation = useAppNavigation();
  const muted = useColor('text-muted');
  const accent = useColor('accent');
  const update = useStory(s => s.updateCharacter);
  const [tab, setTab] = useState<TabKey>('profile');
  const [isNew] = useState(() => !character.name.trim());
  const [menu, setMenu] = useState(false);
  const [roleMenu, setRoleMenu] = useState(false);
  const [ageDialog, setAgeDialog] = useState(false);
  const [usageSheet, setUsageSheet] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillVersion, setFillVersion] = useState(0);
  const usageTarget = useRef<ID | null>(null);
  const name = useDraft(character.name, value => update(character.id, { name: value.trim() }));

  const openFill = () => {
    name.onBlur();
    setFillOpen(true);
  };

  const usage = useMemo(
    () => (usageSheet ? characterUsage(useStory.getState(), character.id) : null),
    [usageSheet, character.id],
  );

  const duplicate = () => {
    name.onBlur();
    const newId = useStory.getState().duplicateCharacter(character.id);
    if (newId) {
      toast(t('Character duplicated'));
      navigation.push('Character', { characterId: newId });
    }
  };

  const remove = async () => {
    const { dialogues, bubbles } = characterUsage(useStory.getState(), character.id);
    const ok = await confirm(
      character.name.trim() ? t('Delete {name}?', { name: character.name.trim() }) : t('Delete this character?'),
      t('{dialogues} dialogue lines and {bubbles} speech bubbles use this character. They are kept but will no longer be linked to it.', { dialogues, bubbles }),
      { confirmText: t('Delete'), destructive: true },
    );
    if (ok) {
      navigation.goBack();
      useStory.getState().removeCharacter(character.id);
    }
  };

  return (
    <Screen padded={false}>
      <AppBar
        title={t('Character')}
        onBack={() => navigation.goBack()}
        right={<IconButton icon={MoreIcon} onPress={() => setMenu(true)} accessibilityLabel={t('More')} />}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={STICKY_TABS}
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-4 p-4">
          <View>
            <Avatar character={character} size={88} square />
            {character.locked && (
              <View className="absolute -bottom-1.5 -right-1.5 h-6.5 w-6.5 items-center justify-center rounded-full bg-overlay">
                <Icon icon={LockIcon} size={ICON.xs} color="text-secondary" />
              </View>
            )}
          </View>
          <View className="flex-1">
            <TextInput
              value={name.text}
              onChangeText={name.onChangeText}
              onBlur={name.onBlur}
              placeholder={t('Character name')}
              placeholderTextColor={muted}
              selectionColor={accent}
              cursorColor={accent}
              accessibilityLabel={t('Character name')}
              maxLength={LIMITS.characterName}
              autoFocus={isNew}
              returnKeyType="done"
              className="border-b border-control-border px-0 py-1 text-title font-inter-semibold text-text"
            />
            <View className="mt-2 flex-row items-center gap-2">
              <Pressable
                accessibilityLabel={t('Role: {role}', { role: t(ROLE_LABEL[character.role]) })}
                hitSlop={6}
                onPress={() => setRoleMenu(true)}
                className="h-9 shrink flex-row items-center gap-0.5"
              >
                <Text variant="label" tone="secondary">
                  {t(ROLE_LABEL[character.role])}
                </Text>
                <Icon icon={CaretDownIcon} size={ICON.xs} color="text-muted" />
              </Pressable>
              <Text variant="label" tone="muted">
                ·
              </Text>
              <Pressable
                accessibilityLabel={character.age ? t('Age: {age}', { age: character.age }) : t('Add age')}
                hitSlop={6}
                onPress={() => setAgeDialog(true)}
                className="h-9 shrink flex-row items-center"
              >
                <Text variant="label" tone={character.age ? 'secondary' : 'muted'} numberOfLines={1}>
                  {character.age ? t('Age: {age}', { age: character.age }) : t('Add age')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View className="bg-bg">
          <Tabs tabs={TABS.map(item => ({ ...item, label: t(item.label) }))} value={tab} onChange={setTab} stretch />
        </View>
        <View className="gap-2 p-4">
          {isNew && !name.text.trim() && <Banner text={t('What is this character called? Type a name above to begin.')} />}
          {tab === 'profile' && <Button title={t('Fill with AI')} icon={AiIcon} variant="ai" small onPress={openFill} className="mb-2 self-start" />}
          {tab === 'profile' && <ProfileTab key={fillVersion} character={character} />}
          {tab === 'design' && <DesignTab character={character} />}
          {tab === 'relations' && <RelationsTab character={character} />}
        </View>
      </KeyboardAwareScrollView>

      <Menu
        visible={menu}
        onClose={() => setMenu(false)}
        title={character.name.trim() || t('Character')}
        items={[
          { label: t('Duplicate'), icon: CopyIcon, onPress: duplicate },
          { label: t('Where they appear'), icon: ReadIcon, onPress: () => setUsageSheet(true) },
          { label: t('Delete character'), icon: DeleteIcon, destructive: true, onPress: remove },
        ]}
      />
      <Menu
        visible={roleMenu}
        onClose={() => setRoleMenu(false)}
        title={t('Role')}
        items={ROLES.map(role => ({
          label: t(ROLE_LABEL[role]),
          icon: role === character.role ? CheckIcon : undefined,
          onPress: () => update(character.id, { role }),
        }))}
      />
      <PromptDialog
        visible={ageDialog}
        onClose={() => setAgeDialog(false)}
        title={t('Age')}
        message={t('A number or words, e.g. 17, around 30.')}
        initialValue={character.age}
        placeholder={t('Around 30')}
        maxLength={AGE_MAX}
        allowEmpty
        onSubmit={age => {
          setAgeDialog(false);
          update(character.id, { age: age.trim() });
        }}
      />
      <Sheet
        visible={usageSheet}
        onClose={() => setUsageSheet(false)}
        onClosed={() => {
          const chapterId = usageTarget.current;
          usageTarget.current = null;
          if (chapterId) {
            navigation.navigate('Script', { chapterId });
          }
        }}
        title={t('Where they appear')}
        subtitle={usage ? t('{dialogues} dialogue lines · {bubbles} speech bubbles', { dialogues: usage.dialogues, bubbles: usage.bubbles }) : undefined}
      >
        {usage && usage.chapterIds.length === 0 && (
          <Text tone="secondary" className="p-4">
            {t('This character does not appear in any chapter yet.')}
          </Text>
        )}
        {usage?.chapterIds.map(chapterId => (
          <ListItem
            key={chapterId}
            title={chapterLabel(useStory.getState(), chapterId)}
            icon={ReadIcon}
            chevron
            onPress={() => {
              usageTarget.current = chapterId;
              setUsageSheet(false);
            }}
          />
        ))}
      </Sheet>
      {fillOpen && (
        <FillSheet
          character={character}
          onClose={() => setFillOpen(false)}
          onApplied={patch => {
            if (patch.name !== undefined) {
              name.setText(patch.name);
            }
            setFillVersion(version => version + 1);
          }}
        />
      )}
    </Screen>
  );
}
