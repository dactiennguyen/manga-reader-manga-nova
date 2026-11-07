import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { AiIcon, CheckIcon, CircleIcon, DoneIcon } from '../../ui/icons';

import { storyBrief } from '../../core/ai/context';
import { translateLines } from '../../core/ai/translate';
import { bubblesInOrder, coalesceTag } from '../../core/lettering/bubbleEdit';
import { hasTranslation, setTranslation, translatableBubbles } from '../../core/lettering/translation';
import { groupProposals, translationTargets, type Proposal, type TranslateMode } from '../../core/lettering/translationPlan';
import { BUBBLE_TYPE_LABEL } from '../../core/model/constants';
import type { Bubble, Chapter, ID, Project } from '../../core/model/types';
import { plural } from '../../core/util/format';
import { buildPageContext } from '../../render/drawPage';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { undoable, useStory } from '../../state/useStory';
import { AiErrorBox, AiLoading, AiNote, AiPanel, Button, Card, Icon, Segmented, Sheet, Text, TextField, toast } from '../../ui';
import { progressLabel } from './Languages';

type Section = { pageId: ID; number: number; bubbles: Bubble[] };

const SCOPES = [
  { value: 'page', label: 'This page' },
  { value: 'chapter', label: 'Whole chapter' },
] as const;

function writeOtherPage(pageId: ID, entries: Record<ID, string>, lang: string, tag?: string): void {
  const page = useStory.getState().pages[pageId];
  if (page) {
    undoable({ undoScope: `page:${pageId}`, coalesceKey: tag, typing: !!tag }, () =>
      useStory.getState().updatePage(pageId, {
        bubbles: page.bubbles.map(bubble =>
          entries[bubble.id] !== undefined ? setTranslation(bubble, lang, entries[bubble.id]) : bubble,
        ),
      }),
    );
  }
}

