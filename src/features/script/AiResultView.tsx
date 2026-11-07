import { ScrollView, View } from 'react-native';
import { Check, RefreshCw } from 'lucide-react-native';

import type { BlockDraft } from '../../core/ai/writing';
import { BLOCK_LABEL, LIMITS } from '../../core/model/constants';
import type { Block, Character, ID } from '../../core/model/types';
import { pairRewrite, type AiAction, type BlockLocation, type TextChange } from '../../core/script/aiDrafts';
import { plural } from '../../core/util/format';
import { AiNote, Button, Pressable, Text } from '../../ui';
import { BeforeAfter, DraftBlockView, Footer } from './AiDraftViews';

export type AiResult =
  | { kind: 'continue'; drafts: BlockDraft[] }
  | { kind: 'rewrite'; targets: Block[]; drafts: BlockDraft[] }
  | { kind: 'line'; text: string }
  | { kind: 'sfx'; words: string[] };

function RetryRow({ onRetry, onDiscard }: { onRetry: () => void; onDiscard: () => void }) {
  return (
    <View className="flex-row gap-2">
      <Button title="Try again" icon={RefreshCw} variant="secondary" onPress={onRetry} className="flex-1" />
      <Button title="Discard" variant="ghost" onPress={onDiscard} className="flex-1" />
    </View>
  );
}

/** Nothing here touches the script: every button hands a draft back to the screen. */
export function AiResultView({
  result,
  action,
  location,
  speaker,
  instruction,
  charactersById,
  onInsert,
  onReplace,
  onRetry,
  onDiscard,
}: {
  result: AiResult;
  action: AiAction | null;
  location: BlockLocation | undefined;
  speaker: Character | undefined;
  instruction: string;
  charactersById: Record<ID, Character>;
  onInsert: (afterBlockId: ID | null, drafts: BlockDraft[]) => void;
  onReplace: (changes: TextChange[]) => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  if (result.kind === 'continue') {
    return (
      <>
        <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
          <AiNote text={location ? 'Inserted after the focused block' : 'Inserted at the end of the script'} />
          {result.drafts.map((draft, index) => (
            <DraftBlockView key={index} draft={draft} character={draft.characterId ? charactersById[draft.characterId] : undefined} />
          ))}
        </ScrollView>
        <Footer>
          <Button
            title={`Insert ${plural(result.drafts.length, 'block')}`}
            icon={Check}
            onPress={() => onInsert(location?.block.id ?? null, result.drafts)}
          />
          <RetryRow onRetry={onRetry} onDiscard={onDiscard} />
        </Footer>
      </>
    );
  }
  if (result.kind === 'rewrite') {
    const pairs = pairRewrite(result.targets, result.drafts);
    const byId = new Map(result.targets.map(target => [target.id, target]));
    const mismatch = result.drafts.length !== result.targets.length;
    return (
      <>
        <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
          <AiNote text={instruction.trim() ? `Rewritten to be ${instruction.trim()}` : 'Rewritten for rhythm and clarity'} />
          {mismatch && (
            <Text variant="caption" tone="warning">
              The AI answered with {plural(result.drafts.length, 'block')} for {plural(result.targets.length, 'block')}. Blocks
              without a match keep their text.
            </Text>
          )}
          {pairs.map(pair => {
            const target = byId.get(pair.id);
            const name = target?.characterId ? charactersById[target.characterId]?.name : undefined;
            return (
              <BeforeAfter
                key={pair.id}
                label={target ? `${BLOCK_LABEL[target.type]}${name ? ` · ${name}` : ''}` : undefined}
                before={target?.text ?? ''}
                after={pair.text}
              />
            );
          })}
          {!pairs.length && <Text tone="muted">The AI returned nothing usable.</Text>}
        </ScrollView>
        <Footer>
          <Button
            title={pairs.length > 1 ? `Replace ${plural(pairs.length, 'block')}` : 'Replace'}
            icon={Check}
            disabled={!pairs.length}
            onPress={() => onReplace(pairs)}
          />
          <RetryRow onRetry={onRetry} onDiscard={onDiscard} />
        </Footer>
      </>
    );
  }
  if (result.kind === 'line') {
    const length = result.text.length;
    const note =
      action === 'voice'
        ? `In ${speaker?.name || 'the character'}'s voice`
        : length <= LIMITS.longDialogue
        ? `${length} characters, fits a bubble`
        : `${length} characters, still over ${LIMITS.longDialogue}`;
    return (
      <>
        <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
          <AiNote text={note} />
          <BeforeAfter
            label={speaker ? `${BLOCK_LABEL.dialogue} · ${speaker.name}` : BLOCK_LABEL.dialogue}
            before={location?.block.text ?? ''}
            after={result.text}
          />
        </ScrollView>
        <Footer>
          <Button
            title="Replace"
            icon={Check}
            disabled={!location}
            onPress={() => location && onReplace([{ id: location.block.id, text: result.text }])}
          />
          <RetryRow onRetry={onRetry} onDiscard={onDiscard} />
        </Footer>
      </>
    );
  }
  return (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
        <AiNote text="Tap a sound to add it after the action" />
        <Text tone="secondary">{location?.block.text}</Text>
        <View className="flex-row flex-wrap gap-2">
          {result.words.map(word => (
            <Pressable
              key={word}
              accessibilityLabel={`Add ${word}`}
              onPress={() => location && onInsert(location.block.id, [{ type: 'sfx', text: word }])}
              className="min-h-12 justify-center overflow-hidden rounded-md bg-surface px-4"
            >
              <Text variant="title">{word}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Footer>
        <RetryRow onRetry={onRetry} onDiscard={onDiscard} />
      </Footer>
    </>
  );
}
