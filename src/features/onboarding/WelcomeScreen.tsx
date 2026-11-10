import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { msg, t } from '../../core/i18n';
import { useAppNavigation } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { Button, Screen, Text } from '../../ui';
import { WelcomeArt, type WelcomeArtKind } from './WelcomeArt';

const SLIDES: { kind: WelcomeArtKind; title: string; text: string }[] = [
  {
    kind: 'draw',
    title: msg('Draw your manga'),
    text: msg('Sketch and ink on your phone with pens, layers and panels made for comics.'),
  },
  {
    kind: 'write',
    title: msg('Plan it your way'),
    text: msg('Start with a sketch or a script, then map out your pages on the storyboard.'),
  },
  {
    kind: 'finish',
    title: msg('Finish a full chapter'),
    text: msg('Lay out panels, letter your dialogue, and export a file to share.'),
  },
];

let resumeChecked = false;

export function WelcomeScreen() {
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (resumeChecked) {
      return;
    }
    resumeChecked = true;
    if (useSettings.getState().onboardingStep >= 1) {
      navigation.reset({ index: 1, routes: [{ name: 'Welcome' }, { name: 'Preferences' }] });
    }
  }, [navigation]);

  const goPreferences = () => {
    useSettings.getState().set({ onboardingStep: 1 });
    navigation.navigate('Preferences');
  };

  const onNext = () => {
    if (index >= SLIDES.length - 1) {
      goPreferences();
      return;
    }
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    setIndex(Math.min(SLIDES.length - 1, Math.max(0, next)));
  };

  return (
    <Screen padded={false}>
      <View className="h-14 flex-row items-center justify-end px-2">
        <Button title={t('Skip')} variant="ghost" small onPress={goPreferences} />
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        className="flex-1"
        contentContainerClassName="grow"
      >
        {SLIDES.map(slide => (
          <View key={slide.kind} className="gap-6 px-6 pb-2" style={{ width }}>
            <WelcomeArt kind={slide.kind} />
            <View className="min-h-28 gap-2">
              <Text variant="display" accessibilityRole="header">
                {t(slide.title)}
              </Text>
              <Text tone="secondary" numberOfLines={2}>
                {t(slide.text)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View
        accessible
        accessibilityLabel={t('Slide {n} of {total}', { n: index + 1, total: SLIDES.length })}
        className="flex-row justify-center gap-2 py-3"
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.kind} className={`h-2 rounded-full ${i === index ? 'w-6 bg-accent' : 'w-2 bg-control-border'}`} />
        ))}
      </View>
      <View className="px-6 pb-4">
        <Button title={t('Get started')} onPress={onNext} />
      </View>
    </Screen>
  );
}