export function TranslationSheet({
  visible,
  onClose,
  lang,
  project,
  chapter,
  pageId,
  onChangeCurrent,
  onApplyCurrent,
}: {
  visible: boolean;
  onClose: () => void;
  lang: string;
  project: Project;
  chapter: Chapter;
  pageId: ID;
  onChangeCurrent: (bubbleId: ID, text: string) => void;
  onApplyCurrent: (entries: Record<ID, string>) => void;
}) {
  const navigation = useAppNavigation();
  const configured = useAiConfigured();
  const [scope, setScope] = useState<'page' | 'chapter'>('page');
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const { state: ai, start, cancel, reset } = useAiTask<string[]>();
  const lastMode = useRef<TranslateMode>('missing');
  const pages = useStory(s => s.pages);
  const shown = useRef(new Set<ID>());
  useEffect(() => {
    if (!visible) {
      cancel();
      setProposals(null);
    }
  }, [visible, cancel]);
  const sections = useMemo<Section[]>(() => {
    if (!visible) {
      shown.current.clear();
      return [];
    }
    const ids = scope === 'chapter' ? chapter.pageIds : [pageId];
    return ids.flatMap(id => {
      const page = pages[id];
      if (!page) {
        return [];
      }
      const ctx = buildPageContext(page, project);
      const ordered = bubblesInOrder(page.bubbles, ctx.shapes, ctx.rtl);
      const listed = new Set(translatableBubbles(ordered, lang).map(bubble => bubble.id));
      // A row whose text was just cleared stays, or it would vanish under the writer's cursor.
      listed.forEach(bubbleId => shown.current.add(bubbleId));
      const bubbles = ordered.filter(bubble => listed.has(bubble.id) || shown.current.has(bubble.id));
      return [{ pageId: id, number: chapter.pageIds.indexOf(id) + 1, bubbles }];
    });
  }, [visible, scope, chapter, pageId, pages, project, lang]);
  const all = sections.flatMap(section => section.bubbles);
  const missing = translationTargets(sections, lang, 'missing').length;
  const translatable = translationTargets(sections, lang, 'all').length;

  const change = (section: Section, bubbleId: ID, text: string) => {
    if (section.pageId === pageId) {
      onChangeCurrent(bubbleId, text);
    } else {
      writeOtherPage(section.pageId, { [bubbleId]: text }, lang, coalesceTag(0, bubbleId, `lang:${lang}`));
    }
  };

  const translate = (mode: TranslateMode) => {
    const items = translationTargets(sections, lang, mode);
    if (!items.length) {
      toast(mode === 'missing' ? 'Every bubble here is already translated' : 'Nothing to translate');
      return;
    }
    lastMode.current = mode;
    setBusyCount(items.length);
    const brief = storyBrief(useStory.getState(), project.id, { chapterId: chapter.id }).text;
    start(signal =>
      translateLines(
        items.map(item => item.original),
        lang,
        brief,
        signal,
      ),
    ).then(lines => {
      if (lines) {
        setProposals(items.map((item, index) => ({ ...item, text: lines[index] ?? '' })));
        reset();
      }
    });
  };

  const editProposal = (index: number, text: string) =>
    setProposals(list => (list ? list.map((item, i) => (i === index ? { ...item, text } : item)) : list));

  const apply = () => {
    if (!proposals) {
      return;
    }
    const { current, others } = groupProposals(proposals, pageId);
    const currentIds = Object.keys(current);
    if (currentIds.length) {
      onApplyCurrent(current);
    }
    Object.entries(others).forEach(([otherPageId, entries]) => writeOtherPage(otherPageId, entries, lang));
    const count = currentIds.length + Object.values(others).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
    setProposals(null);
    toast(count ? `Applied ${plural(count, 'translation')}` : 'Nothing to apply');
  };

  const openProfile = () => {
    onClose();
    navigation.navigate('Tabs', { screen: 'Profile' });
  };

  const pageNumber = (id: ID) => sections.find(section => section.pageId === id)?.number ?? 1;

  const renderAi = () => {
    if (translatable === 0) {
      return null;
    }
    if (!configured) {
      return (
        <View className="gap-2">
          <AiNote text="Translate with AI" />
          <Text variant="caption" tone="secondary" className="text-center">
            Set the AI server address in Profile to translate bubbles automatically.
          </Text>
          <Button title="Open Profile" variant="secondary" small onPress={openProfile} />
        </View>
      );
    }
    if (ai.status === 'loading') {
      return <AiLoading label={`Translating ${plural(busyCount, 'bubble')} into ${lang}…`} onCancel={cancel} />;
    }
    if (ai.status === 'error') {
      return <AiErrorBox message={ai.message} onRetry={() => translate(lastMode.current)} onCancel={reset} />;
    }
    return (
      <View className="gap-2">
        <Button
          title={missing ? `Translate missing with AI (${missing})` : 'Translate missing with AI'}
          icon={AiIcon}
          variant="ai"
          disabled={missing === 0}
          onPress={() => translate('missing')}
        />
        <Button title={`Translate all (${translatable})`} variant="ghost" small onPress={() => translate('all')} className="self-center" />
      </View>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Translate to ${lang}`} subtitle={progressLabel(all, lang)}>
      <View className="gap-3 p-4">
        {chapter.pageIds.length > 1 && !proposals && <Segmented options={SCOPES} value={scope} onChange={setScope} />}
        {all.length === 0 && (
          <Text variant="caption" tone="secondary" className="text-center">
            There is no text to translate here yet. Add bubbles first.
          </Text>
        )}
        {proposals ? (
          <AiPanel title={plural(proposals.length, 'proposed translation')}>
            <Text variant="caption" tone="secondary">
              Edit anything below. Nothing is written to the page until you apply.
            </Text>
            {proposals.map((item, index) => (
              <Card key={item.bubbleId} className="gap-2 p-3">
                <Text variant="caption" tone="secondary">
                  {scope === 'chapter' ? `Page ${pageNumber(item.pageId)} · ${index + 1}` : `${index + 1}`}
                </Text>
                <Text>{item.original}</Text>
                <TextField multiline value={item.text} placeholder={`${lang} text`} onChangeText={text => editProposal(index, text)} />
              </Card>
            ))}
            <Button title="Apply" icon={CheckIcon} variant="ai" onPress={apply} />
            <Button title="Discard" variant="ghost" onPress={() => setProposals(null)} />
          </AiPanel>
        ) : (
          renderAi()
        )}
        {!proposals &&
          sections.map(section => (
            <View key={section.pageId} className="gap-2">
              {scope === 'chapter' && section.bubbles.length > 0 && <Text variant="label">{`Page ${section.number}`}</Text>}
              {section.bubbles.map((bubble, index) => (
                <Card key={bubble.id} className="gap-2 p-3">
                  <View className="flex-row items-center gap-2">
                    <Icon
                      icon={hasTranslation(bubble, lang) ? DoneIcon : CircleIcon}
                      size={14}
                      color={hasTranslation(bubble, lang) ? 'success' : 'warning'}
                    />
                    <Text variant="caption" tone="secondary">
                      {`${index + 1} · ${BUBBLE_TYPE_LABEL[bubble.type]}`}
                    </Text>
                  </View>
                  <Text>{bubble.text.trim() || '(no original text)'}</Text>
                  <TextField
                    multiline
                    value={bubble.translations?.[lang] ?? ''}
                    placeholder={`${lang} text`}
                    onChangeText={text => change(section, bubble.id, text)}
                  />
                </Card>
              ))}
            </View>
          ))}
        <Button title="Done" onPress={onClose} />
      </View>
    </Sheet>
  );
}
