import { createLoopbackPhones } from '../src/core/nearby/loopback';
import type { RoomSafety } from '../src/core/nearby/room';
import {
  SAFETY_KEY_PATTERN,
  buildPersonReportMail,
  isBlocked,
  makePersonReport,
  newSafetyKey,
  parseSafety,
  rulesAccepted,
  NEARBY_RULES_VERSION,
  withBlocked,
  withoutBlocked,
} from '../src/core/nearby/safety';
import { parseEnvelope } from '../src/core/nearby/schema';

const KEYS = ['hostKey00000001', 'kenKey000000002', 'lanKey000000003'];

/** Phone i has key KEYS[i] and blocks the keys in `blocks[i]`. */
async function room(blocks: string[][] = [], joinAll = true) {
  const safety = (index: number): RoomSafety => ({ key: () => KEYS[index], blocked: key => (blocks[index] ?? []).includes(key) });
  const setup = createLoopbackPhones(3, { safety });
  const [host, ken, lan] = setup.phones;
  const address = await host.getState().hostRoom('Mai');
  if (joinAll) {
    await ken.getState().joinRoom(address, 'Ken');
    await lan.getState().joinRoom(address, 'Lan');
  }
  await setup.flush();
  return { ...setup, host, ken, lan, address };
}

const names = (phone: { getState(): { room: { members: { name: string }[] } | null } }) => phone.getState().room?.members.map(member => member.name);

describe('safety data on this phone', () => {
  it('makes keys the room accepts, and keeps one entry per blocked person', () => {
    const key = newSafetyKey();
    expect(key).toMatch(SAFETY_KEY_PATTERN);
    expect(newSafetyKey(() => 0.999999)).toMatch(SAFETY_KEY_PATTERN);

    let list = withBlocked([], { key: KEYS[1], name: 'Ken', at: 1 });
    list = withBlocked(list, { key: KEYS[1], name: 'Ken again', at: 2 });
    expect(list).toEqual([{ key: KEYS[1], name: 'Ken again', at: 2 }]);
    expect(isBlocked(list, KEYS[1])).toBe(true);
    expect(isBlocked(list, undefined)).toBe(false);
    expect(withoutBlocked(list, KEYS[1])).toEqual([]);
  });

  it('reads saved data safely: a broken record keeps a working key and drops what it cannot read', () => {
    const fresh = () => 'freshKey0000001';
    expect(parseSafety(null, fresh)).toEqual({ key: 'freshKey0000001', blocked: [], reports: [] });
    expect(parseSafety('not json', fresh).key).toBe('freshKey0000001');
    const saved = JSON.stringify({
      key: KEYS[0],
      blocked: [{ key: KEYS[1], name: 'Ken', at: 5 }, { key: 'x', name: 'bad key', at: 1 }, 'junk'],
      reports: [{ id: 'r1', name: 'Ken', reason: 'words', note: '', activity: 'lobby', createdAt: 9 }, { id: 'r2', reason: 'nope' }],
    });
    const data = parseSafety(saved, fresh);
    expect(data.key).toBe(KEYS[0]);
    expect(data.blocked.map(person => person.name)).toEqual(['Ken']);
    expect(data.reports.map(report => report.id)).toEqual(['r1']);
  });

  it('builds a short English report email that names the reason and the activity', () => {
    const report = makePersonReport({ name: '  Ken ', key: KEYS[1], reason: 'drawing', note: 'x'.repeat(900), activity: 'codraw' }, 'r1', 0);
    expect(report.name).toBe('Ken');
    expect(Array.from(report.note).length).toBeLessThanOrEqual(500);
    const mail = buildPersonReportMail('dev@example.com', report, { appName: 'Manganova', appVersion: '1.0.0', platform: 'ios 26', language: 'vi' });
    expect(mail.subject).toBe('Manganova: Play together report (Offensive drawing or image)');
    expect(mail.body).toContain('Activity: codraw');
    expect(mail.url.startsWith('mailto:dev@example.com?subject=')).toBe(true);
  });
});

