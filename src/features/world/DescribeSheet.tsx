import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { FilePen, Plus, RefreshCw } from 'lucide-react-native';

import { storyBrief } from '../../core/ai/context';
import { describeWorldEntry } from '../../core/ai/people';
import { WORLD_TYPE_LABEL } from '../../core/model/constants';
import type { ID } from '../../core/model/types';
import { BODY_MAX, appendBody } from '../../core/story/plotHoles';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { Button, Sheet, Text, toast } from '../../ui';
import { AiBusy, AiFailure, AiMark, AiSetupNotice, SheetFooter, useSheetClose } from '../outline/AiParts';

export function DescribeSheet({
  entryId,
  title,
  onClose,
  onApplied,
}: {
  entryId: ID;
  title: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const navigation = useAppNavigation();
  const configured = useAiConfigured();
  const entry = useStory(s => s.world[entryId]);
  const sheet = useSheetClose(onClose);
  const { state, start, cancel } = useAiTask<string>();
  const started = useRef(false);

  const generate = useCallback(() => {
    const store = useStory.getState();
    const current = store.world[entryId];
    if (!current) {
      return;
    }
    const brief = storyBrief(store, current.projectId).text;
    start(signal => describeWorldEntry(brief, current.type, title, current.body.trim(), signal));
  }, [entryId, title, start]);

  useEffect(() => {
    if (configured && !started.current) {
      started.current = true;
      generate();
    }
  }, [configured, generate]);

  if (!entry) {
    return null;
  }

  const hasBody = !!entry.body.trim();

  const openProfile = () => sheet.closeThen(() => navigation.navigate('Tabs', { screen: 'Profile' }));

  const apply = (text: string, mode: 'replace' | 'append') => {
    const store = useStory.getState();
    const current = store.world[entryId];
    if (!current) {
      return;
    }
    const body = mode === 'append' ? appendBody(current.body, text) : text.trim().slice(0, BODY_MAX);
    store.updateWorldEntry(entryId, { body });
    onApplied();
    sheet.close();
    toast(mode === 'append' ? 'Description added to the content' : 'Content replaced');
  };

  const renderBody = () => {
    if (!configured) {
      return <AiSetupNotice onOpenProfile={openProfile} />;
    }
    if (state.status === 'loading') {
      return <AiBusy label={`Writing about ${title}…`} onCancel={cancel} />;
    }
    if (state.status === 'error') {
      return (
        <>
          <AiFailure message={state.message} onRetry={generate} />
          <SheetFooter>
            <Button title="Close" variant="ghost" onPress={sheet.close} />
          </SheetFooter>
        </>
      );
    }
    if (state.status === 'done') {
      const text = state.data;
      return (
        <>
          <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
            <AiMark />
            <Text variant="caption" tone="muted">
              {hasBody
                ? 'Nothing changes until you choose. Replace drops your current content; append keeps it and adds this below.'
                : 'Nothing changes until you choose to use this text.'}
            </Text>
            <View className="rounded-lg bg-surface p-3">
              <Text>{text}</Text>
            </View>
          </ScrollView>
          <SheetFooter>
            <Button
              title={hasBody ? 'Replace content' : 'Use as content'}
              icon={FilePen}
              variant="ai"
              onPress={() => apply(text, 'replace')}
            />
            {hasBody && <Button title="Append" icon={Plus} onPress={() => apply(text, 'append')} />}
            <View className="flex-row gap-2">
              <Button title="Try again" icon={RefreshCw} variant="secondary" onPress={generate} className="flex-1" />
              <Button title="Discard" variant="ghost" onPress={sheet.close} className="flex-1" />
            </View>
          </SheetFooter>
        </>
      );
    }
    return (
      <>
        <View className="px-4 pb-4">
          <Text tone="secondary">
            The AI writes a wiki entry for this {WORLD_TYPE_LABEL[entry.type].toLowerCase()} from its title and your story. You
            preview it before anything is saved.
          </Text>
        </View>
        <SheetFooter>
          <Button title="Write description" variant="ai" onPress={generate} />
        </SheetFooter>
      </>
    );
  };

  return (
    <Sheet
      visible={sheet.visible}
      onClose={sheet.close}
      onClosed={sheet.onClosed}
      title="Write with AI"
      subtitle={title}
      scroll={false}
      maxHeight="90%"
    >
      {renderBody()}
    </Sheet>
  );
}
