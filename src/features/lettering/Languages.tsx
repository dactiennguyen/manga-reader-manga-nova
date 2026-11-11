import { useState } from 'react';
import { View } from 'react-native';
import { DeleteIcon, EditIcon, PlusIcon, TranslateIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { LANGUAGE_NAME_MAX, MAX_LANGUAGES, languageNameError, translationProgress } from '../../core/lettering/translation';
import type { Bubble, Project } from '../../core/model/types';
import { useStory } from '../../state/useStory';
import { Button, ICON, IconButton, ListItem, PromptDialog, Sheet, Text, confirm, toast } from '../../ui';

export function progressLabel(bubbles: Bubble[], lang: string): string {
  const { done, total } = translationProgress(bubbles, lang);
  return total ? t('{done} of {total} translated', { done, total }) : t('Nothing to translate');
}

export function ManageLanguagesSheet({
  visible,
  onClose,
  project,
  onAdded,
  onRenamed,
}: {
  visible: boolean;
  onClose: () => void;
  project: Project;
  onAdded?: (lang: string) => void;
  onRenamed?: (from: string, to: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const languages = project.languages ?? [];
  const full = languages.length >= MAX_LANGUAGES;

  const add = (name: string) => {
    const error = languageNameError(languages, name);
    const added = error ? null : useStory.getState().addLanguage(project.id, name);
    setAdding(false);
    if (!added) {
      toast(error ? t(error) : t('Could not add that language'));
      return;
    }
    onAdded?.(added);
  };

  const rename = (from: string, name: string) => {
    const error = languageNameError(languages, name, from);
    const renamed = error ? null : useStory.getState().renameLanguage(project.id, from, name);
    setRenaming(null);
    if (!renamed) {
      toast(error ? t(error) : t('Could not rename that language'));
      return;
    }
    onRenamed?.(from, renamed);
  };

  const remove = async (name: string) => {
    const ok = await confirm(
      t('Remove {name}?', { name }),
      t('Every {name} translation in this story will be deleted. The original text and the art are kept.', { name }),
      { confirmText: t('Remove'), destructive: true },
    );
    if (ok) {
      useStory.getState().removeLanguage(project.id, name);
    }
  };

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={t('Languages')} subtitle={t('The art is shared. Only the text changes.')}>
        <ListItem title={t('Original')} subtitle={t('The text you wrote first')} icon={TranslateIcon} />
        {languages.map(name => (
          <ListItem
            key={name}
            title={name}
            icon={TranslateIcon}
            right={
              <View className="flex-row items-center">
                <IconButton icon={EditIcon} size={ICON.md} onPress={() => setRenaming(name)} accessibilityLabel={t('Rename {name}', { name })} />
                <IconButton
                  icon={DeleteIcon}
                  size={ICON.md}
                  color="danger"
                  onPress={() => remove(name)}
                  accessibilityLabel={t('Remove {name}', { name })}
                />
              </View>
            }
          />
        ))}
        <View className="gap-3 p-4">
          <Button title={t('Add language')} icon={PlusIcon} disabled={full} onPress={() => setAdding(true)} />
          <Text variant="caption" tone="secondary" className="text-center">
            {full
              ? t('A story can have up to {max} extra languages.', { max: MAX_LANGUAGES })
              : t('Translations are typed by hand, one bubble at a time or from the translation list.')}
          </Text>
        </View>
      </Sheet>
      <PromptDialog
        visible={adding}
        onClose={() => setAdding(false)}
        onSubmit={add}
        title={t('Add language')}
        placeholder={t('For example: {name}', { name: 'Vietnamese' })}
        confirmText={t('Add')}
        maxLength={LANGUAGE_NAME_MAX}
      />
      <PromptDialog
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        onSubmit={name => renaming && rename(renaming, name)}
        title={t('Rename language')}
        initialValue={renaming ?? ''}
        maxLength={LANGUAGE_NAME_MAX}
      />
    </>
  );
}
