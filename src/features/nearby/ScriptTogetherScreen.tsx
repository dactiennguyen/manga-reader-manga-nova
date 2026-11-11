/**
 * Writing a script together: the host picks a chapter, then everyone writes its scenes and lines on their
 * own phone at the same time. The host saves the result into their story.
 */
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { t } from '../../core/i18n';
import { BLOCK_LABEL } from '../../core/model/constants';
import { blockKey, sceneKey, scriptText } from '../../core/nearby/scriptTogether';
import { copyText } from '../../native/files';
import { useAppNavigation } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { AppBar, Banner, Button, EmptyState, Screen, Text, confirm, toast } from '../../ui';
import { CopyIcon, PlusIcon, SaveIcon } from '../../ui/icons';
import { NEARBY_ART } from '../../ui/nearbyArt';
import { inkOf, useMemberNames, useMembers } from './draw/members';
import { scriptSession, useScriptTogether } from './draw/sessions';
import { chapterDoc, saveDoc } from './script/scriptDoc';
import { ChapterChooser, LineRow, SceneBlock } from './script/ScriptParts';

export function ScriptTogetherScreen() {
  const navigation = useAppNavigation();
  const members = useMembers();
  const nameOf = useMemberNames();
  const me = useRoom(s => s.me);
  const inRoom = useRoom(s => s.status === 'hosting' || s.status === 'joined');
  const activity = useRoom(s => s.room?.activity);
  const { state } = useScriptTogether();
  const { doc, locks, ended } = state;
  const host = members.find(member => member.host);
  const isHost = !!me?.host;

  // A guest who opens this after the host shared the chapter asks for it.
  useEffect(() => {
    if (inRoom && !isHost && activity === 'script' && !doc) {
      scriptSession.want();
    }
  }, [activity, doc, inRoom, isHost]);

  // Leaving the screen lets go of the line being written, so others can take it.
  useEffect(() => () => scriptSession.focus(null), []);

  const inkFor = (id: string) => inkOf(members.find(member => member.id === id));
  const holderOf = (key: string) => locks[key];

  const share = (chapterId: string) => {
    const shared = chapterDoc(chapterId);
    if (!shared) {
      toast(t('This chapter is too long to write together. Try a shorter one.'));
      return;
    }
    scriptSession.share(shared);
  };

  const save = async () => {
    if (!doc) {
      return;
    }
    const ok = await confirm(t('Save the script to your chapter?'), t('The script it has now is kept as a version you can restore.'), { confirmText: t('Save') });
    if (!ok) {
      return;
    }
    // Sends any text still being typed first; the host applies it at once, so the copy read next has it.
    scriptSession.focus(null);
    const latest = scriptSession.getSnapshot().state.doc ?? doc;
    if (saveDoc(latest)) {
      scriptSession.end();
      toast(t('Script saved'));
    } else {
      toast(t('This chapter no longer exists.'));
    }
  };

  const copy = () => {
    if (!doc) {
      return;
    }
    try {
      copyText(scriptText(doc, { scene: n => t('Scene {n}', { n }), type: type => t(BLOCK_LABEL[type]) }));
      toast(t('Script copied'));
    } catch {
      toast(t("Couldn't copy the script"));
    }
  };

  let body;
  if (!inRoom) {
    body = <EmptyState art={NEARBY_ART.script} title={t('Not in a room')} message={t('Join or host a room to play.')} />;
  } else if (!doc) {
    body = isHost ? (
      <ChapterChooser onPick={share} />
    ) : (
      <EmptyState
        art={NEARBY_ART.script}
        title={t('Waiting for {name} to pick a chapter', { name: host?.name ?? t('the host') })}
        message={t('Everyone writes the same script at once. Tap a line to write it; your name shows on it for the others.')}
      />
    );
  } else {
    body = (
      <>
        {ended ? (
          <Banner tone="success" text={isHost ? t('Saved in your story.') : t('{name} saved the script in their story.', { name: host?.name ?? t('the host') })} />
        ) : (
          <Text variant="caption" tone="secondary">
            {t('Tap a line to write it. Others see your name on it while you type.')}
          </Text>
        )}
        <Text variant="title">{doc.title}</Text>
        {doc.scenes.map((scene, index) => (
          <SceneBlock
            key={scene.id}
            scene={scene}
            index={index}
            holder={holderOf(sceneKey(scene.id))}
            me={me?.id}
            nameOf={nameOf}
            inkOf={inkFor}
            onClaim={() => !ended && scriptSession.focus(sceneKey(scene.id))}
            onRelease={() => scriptSession.focus(null)}
            onEdit={text => scriptSession.edit(sceneKey(scene.id), text)}
            onAddLine={() => {
              if (!ended) {
                const last = scene.blocks[scene.blocks.length - 1];
                scriptSession.addLine(scene.id, last?.id ?? null, last?.type === 'dialogue' ? 'dialogue' : 'action');
              }
            }}
          >
            {scene.blocks.map(block => (
              <LineRow
                key={block.id}
                block={block}
                holder={holderOf(blockKey(block.id))}
                me={me?.id}
                cast={doc.characters}
                nameOf={nameOf}
                inkOf={inkFor}
                onClaim={() => !ended && scriptSession.focus(blockKey(block.id))}
                onRelease={() => scriptSession.focus(null)}
                onEdit={text => scriptSession.edit(blockKey(block.id), text)}
                onType={(type, characterId) => scriptSession.setLine(block.id, type, characterId, block.kind)}
                onRemove={() => scriptSession.removeLine(block.id)}
              />
            ))}
          </SceneBlock>
        ))}
        {!ended ? <Button title={t('Add a scene')} icon={PlusIcon} variant="secondary" onPress={() => scriptSession.addScene(null)} /> : null}
        <View className="gap-2">
          {isHost && !ended ? <Button title={t('Save to my chapter')} icon={SaveIcon} onPress={save} /> : null}
          <Button title={t('Copy the script')} icon={CopyIcon} variant="ghost" onPress={copy} />
          {isHost ? <Button title={t('Back to the room for everyone')} variant="ghost" onPress={() => useRoom.getState().setActivity('lobby')} /> : null}
        </View>
      </>
    );
  }

  return (
    <Screen padded={false}>
      <AppBar title={t('Write together')} onBack={navigation.goBack} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6 pt-1 md:px-6" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {body}
      </ScrollView>
    </Screen>
  );
}
