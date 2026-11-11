import { NARRATOR_ROLE, cleanRoles, parseScript, scriptOptions, type DubScript } from '../src/core/nearby/dub';
import { collectTakes, receiveShared, sendTake, shareClip, type ArrivedClip } from '../src/core/nearby/dubRoom';
import { createLoopbackPhones } from '../src/core/nearby/loopback';

const script: DubScript = {
  chapterId: 'c1',
  title: 'Chapter 1',
  names: { aki: 'Aki', ren: 'Ren', [NARRATOR_ROLE]: 'Narrator' },
  lines: [
    { bubbleId: 'b1', pageId: 'pg', text: 'Night fell.', type: 'narration', role: NARRATOR_ROLE, pageIndex: 0 },
    { bubbleId: 'b2', pageId: 'pg', text: 'Who goes there?', type: 'speak', role: 'aki', characterId: 'aki', pageIndex: 0 },
    { bubbleId: 'b3', pageId: 'pg', text: 'Only me.', type: 'speak', role: 'ren', characterId: 'ren', pageIndex: 0 },
  ],
};

const AUDIO = 'AAAA'.repeat(30000);

async function dubRoom() {
  const setup = createLoopbackPhones(3);
  const [host, ken, mai] = setup.phones;
  await host.getState().hostRoom('Host');
  await ken.getState().joinRoom(host.getState().address!, 'Ken');
  await mai.getState().joinRoom(host.getState().address!, 'Mai');
  await setup.flush();
  const ids = setup.phones.map(phone => phone.getState().me!.id);
  return { ...setup, host, ken, mai, ids };
}

describe('dub together over the loopback', () => {
  it('sends the script and roles, keeps a guest\'s own take, refuses takes for someone else\'s line, then shares', async () => {
    const { host, ken, mai, ids, flush, phones } = await dubRoom();
    const [hostId, kenId, maiId] = ids;
    const roles = { aki: kenId, ren: maiId };

    host.getState().setActivity('dub', scriptOptions(script));
    const heard: Record<string, string>[] = [];
    ken.getState().onMessage('dub.roles', message => heard.push(cleanRoles(message.roles, ['aki', 'ren', NARRATOR_ROLE], ids)));
    host.getState().send({ t: 'dub.roles', roles });
    await flush();
    expect(parseScript(ken.getState().room!.options)).toEqual(script);
    expect(heard).toEqual([roles]);

    const got: ArrivedClip[] = [];
    const stop = collectTakes(
      host.getState(),
      () => ({ script, roles, hostId, members: host.getState().room!.members }),
      clip => got.push(clip),
    );
    await sendTake(ken.getState(), { me: kenId, host: hostId }, 'b2', AUDIO, 1800);
    // Mai tries to voice Aki's line, and a line that is not in the script.
    await sendTake(mai.getState(), { me: maiId, host: hostId }, 'b2', AUDIO, 1800);
    await sendTake(mai.getState(), { me: maiId, host: hostId }, 'nope', AUDIO, 1800);
    await sendTake(mai.getState(), { me: maiId, host: hostId }, 'b3', AUDIO, 99999);
    await flush();
    stop();
    expect(got.map(clip => [clip.bubbleId, clip.from, clip.by, clip.ms])).toEqual([
      ['b2', kenId, 'Ken', 1800],
      ['b3', maiId, 'Mai', 15000],
    ]);
    expect(got[0].data).toBe(AUDIO);

    const shared: string[] = [];
    const offs = [ken, mai].map((phone, index) =>
      receiveShared(
        phone.getState(),
        () => ({ hostId, script, meId: ids[index + 1] }),
        clip => shared.push(`${index}:${clip.chapterId}:${clip.bubbleId}:${clip.by}`),
      ),
    );
    await shareClip(host.getState(), 'c1', { bubbleId: 'b2', by: 'Ken', ms: 1800, data: AUDIO });
    await shareClip(host.getState(), 'other', { bubbleId: 'b2', by: 'Ken', ms: 1800, data: AUDIO });
    await flush();
    offs.forEach(off => off());
    expect(shared.sort()).toEqual(['0:c1:b2:Ken', '1:c1:b2:Ken']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('lets the host record lines nobody else was given', async () => {
    const { host, ids, flush, phones } = await dubRoom();
    const [hostId] = ids;
    const got: ArrivedClip[] = [];
    const stop = collectTakes(host.getState(), () => ({ script, roles: {}, hostId, members: host.getState().room!.members }), clip => got.push(clip));
    await sendTake(host.getState(), { me: hostId, host: hostId }, 'b1', AUDIO, 2000);
    await flush();
    stop();
    expect(got.map(clip => [clip.bubbleId, clip.from])).toEqual([['b1', hostId]]);
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});
