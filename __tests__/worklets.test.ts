import * as affine from '../src/core/art/affine';
import * as artMath from '../src/core/art/artMath';
import * as freehand from '../src/core/art/freehand';
import * as liveOutline from '../src/core/art/liveOutline';
import * as session from '../src/core/art/session';
import * as strokes from '../src/core/art/strokes';
import * as drawArt from '../src/render/drawArt';
import * as liveStroke from '../src/render/liveStroke';
import * as selectionScene from '../src/render/selectionScene';

jest.mock('@shopify/react-native-skia', () => require('./helpers/fakeSkia'));

type Worklet = { __closure?: unknown[]; __workletHash?: number; name: string };

/**
 * A worklet captures its closure when it is defined, so calling something declared further down gives
 * undefined, and calling a plain function only fails on the UI thread. Neither shows up in reducer tests
 * that run on the JS thread, so this walks the real closures the plugin produced.
 */
function problems(entry: Worklet, seen: Set<unknown>, trail: string, out: string[]): void {
  if (seen.has(entry)) {
    return;
  }
  seen.add(entry);
  for (const value of entry.__closure ?? []) {
    if (value === undefined) {
      out.push(`${trail}: captured undefined`);
    } else if (typeof value === 'function') {
      const fn = value as unknown as Worklet;
      if (fn.__workletHash === undefined) {
        out.push(`${trail}: captured plain function ${fn.name}`);
      } else {
        problems(fn, seen, `${trail} > ${fn.name}`, out);
      }
    }
  }
}

describe('worklet closures', () => {
  const entries: [string, unknown][] = [
    ['reduceSession', session.reduceSession],
    ['fitView', session.fitView],
    ['createSession', session.createSession],
    ['getStroke', freehand.getStroke],
    ['addLivePoint', liveOutline.addLivePoint],
    ['readLiveTail', liveOutline.readLiveTail],
    ['readLiveOutline', liveOutline.readLiveOutline],
    ['createLiveOutline', liveOutline.createLiveOutline],
    ['freehandOptions', strokes.freehandOptions],
    ['toTriples', strokes.toTriples],
    ['hitCorner', artMath.hitCorner],
    ['cornerScale', artMath.cornerScale],
    ['composeTransform', artMath.composeTransform],
    ['transformBox', artMath.transformBox],
    ['buildStrokePath', drawArt.buildStrokePath],
    ['buildStrokePaint', drawArt.buildStrokePaint],
    ['makeToneShader', drawArt.makeToneShader],
    ['beginLiveStroke', liveStroke.beginLiveStroke],
    ['recordLiveStroke', liveStroke.recordLiveStroke],
    ['pendingFrom', liveStroke.pendingFrom],
    ['recordPending', liveStroke.recordPending],
    ['recordTransformFrame', liveStroke.recordTransformFrame],
    ['emptyPicture', liveStroke.emptyPicture],
    ['hitFrame', affine.hitFrame],
    ['dragScale', affine.dragScale],
    ['dragRotate', affine.dragRotate],
    ['applySelectionOp', affine.applySelectionOp],
    ['recordSelectionScene', selectionScene.recordSelectionScene],
    ['recordSelectionFrame', selectionScene.recordSelectionFrame],
    ['extendLasso', selectionScene.extendLasso],
    ['recordLasso', selectionScene.recordLasso],
  ];

  it.each(entries)('%s reaches only defined worklets', (name, entry) => {
    const fn = entry as Worklet;
    expect(fn.__workletHash).toBeDefined();
    const out: string[] = [];
    problems(fn, new Set(), name, out);
    expect(out).toEqual([]);
  });
});
