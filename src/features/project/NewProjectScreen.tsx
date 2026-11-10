import { ScrollView, View } from 'react-native';
import { CloseIcon, ForwardIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import type { ScreenProps } from '../../state/navigation';
import { AppBar, Button, IconButton, Screen } from '../../ui';
import { FormatStep, StoryStep, StyleStep } from './NewProjectSteps';
import { useNewProject } from './useNewProject';

export function NewProjectScreen(props: ScreenProps<'NewProject'>) {
  const form = useNewProject(props);
  const { step, name } = form;
  return (
    <Screen padded={false} keyboard>
      <AppBar
        title={t('New story')}
        subtitle={t('Step {n}/{total}', { n: step + 1, total: 3 })}
        onBack={form.back}
        right={<IconButton icon={CloseIcon} onPress={form.close} accessibilityLabel={t('Close')} />}
      />
      <View className="flex-row gap-1 px-4 pt-2">
        {[0, 1, 2].map(index => (
          <View key={index} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-overlay'}`} />
        ))}
      </View>
      <ScrollView
        ref={form.scroller}
        className="flex-1"
        contentContainerClassName="w-full max-w-[680px] gap-4 self-center p-4"
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && <StoryStep form={form} />}
        {step === 1 && <FormatStep form={form} />}
        {step === 2 && <StyleStep form={form} />}
      </ScrollView>
      <View className="flex-row gap-3 p-4">
        {step > 0 && <Button title={t('Back')} variant="secondary" onPress={form.back} />}
        {step < 2 ? (
          <Button title={t('Next')} icon={ForwardIcon} onPress={form.next} disabled={step === 0 && !name} className="flex-1" />
        ) : (
          <Button title={t('Create story')} onPress={form.create} disabled={!name} className="flex-1" />
        )}
      </View>
    </Screen>
  );
}
