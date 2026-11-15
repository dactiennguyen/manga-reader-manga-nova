import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { useCharacters } from '../../state/hooks';
import type { ID } from '../../core/model/types';
import { useStory } from '../../state/useStory';
import {
  REF_BOARD_KINDS,
  REF_KIND_LABEL,
  REF_LIMITS,
  boardLink,
  useLinkTargets,
  useRefBoards,
  type RefBoard,
  type RefBoardKind,
} from '../../state/useRefBoards';
import { Button, Chip, ChipGroup, ChipRow, FieldLabel, Sheet, TextField } from '../../ui';

export type BoardDraft = { kind?: RefBoardKind; projectId?: ID; characterId?: ID; name?: string };

/**
 * Makes a new board or edits one. `onSaved` runs after the sheet has closed, so it can open a screen or
 * another sheet safely.
 */
export function BoardFormSheet({
  visible,
  board,
  draft,
  onClose,
  onSaved,
}: {
  visible: boolean;
  board?: RefBoard;
  draft?: BoardDraft;
  onClose: () => void;
  onSaved?: (boardId: ID) => void;
}) {
  const targets = useLinkTargets();
  const projects = useStory(s => s.projects);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RefBoardKind>('characters');
  const [projectId, setProjectId] = useState<ID | undefined>();
  const [characterId, setCharacterId] = useState<ID | undefined>();
  const saved = useRef<ID | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const link = board ? boardLink(board, targets) : { projectId: draft?.projectId, characterId: draft?.characterId };
    setName(board?.name ?? draft?.name ?? '');
    setKind(board?.kind ?? draft?.kind ?? 'characters');
    setProjectId(link.projectId);
    setCharacterId(link.characterId);
    // Read once, when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const stories = useMemo(
    () => Object.values(projects).filter(project => !project.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt),
    [projects],
  );
  const cast = useCharacters(projectId);

  const save = () => {
    const input = { name, kind, projectId, characterId };
    const store = useRefBoards.getState();
    if (board) {
      store.updateBoard(board.id, input);
      saved.current = board.id;
    } else {
      saved.current = store.createBoard(input);
    }
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        const id = saved.current;
        saved.current = null;
        if (id) {
          onSaved?.(id);
        }
      }}
      title={board ? t('Edit board') : t('New board')}
    >
      <View className="gap-3 px-4 pb-2">
        <FieldLabel>{t('Name')}</FieldLabel>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={t(REF_KIND_LABEL[kind])}
          maxLength={REF_LIMITS.boardName}
          autoFocus={!board}
          returnKeyType="done"
          accessibilityLabel={t('Name')}
        />
        <FieldLabel>{t('Kind of board')}</FieldLabel>
        <ChipGroup>
          {REF_BOARD_KINDS.map(item => (
            <Chip key={item} label={t(REF_KIND_LABEL[item])} selected={kind === item} onPress={() => setKind(item)} />
          ))}
        </ChipGroup>
        {stories.length > 0 && (
          <>
            <FieldLabel>{t('Linked story')}</FieldLabel>
            <ChipRow>
              <Chip
                label={t('None')}
                selected={!projectId}
                onPress={() => {
                  setProjectId(undefined);
                  setCharacterId(undefined);
                }}
              />
              {stories.map(project => (
                <Chip
                  key={project.id}
                  label={project.title.trim() || t('Untitled')}
                  selected={projectId === project.id}
                  onPress={() => {
                    if (projectId !== project.id) {
                      setProjectId(project.id);
                      setCharacterId(undefined);
                    }
                  }}
                />
              ))}
            </ChipRow>
          </>
        )}
        {cast.length > 0 && (
          <>
            <FieldLabel>{t('Linked character')}</FieldLabel>
            <ChipRow>
              <Chip label={t('None')} selected={!characterId} onPress={() => setCharacterId(undefined)} />
              {cast.map(character => (
                <Chip
                  key={character.id}
                  label={character.name.trim() || t('Unnamed')}
                  selected={characterId === character.id}
                  onPress={() => setCharacterId(character.id)}
                />
              ))}
            </ChipRow>
          </>
        )}
        <Button title={board ? t('Save') : t('Create board')} onPress={save} className="mt-2" />
      </View>
    </Sheet>
  );
}
