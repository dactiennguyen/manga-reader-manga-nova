import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { RefreshIcon, SettingsIcon } from '../../ui/icons';

import { scriptText, storyBrief } from '../../core/ai/context';
import { changeVoice, continueScript, rewriteBlocks, shortenLine, suggestSfx, type BlockDraft } from '../../core/ai/writing';
import { t } from '../../core/i18n';
import { BLOCK_LABEL } from '../../core/model/constants';
import type { Character, ID, Scene } from '../../core/model/types';
import {
  MAX_SCENE_REWRITE,
  actionAvailability,
  findBlock,
  nextBlockId,
  rewriteTargets,
  type AiAction,
  type RewriteScope,
  type TextChange,
} from '../../core/script/aiDrafts';
import { useCharacters } from '../../state/hooks';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { AiErrorBox, AiLoading, Button, Sheet, Text } from '../../ui';
import { useSheetClose } from '../outline/AiParts';
import { Footer } from './AiDraftViews';
import { AI_TITLE, AiActionMenu, AiRewriteForm } from './AiForms';
import { AiResultView, type AiResult } from './AiResultView';

function snippet(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
}

/** Accepting a draft closes the sheet first, so the script scrolls and focuses after it has gone. */
export function AiWriteSheet({
  chapterId,
  projectId,
  blockId,
  initialAction,
  onClose,
  onInsert,
  onReplace,
  onOpenProfile,
}: {
  chapterId: ID;
  projectId: ID;
  blockId: ID | null;
  initialAction?: AiAction;
  onClose: () => void;
  onInsert: (afterBlockId: ID | null, drafts: BlockDraft[]) => void;
  onReplace: (changes: TextChange[]) => void;
  onOpenProfile: () => void;
}) {
  const configured = useAiConfigured();
  const sheet = useSheetClose(onClose);
  const sceneIds = useStory(s => s.chapters[chapterId]?.sceneIds);
  const allScenes = useStory(s => s.scenes);
  const scenes = useMemo(
    () => (sceneIds ?? []).map(id => allScenes[id]).filter((scene): scene is Scene => Boolean(scene)),
    [sceneIds, allScenes],
  );
  const characters = useCharacters(projectId);
  const charactersById = useMemo(
    () => Object.fromEntries(characters.map(character => [character.id, character])) as Record<ID, Character>,
    [characters],
  );
  const location = useMemo(() => findBlock(scenes, blockId), [scenes, blockId]);
  const speaker = location?.block.characterId ? charactersById[location.block.characterId] : undefined;
  const available = actionAvailability(location, !!speaker);
  const sceneTooBig = !!location && location.scene.blocks.length > MAX_SCENE_REWRITE;
  const blockHasText = !!location?.block.text.trim();
  const [action, setAction] = useState<AiAction | null>(initialAction && available[initialAction] ? initialAction : null);
  const [scope, setScope] = useState<RewriteScope>(blockHasText || sceneTooBig ? 'block' : 'scene');
  const [instruction, setInstruction] = useState('');
  const { state, start, cancel, reset } = useAiTask<AiResult>();
  const autoStarted = useRef(false);

  const run = useCallback(
    (which: AiAction, options: { scope: RewriteScope; instruction: string }) => {
      const store = useStory.getState();
      const brief = storyBrief(store, projectId, { chapterId }).text;
      if (which === 'continue') {
        const until = location ? nextBlockId(scenes, location.block.id) : undefined;
        const script = scriptText(store, chapterId, { untilBlockId: until });
        start(async signal => ({ kind: 'continue', drafts: await continueScript(brief, script, characters, signal) }));
        return;
      }
      if (!location) {
        return;
      }
      if (which === 'rewrite') {
        const targets = rewriteTargets(location, options.scope);
        start(async signal => ({
          kind: 'rewrite',
          targets,
          drafts: await rewriteBlocks(brief, targets, charactersById, options.instruction.trim(), signal),
        }));
      } else if (which === 'voice' && speaker) {
        start(async signal => ({ kind: 'line', text: await changeVoice(brief, location.block.text, speaker, signal) }));
      } else if (which === 'shorten') {
        start(async signal => ({ kind: 'line', text: await shortenLine(location.block.text, signal) }));
      } else if (which === 'sfx') {
        start(async signal => ({ kind: 'sfx', words: await suggestSfx(location.block.text, signal) }));
      }
    },
    [chapterId, projectId, location, scenes, characters, charactersById, speaker, start],
  );

  useEffect(() => {
    if (action && action !== 'rewrite' && configured && !autoStarted.current) {
      autoStarted.current = true;
      run(action, { scope, instruction });
    }
  }, [action, configured, run, scope, instruction]);

  const choose = (which: AiAction) => {
    autoStarted.current = true;
    reset();
    setAction(which);
    if (which !== 'rewrite') {
      run(which, { scope, instruction });
    }
  };

  const back = () => {
    cancel();
    reset();
    setAction(null);
  };

  const retry = () => {
    if (action) {
      run(action, { scope, instruction });
    }
  };

  const loadingLabel = (): string => {
    if (action === 'continue') {
      return t('Writing the next blocks…');
    }
    if (action === 'rewrite') {
      return scope === 'scene' ? t('Rewriting the scene…') : t('Rewriting the block…');
    }
    if (action === 'voice') {
      return speaker?.name
        ? t("Rewriting in {name}'s voice…", { name: speaker.name })
        : t("Rewriting in the character's voice…");
    }
    if (action === 'shorten') {
      return t('Shortening the line…');
    }
    return t('Thinking of sounds…');
  };

  const renderBody = () => {
    if (!configured) {
      return (
        <View className="gap-3 px-4 pb-4">
          <Text tone="secondary">{t('Writing help needs an AI server. Set its address in Profile first.')}</Text>
          <Button title={t('Open Profile')} icon={SettingsIcon} variant="ai" onPress={() => sheet.closeThen(onOpenProfile)} />
        </View>
      );
    }
    if (action === null) {
      return (
        <AiActionMenu
          location={location}
          speakerName={speaker?.name}
          available={available}
          onChoose={choose}
        />
      );
    }
    if (state.status === 'loading') {
      return <AiLoading label={loadingLabel()} onCancel={action === 'rewrite' ? cancel : back} />;
    }
    if (state.status === 'error') {
      return (
        <View className="px-4 pb-4">
          <AiErrorBox message={state.message} onRetry={retry} onCancel={back} />
        </View>
      );
    }
    if (state.status === 'done') {
      return (
        <AiResultView
          result={state.data}
          action={action}
          location={location}
          speaker={speaker}
          instruction={instruction}
          charactersById={charactersById}
          onInsert={(after, drafts) => sheet.closeThen(() => onInsert(after, drafts))}
          onReplace={changes => sheet.closeThen(() => onReplace(changes))}
          onRetry={retry}
          onDiscard={back}
        />
      );
    }
    if (action === 'rewrite') {
      return (
        <AiRewriteForm
          blockHasText={blockHasText}
          sceneTooBig={sceneTooBig}
          scope={scope}
          instruction={instruction}
          onScope={setScope}
          onInstruction={setInstruction}
          onSubmit={() => run('rewrite', { scope, instruction })}
        />
      );
    }
    return (
      <Footer>
        <Button title={t('Try again')} icon={RefreshIcon} variant="ai" onPress={retry} />
        <Button title={t('Back')} variant="ghost" onPress={back} />
      </Footer>
    );
  };

  const subtitle = location
    ? `${t(BLOCK_LABEL[location.block.type])}${speaker ? ` · ${speaker.name}` : ''}${
        location.block.text.trim() ? ` · ${snippet(location.block.text)}` : ''
      }`
    : t('End of the script');

  return (
    <Sheet
      visible={sheet.visible}
      onClose={sheet.close}
      onClosed={sheet.onClosed}
      title={action ? t(AI_TITLE[action]) : t('AI writing help')}
      subtitle={subtitle}
      right={action !== null && configured ? <Button title={t('Back')} variant="ghost" small onPress={back} /> : undefined}
      scroll={false}
      maxHeight="90%"
    >
      {renderBody()}
    </Sheet>
  );
}
