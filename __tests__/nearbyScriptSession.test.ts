import { createLoopbackPhones } from '../src/core/nearby/loopback';
import { ScriptSession } from '../src/core/nearby/scriptSession';
import { blockKey, sceneKey, type ScriptDoc } from '../src/core/nearby/scriptTogether';

const doc: ScriptDoc = {
  chapterId: 'c1',
  title: 'Chapter 1',
  characters: [{ id: 'k1', name: 'Mai' }],
  scenes: [{ id: 's1', description: 'Rooftop', blocks: [{ id: 'b1', type: 'action', text: 'Wind.' }] }],
};

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach(run => run());
});

async function room(joinLan = true) {
  const loop = createLoopbackPhones(3);
  const [host, ken, lan] = loop.phones;
  const address = await host.getState().hostRoom('Mai');
  await ken.getState().joinRoom(address, 'Ken');
  if (joinLan) {
    await lan.getState().joinRoom(address, 'Lan');
  }
  await loop.flush();
  // Typed text goes out on the next tick instead of every 250 ms.
  const sessions = [host, ken, lan].map(phone => new ScriptSession(phone, 0).start());
  cleanups.push(() => {
    sessions.forEach(session => session.stop());
    [host, ken, lan].forEach(phone => phone.getState().leaveRoom());
  });
  return { ...loop, host, ken, lan, address, sessions };
}

const docOf = (session: ScriptSession) => session.getSnapshot().state.doc;

describe('writing a script together across three phones', () => {
  it('sends the last typed words before moving to another line', async () => {
    const { sessions, flush } = await room();
    const [mai, kenS] = sessions;
    mai.share(doc);
    await flush();
    kenS.focus(blockKey('b1'));
    await flush();
    // Typed, then straight on to the scene heading before the batch would have gone out.
    kenS.edit(blockKey('b1'), 'Wind howls.');
    kenS.focus(sceneKey('s1'));
    await flush();
    expect(docOf(mai)!.scenes[0].blocks[0].text).toBe('Wind howls.');
    expect(Object.keys(mai.getSnapshot().state.locks)).toEqual(['s:s1']);
  });

  it('keeps every copy the same, with one writer per line', async () => {
    const { sessions, flush, ken } = await room();
    const [mai, kenS, lanS] = sessions;
    mai.share(doc);
    await flush();
    expect(docOf(lanS)).toEqual(doc);

    // Both grab the same line at once: the host's order decides, and everyone agrees on who won.
    kenS.focus(blockKey('b1'));
    lanS.focus(blockKey('b1'));
    await flush();
    const kenId = ken.getState().me!.id;
    for (const session of sessions) {
      expect(session.getSnapshot().state.locks).toEqual({ 'b:b1': kenId });
    }

    kenS.edit(blockKey('b1'), 'Strong wind.');
    lanS.edit(blockKey('b1'), 'not mine');
    await flush();
    for (const session of sessions) {
      expect(docOf(session)!.scenes[0].blocks[0].text).toBe('Strong wind.');
    }

    const added = lanS.addLine('s1', 'b1', 'dialogue', 'k1');
    lanS.edit(blockKey(added), 'Hold on!');
    const scene = mai.addScene(null);
    mai.edit(sceneKey(scene), 'Street below');
    await flush();
    const copies = sessions.map(session => JSON.stringify(docOf(session)));
    expect(new Set(copies).size).toBe(1);
    const shared = docOf(mai)!;
    expect(shared.scenes.map(item => item.description)).toEqual(['Rooftop', 'Street below']);
    expect(shared.scenes[0].blocks.map(block => block.text)).toEqual(['Strong wind.', 'Hold on!']);
  });

  it('sends the script to someone who joins late or asks again', async () => {
    const { sessions, flush, lan, address } = await room(false);
    const [mai, , lanS] = sessions;
    mai.share(doc);
    await flush();
    mai.focus(blockKey('b1'));
    await flush();

    await lan.getState().joinRoom(address, 'Lan');
    await flush();
    expect(docOf(lanS)).toEqual(doc);
    expect(Object.values(lanS.getSnapshot().state.locks)).toHaveLength(1);

    lanS.reset();
    lanS.want();
    await flush();
    expect(docOf(lanS)).toEqual(doc);
  });

  it('frees the lines of someone who leaves and stops after the host ends', async () => {
    const { sessions, flush, ken } = await room();
    const [mai, kenS, lanS] = sessions;
    mai.share(doc);
    await flush();
    kenS.focus(blockKey('b1'));
    await flush();
    kenS.stop();
    ken.getState().leaveRoom();
    await flush();
    expect(lanS.getSnapshot().state.locks).toEqual({});

    lanS.focus(blockKey('b1'));
    await flush();
    expect(Object.keys(mai.getSnapshot().state.locks)).toEqual(['b:b1']);

    mai.end();
    await flush();
    expect(lanS.getSnapshot().state.ended).toBe(true);
    lanS.edit(blockKey('b1'), 'too late');
    await flush();
    expect(docOf(mai)!.scenes[0].blocks[0].text).toBe('Wind.');
  });
});
