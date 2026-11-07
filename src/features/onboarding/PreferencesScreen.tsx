import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { Brush, PenLine, Star } from 'lucide-react-native';

import { GENRES, LIMITS } from '../../core/model/constants';
import type { ScreenProps } from '../../state/navigation';
import { DEFAULT_SETTINGS, useSettings, type CreatorRole } from '../../state/useSettings';
import { AppBar, Button, Chip, ChipGroup, Icon, ProgressBar, Screen, Text, toast, type LucideIcon } from '../../ui';
import { OptionCard } from './OptionCard';
import { StylePicker } from './StylePicker';

const STEP_COUNT = 3;
const STEP_OFFSET = 2;

const ROLES: { id: CreatorRole; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'write', label: 'Write stories', hint: 'I have ideas and want to turn them into a script', icon: PenLine },
  { id: 'draw', label: 'Draw', hint: 'I want to open a canvas and start drawing', icon: Brush },
  { id: 'both', label: 'Both', hint: 'I write and draw my own stories', icon: Star },
];

const QUESTIONS = [
  { title: 'What do you want to do?', hint: 'Pick one.' },
  { title: 'Which genres do you like?', hint: `Pick up to ${LIMITS.favoriteGenres}.` },
  { title: 'Which art style do you like?', hint: 'Pick one. It becomes the default for new stories.' },
];

function clampStep(step: number): number {
  return Math.min(STEP_COUNT - 1, Math.max(0, step));
}

export function PreferencesScreen({ navigation, route }: ScreenProps<'Preferences'>) {
  const edit = !!route.params?.edit;
  const role = useSettings(s => s.role);
  const favoriteGenres = useSettings(s => s.favoriteGenres);
  const defaultStyle = useSettings(s => s.defaultStyle);
  const [step, setStepState] = useState(() =>
    edit ? 0 : clampStep(useSettings.getState().onboardingStep - STEP_OFFSET),
  );

  const setStep = useCallback(
    (next: number) => {
      setStepState(next);
      if (!edit) {
        useSettings.getState().set({ onboardingStep: next + STEP_OFFSET });
      }
    },
    [edit],
  );

  useEffect(() => {
    if (!edit && useSettings.getState().onboardingStep < STEP_OFFSET) {
      useSettings.getState().set({ onboardingStep: STEP_OFFSET });
    }
  }, [edit]);

  const leave = useCallback(() => {
    if (!edit) {
      useSettings.getState().set({ onboardingStep: 0 });
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  }, [edit, navigation]);

  const onBack = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      leave();
    }
  }, [leave, setStep, step]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => subscription.remove();
    }, [onBack]),
  );

  const finish = (useDefaults: boolean) => {
    if (edit) {
      navigation.goBack();
      return;
    }
    useSettings.getState().set({
      ...(useDefaults
        ? {
            role: DEFAULT_SETTINGS.role,
            favoriteGenres: DEFAULT_SETTINGS.favoriteGenres,
            defaultStyle: DEFAULT_SETTINGS.defaultStyle,
          }
        : null),
      onboarded: true,
      onboardingStep: 0,
    });
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  const onNext = () => {
    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
    } else {
      finish(false);
    }
  };

  const toggleGenre = (genre: string) => {
    if (favoriteGenres.includes(genre)) {
      useSettings.getState().set({ favoriteGenres: favoriteGenres.filter(item => item !== genre) });
      return;
    }
    if (favoriteGenres.length >= LIMITS.favoriteGenres) {
      toast(`Up to ${LIMITS.favoriteGenres} genres`);
      return;
    }
    useSettings.getState().set({ favoriteGenres: [...favoriteGenres, genre] });
  };

  const question = QUESTIONS[step];

  return (
    <Screen padded={false}>
      <AppBar
        onBack={onBack}
        right={edit ? undefined : <Button title="Skip" variant="ghost" small onPress={() => finish(true)} />}
      >
        <View className="flex-row items-center gap-3 pr-2">
          <View className="flex-1">
            <ProgressBar value={(step + 1) / STEP_COUNT} />
          </View>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {`${step + 1}/${STEP_COUNT}`}
          </Text>
        </View>
      </AppBar>
      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-[560px] gap-4 self-center p-4">
        <View className="gap-1">
          <Text variant="display" accessibilityRole="header">
            {question.title}
          </Text>
          <Text tone="secondary">{question.hint}</Text>
        </View>

        {step === 0 && (
          <View accessibilityRole="radiogroup" className="gap-3">
            {ROLES.map(item => (
              <OptionCard
                key={item.id}
                label={item.label}
                hint={item.hint}
                selected={role === item.id}
                onPress={() => useSettings.getState().set({ role: item.id })}
                left={<Icon icon={item.icon} size={26} color={role === item.id ? 'accent' : 'text'} />}
              />
            ))}
          </View>
        )}

        {step === 1 && (
          <View className="gap-2">
            <ChipGroup>
              {GENRES.map(genre => (
                <Chip
                  key={genre}
                  label={genre}
                  selected={favoriteGenres.includes(genre)}
                  onPress={() => toggleGenre(genre)}
                />
              ))}
            </ChipGroup>
            <Text variant="caption" tone="muted">
              {favoriteGenres.length}/{LIMITS.favoriteGenres} selected
            </Text>
          </View>
        )}

        {step === 2 && (
          <StylePicker value={defaultStyle} onChange={style => useSettings.getState().set({ defaultStyle: style })} />
        )}
      </ScrollView>
      <View className="p-4">
        <Button title={step < STEP_COUNT - 1 ? 'Next' : 'Done'} onPress={onNext} />
      </View>
    </Screen>
  );
}