describe('removing and blocking people in a room', () => {
  it('shows every phone the key of each member', async () => {
    const { phones } = await room();
    for (const phone of phones) {
      expect(phone.getState().room!.members.map(member => member.key)).toEqual(KEYS);
    }
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('accepts a key in hello and a member, and refuses a malformed one', () => {
    const line = (key: string) => JSON.stringify({ m: { t: 'hello', v: 3, token: 't', name: 'Ken', app: 'manganova', key } });
    expect(parseEnvelope(line(KEYS[1])).ok).toBe(true);
    expect(parseEnvelope(line('bad key!')).ok).toBe(false);
    expect(parseEnvelope(JSON.stringify({ m: { t: 'refused', reason: 'removed' } })).ok).toBe(true);
  });

  it('lets the host take a guest out: they are told, everyone sees them go, and they cannot come back', async () => {
    const { host, ken, lan, address, flush, phones } = await room();
    const kenId = ken.getState().me!.id;
    expect(lan.getState().removeMember(kenId)).toBe(false);
    expect(host.getState().removeMember(host.getState().me!.id)).toBe(false);

    expect(host.getState().removeMember(kenId)).toBe(true);
    await flush();
    expect(ken.getState().status).toBe('error');
    expect(ken.getState().error).toBe('The host removed you from the room.');
    expect(names(host)).toEqual(['Mai', 'Lan']);
    expect(names(lan)).toEqual(['Mai', 'Lan']);

    await expect(ken.getState().joinRoom(address, 'Ken')).rejects.toThrow();
    expect(ken.getState().error).toBe("You can't join this room.");
    expect(names(host)).toEqual(['Mai', 'Lan']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('keeps someone the host blocked out of its rooms', async () => {
    const { host, ken, lan, address, flush, phones } = await room([[KEYS[1]]], false);
    await expect(ken.getState().joinRoom(address, 'Ken')).rejects.toThrow();
    expect(ken.getState().error).toBe("You can't join this room.");
    await lan.getState().joinRoom(address, 'Lan');
    await flush();
    expect(names(host)).toEqual(['Mai', 'Lan']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('takes a guest straight back out of a room hosted by someone they blocked', async () => {
    const { host, ken, address, flush, phones } = await room([[], [KEYS[0]]], false);
    await expect(ken.getState().joinRoom(address, 'Ken')).rejects.toThrow('blocked host');
    await flush();
    expect(ken.getState().status).toBe('error');
    expect(ken.getState().error).toBe('You blocked the host of this room.');
    expect(names(host)).toEqual(['Mai']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('lets a guest blocked by someone else still join: only the host decides who comes in', async () => {
    const { host, phones } = await room([[], [], [KEYS[1]]]);
    expect(names(host)).toEqual(['Mai', 'Ken', 'Lan']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});

describe('the Play together rules', () => {
  it('count as agreed only for the current version', () => {
    expect(rulesAccepted(undefined)).toBe(false);
    expect(rulesAccepted(0)).toBe(false);
    expect(rulesAccepted(NEARBY_RULES_VERSION)).toBe(true);
  });

  it('come before hosting or joining any room', async () => {
    let agreed = false;
    const safety = (index: number): RoomSafety => ({ key: () => KEYS[index], blocked: () => false, rulesAccepted: () => agreed || index === 0 });
    const { phones, flush } = createLoopbackPhones(2, { safety });
    const [host, ken] = phones;
    const address = await host.getState().hostRoom('Mai');
    await expect(ken.getState().joinRoom(address, 'Ken')).rejects.toThrow();
    expect(ken.getState().status).toBe('idle');
    expect(ken.getState().error).toBeTruthy();
    await expect(ken.getState().hostRoom('Ken')).rejects.toThrow();
    agreed = true;
    await ken.getState().joinRoom(address, 'Ken');
    await flush();
    expect(names(host)).toEqual(['Mai', 'Ken']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });

  it('mask the names people choose, on their own phone too', async () => {
    const { host, ken, lan, phones, flush } = await room();
    expect(names(lan)).toEqual(['Mai', 'Ken', 'Lan']);
    phones.forEach(phone => phone.getState().leaveRoom());
    const address = await host.getState().hostRoom('Shithead', 'Fuck room');
    expect(host.getState().room?.name).toBe('••• room');
    await ken.getState().joinRoom(address, 'asshole');
    await flush();
    expect(names(ken)).toEqual(['•••', '•••']);
    expect(host.getState().room?.members.map(member => member.name)).toEqual(['•••', '•••']);
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});
