import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { BackHandler, Keyboard, type ScrollView } from 'react-native';

import { suggestStory, type StoryIdea } from '../../core/ai/story';
import { t } from '../../core/i18n';
import { LIMITS } from '../../core/model/constants';
import type { ArtStyle } from '../../core/model/types';
import { FORMATS, genresFavoritesFirst, knownGenres, titleTaken, type FormatKey } from '../../core/story/newProject';
import { applyStarter, starterFits, starterOf, type StarterKey } from '../../core/story/starters';
import type { ScreenProps } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useSettings } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { confirm, toast } from '../../ui';

export function useNewProject({ navigation, route }: ScreenProps<'NewProject'>) {
  const idea = route.params?.idea?.trim() ?? '';
  const draft = route.params?.draft;
  const favoriteGenres = useSettings(s => s.favoriteGenres);
  const defaultStyle = useSettings(s => s.defaultStyle);
  const projects = useStory(s => s.projects);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(() => (draft?.title ?? '').trim().slice(0, LIMITS.projectTitle));
  const [genres, setGenres] = useState<string[]>(() => knownGenres(draft?.genres));
  const [logline, setLogline] = useState(() => (draft?.logline?.trim() || idea).slice(0, LIMITS.logline));
  const [aiFilled, setAiFilled] = useState(!!draft);
  const [formatKey, setFormatKey] = useState<FormatKey>('manga-B5');
  const [starterKey, setStarterKey] = useState<StarterKey>('blank');
  const [style, setStyle] = useState<ArtStyle>(defaultStyle);
  const [color, setColor] = useState(false);
  const { state: ai, start, cancel, reset } = useAiTask<StoryIdea>();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const aiStatus = ai.status;
  useEffect(() => {
    if (aiStatus === 'idle') {
      return undefined;
    }
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [aiStatus]);

  const genreList = useMemo(() => genresFavoritesFirst(favoriteGenres), [favoriteGenres]);
  const name = title.trim();
  const duplicate = useMemo(() => titleTaken(projects, name), [projects, name]);
  const format = FORMATS.find(item => item.key === formatKey) ?? FORMATS[0];
  const dirty = !!name || genres.length > 0 || logline.trim() !== idea.slice(0, LIMITS.logline) || step > 0;

  const close = useCallback(async () => {
    if (
      dirty &&
      !(await confirm(t('Discard this new story?'), t('What you entered will not be saved.'), {
        confirmText: t('Discard'),
        destructive: true,
      }))
    ) {
      return;
    }
    navigation.goBack();
  }, [dirty, navigation]);

  const back = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      close();
    }
  }, [step, close]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => subscription.remove();
    }, [back]),
  );

  const editTitle = (value: string) => {
    setTitle(value);
    setAiFilled(false);
  };

  const editLogline = (value: string) => {
    setLogline(value);
    setAiFilled(false);
  };

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter(item => item !== genre));
      setAiFilled(false);
    } else if (genres.length >= LIMITS.genresPerProject) {
      toast(t('Pick up to {max} genres', { max: LIMITS.genresPerProject }));
    } else {
      setGenres([...genres, genre]);
      setAiFilled(false);
    }
  };

  const aiSource = logline.trim() || name;

  const suggest = () => {
    if (!aiSource) {
      return;
    }
    Keyboard.dismiss();
    start(signal => suggestStory(aiSource, signal));
  };

  const acceptSuggestion = (suggestion: StoryIdea) => {
    const picked = knownGenres(suggestion.genres);
    setTitle(suggestion.title.slice(0, LIMITS.projectTitle));
    setLogline(suggestion.logline.slice(0, LIMITS.logline));
    if (picked.length) {
      setGenres(picked);
    }
    setAiFilled(true);
    reset();
  };

  /** Picking a starter also picks the format it was laid out for. */
  const pickStarter = (key: StarterKey) => {
    const starter = starterOf(key);
    setStarterKey(key);
    if (starter.formatKey && !starterFits(starter, formatKey)) {
      setFormatKey(starter.formatKey);
    }
  };

  const pickFormat = (key: FormatKey) => {
    setFormatKey(key);
    if (!starterFits(starterOf(starterKey), key)) {
      setStarterKey('blank');
    }
  };

  const next = () => {
    if (step === 0 && !name) {
      toast(t('Give your story a title'));
      return;
    }
    if (ai.status === 'loading') {
      cancel();
    }
    setStep(step + 1);
  };

  const create = () => {
    const projectId = useStory.getState().createProject({
      title: name,
      genres,
      logline: logline.trim(),
      format: format.format,
      pageSize: format.pageSize,
      style,
      color,
    });
    applyStarter(() => useStory.getState(), projectId, starterOf(starterKey));
    navigation.replace('Project', { projectId });
  };

  return {
    idea,
    draft,
    step,
    title,
    name,
    duplicate,
    genres,
    genreList,
    logline,
    aiFilled,
    aiSource,
    ai,
    format,
    formatKey,
    starterKey,
    style,
    color,
    scroller,
    setFormatKey: pickFormat,
    pickStarter,
    setStyle,
    setColor,
    editTitle,
    editLogline,
    toggleGenre,
    suggest,
    acceptSuggestion,
    cancelAi: cancel,
    resetAi: reset,
    close,
    back,
    next,
    create,
  };
}

export type NewProjectForm = ReturnType<typeof useNewProject>;
