import { useState } from 'react';

import { brushFileForSet } from '../../core/art/brushFile';
import { DEFAULT_SET_ID, SETS_MAX, SET_NAME_MAX } from '../../core/art/presets';
import { addSet, findSet, removeSet, renameSet, setContents, uniqueSetName } from '../../core/art/presetSets';
import { t } from '../../core/i18n';
import { uid } from '../../core/util/id';
import { useAppNavigation } from '../../state/navigation';
import { useArtPresets } from '../../state/useArtPresets';
import { Menu, PromptDialog, confirm, toast } from '../../ui';
import { PlayTogetherIcon, ShareIcon } from '../../ui/icons';
import { shareBrushFile } from './brushFiles';
import { countLabel, setLabel } from './labels';

type Prompt = { kind: 'new' } | { kind: 'rename'; setId: string };

/**
 * What can be done to a whole set, shared by the library and the set screen: make, rename, delete and
 * share. Dialogs open from a closed menu or from the screen itself, never over another sheet.
 */
export function useSetActions(options: { onCreated?: (setId: string) => void; onRemoved?: () => void } = {}) {
  const navigation = useAppNavigation();
  const update = useArtPresets(s => s.update);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);

  const newSet = () => {
    if (useArtPresets.getState().sets.length >= SETS_MAX) {
      toast(t('You can keep up to {n} sets.', { n: SETS_MAX }));
      return;
    }
    setPrompt({ kind: 'new' });
  };

  const rename = (setId: string) => setPrompt({ kind: 'rename', setId });

  const remove = async (setId: string) => {
    const presets = useArtPresets.getState();
    const set = findSet(presets, setId);
    if (!set || setId === DEFAULT_SET_ID) {
      return;
    }
    const inside = setContents(presets, setId);
    const items = inside.brushes.length + inside.tones.length;
    const ok = await confirm(
      t('Delete {name}?', { name: setLabel(set) }),
      items
        ? t('Everything in it is deleted too: {items}. Your drawings keep how they look.', {
            items: countLabel(inside.brushes.length, inside.tones.length),
          })
        : t('Your drawings keep how they look.'),
      { confirmText: t('Delete'), destructive: true },
    );
    if (ok) {
      update(p => removeSet(p, setId));
      options.onRemoved?.();
    }
  };

  const shareAsFile = async (setId: string) => {
    const presets = useArtPresets.getState();
    const set = findSet(presets, setId);
    const file = set ? brushFileForSet(presets, setId, setLabel(set)) : null;
    if (!set || !file) {
      return;
    }
    if (!file.brushes.length && !file.tones.length) {
      toast(t('This set is empty. Add a brush or tone first.'));
      return;
    }
    try {
      await shareBrushFile(file, setLabel(set));
    } catch {
      toast(t("Couldn't share this set. Try again."));
    }
  };

  // The share screen says when the friend needs it open too, and lets the host open it for everyone.
  const sendInRoom = (setId: string) => navigation.navigate('ShareBrushes', { setId });

  const submitPrompt = (value: string) => {
    const current = prompt;
    setPrompt(null);
    if (!current) {
      return;
    }
    if (current.kind === 'rename') {
      update(p => renameSet(p, current.setId, value));
      return;
    }
    const id = uid();
    update(p => addSet(p, id, uniqueSetName(p, value, setLabel)));
    if (findSet(useArtPresets.getState(), id)) {
      options.onCreated?.(id);
    }
  };

  const renaming = prompt?.kind === 'rename' ? findSet(useArtPresets.getState(), prompt.setId) : undefined;

  const dialogs = (
    <>
      <PromptDialog
        visible={!!prompt}
        onClose={() => setPrompt(null)}
        onSubmit={submitPrompt}
        title={prompt?.kind === 'rename' ? t('Rename set') : t('New set')}
        message={prompt?.kind === 'new' ? t('For example Inking, Backgrounds or Effects.') : undefined}
        initialValue={renaming ? setLabel(renaming) : ''}
        placeholder={t('Set name')}
        confirmText={prompt?.kind === 'rename' ? t('Save') : t('Create')}
        maxLength={SET_NAME_MAX}
      />
      <Menu
        visible={!!sharing}
        onClose={() => setSharing(null)}
        title={t('Share this set')}
        items={[
          {
            label: t('Share as a file'),
            subtitle: t('A small .mnbrush file for chat, mail or Drive'),
            icon: ShareIcon,
            onPress: () => sharing && shareAsFile(sharing),
          },
          {
            label: t('Send to a friend in the room'),
            subtitle: t('Over Wi-Fi, in Play together'),
            icon: PlayTogetherIcon,
            onPress: () => sharing && sendInRoom(sharing),
          },
        ]}
      />
    </>
  );

  return { newSet, rename, remove, share: (setId: string) => setSharing(setId), dialogs };
}
