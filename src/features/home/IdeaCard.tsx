import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { Plus, Sparkles } from 'lucide-react-native';

import { suggestStory, type StoryIdea } from '../../core/ai/story';
import { LIMITS } from '../../core/model/constants';
import { pickIdeas } from '../../core/story/ideas';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { aiConfigured, useSettings } from '../../state/useSettings';
import { AiErrorBox, AiLoading, Button, Card, Chip, ChipRow, Text, TextField, confirm } from '../../ui';

export function IdeaCard({ empty }: { empty: boolean }) {
  const navigation = useAppNavigation();
  const favoriteGenres = useSettings(s => s.favoriteGenres);
  const [idea, setIdea] = useState('');
  const { state: ai, start, cancel, reset } = useAiTask<StoryIdea>();
  const aiIdea = useRef('');

  useFocusEffect(useCallback(() => cancel, [cancel]));

  const ideas = useMemo(() => pickIdeas(favoriteGenres), [favoriteGenres]);
  const trimmed = idea.trim();
  const aiLoading = ai.status === 'loading';

  const openProfile = () => navigation.navigate('Tabs', { screen: 'Profile' });

  const startFromIdea = () => {
    if (!trimmed) {
      return;
    }
    navigation.navigate('NewProject', { idea: trimmed });
    setIdea('');
  };

  const shapeWithAi = async (source: string) => {
    if (!source) {
      return;
    }
    if (!aiConfigured()) {
      const go = await confirm(
        'Set up AI first',
        'Shaping an idea needs an AI server. Add its address in Profile, then come back and try again.',
        { confirmText: 'Open Profile' },
      );
      if (go) {
        openProfile();
      }
      return;
    }
    Keyboard.dismiss();
    aiIdea.current = source;
    const draft = await start(signal => suggestStory(source, signal));
    if (!draft) {
      return;
    }
    navigation.navigate('NewProject', { idea: source, draft });
    setIdea(value => (value.trim() === source ? '' : value));
  };

  return (
    <Card className="gap-3 p-3">
      <TextField
        value={idea}
        onChangeText={setIdea}
        placeholder="E.g. A girl finds a pen that makes whatever she draws real…"
        accessibilityLabel="Story idea"
        maxLength={LIMITS.logline}
        multiline
        textAlignVertical="top"
        inputClassName={empty ? 'min-h-[120px]' : 'min-h-16'}
      />
      <Text variant="caption" tone="muted" className="self-end">
        {idea.length}/{LIMITS.logline}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          title="Shape with AI"
          variant="ai"
          icon={Sparkles}
          onPress={() => shapeWithAi(trimmed)}
          disabled={!trimmed || aiLoading}
          small={!empty}
          className="grow"
        />
        <Button
          title="Create story"
          icon={Plus}
          onPress={startFromIdea}
          disabled={!trimmed}
          small={!empty}
          className="grow"
        />
      </View>
      {aiLoading && <AiLoading label="Shaping your idea…" onCancel={cancel} />}
      {ai.status === 'error' && (
        <>
          <AiErrorBox message={ai.message} onRetry={() => shapeWithAi(aiIdea.current)} onCancel={reset} />
          {ai.code === 'not-configured' && <Button title="Open Profile" variant="secondary" small onPress={openProfile} />}
        </>
      )}
      <ChipRow>
        {ideas.map(sample => (
          <Chip key={sample} label={sample} onPress={() => setIdea(sample)} />
        ))}
      </ChipRow>
    </Card>
  );
}
