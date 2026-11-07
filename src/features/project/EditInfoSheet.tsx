import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GENRES, LIMITS } from '../../core/model/constants';
import type { Project } from '../../core/model/types';
import { useStory } from '../../state/useStory';
import { Button, Chip, ChipGroup, FieldLabel, Sheet, Text, TextField, toast } from '../../ui';

export function EditInfoSheet({ project, visible, onClose }: { project: Project; visible: boolean; onClose: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [genres, setGenres] = useState(project.genres);
  const [logline, setLogline] = useState(project.logline);

  useEffect(() => {
    if (visible) {
      setTitle(project.title);
      setGenres(project.genres);
      setLogline(project.logline);
    }
  }, [visible, project.title, project.genres, project.logline]);

  const toggle = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter(item => item !== genre));
    } else if (genres.length >= LIMITS.genresPerProject) {
      toast(`Pick up to ${LIMITS.genresPerProject} genres`);
    } else {
      setGenres([...genres, genre]);
    }
  };

  const save = () => {
    useStory.getState().updateProject(project.id, { title: title.trim(), genres, logline: logline.trim() });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit details" maxHeight="90%">
      <View className="gap-2 p-4 pt-1">
        <FieldLabel>Story title</FieldLabel>
        <TextField
          value={title}
          onChangeText={setTitle}
          maxLength={LIMITS.projectTitle}
          placeholder="Story title"
          accessibilityLabel="Story title"
        />
        <FieldLabel>{`Genres (${genres.length}/${LIMITS.genresPerProject})`}</FieldLabel>
        <ChipGroup>
          {GENRES.map(genre => (
            <Chip key={genre} label={genre} selected={genres.includes(genre)} onPress={() => toggle(genre)} />
          ))}
        </ChipGroup>
        <FieldLabel>One-line summary</FieldLabel>
        <TextField
          value={logline}
          onChangeText={setLogline}
          maxLength={LIMITS.logline}
          multiline
          textAlignVertical="top"
          inputClassName="min-h-20"
          placeholder="Who is it about and what do they want?"
          accessibilityLabel="One-line summary"
        />
        <Text variant="caption" tone="muted" className="self-end">
          {logline.length}/{LIMITS.logline}
        </Text>
        <Button title="Save" onPress={save} disabled={!title.trim()} />
      </View>
    </Sheet>
  );
}
