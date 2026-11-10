import { layerBounds } from '../src/core/art/artMath';
import { POSES, POSE_LAYER_OPACITY, buildPoseStrokes, fitPoseBox, type JointName } from '../src/core/art/poses';
import { pickStrokes, transformSelected } from '../src/core/art/selection';
import { rotateAround } from '../src/core/art/affine';
import type { Stroke } from '../src/core/model/types';
import { addLayer, loadArt, newLayer, redoArt, saveArt, undoArt } from '../src/state/artStore';
import { connectTestStorage, restart } from './helpers/storage';

const span = (pose: (typeof POSES)[number], a: JointName, b: JointName) => {
  const p = pose.joints[a]!;
  const q = pose.joints[b]!;
  // Heads: x is a share of the width, y of the height, and the head is a share of the height.
  return Math.hypot((q[0] - p[0]) * pose.aspect, q[1] - p[1]) / pose.headSize;
};

describe('poses', () => {
  it('offers the twelve asked for, and a bust, each under its own name', () => {
    const ids = POSES.map(pose => pose.id);
    expect(ids).toEqual([
      'standing',
      'walking',
      'running',
      'sitting',
      'kneeling',
      'jumping',
      'punching',
      'kicking',
      'pointing',
      'arms-crossed',
      'looking-back',
      'lying-down',
      'bust',
    ]);
    expect(new Set(POSES.map(pose => pose.label)).size).toBe(POSES.length);
  });

  it.each(POSES.map(pose => [pose.id, pose] as const))('%s keeps every joint inside its unit box', (_, pose) => {
    expect(pose.aspect).toBeGreaterThan(0.2);
    expect(pose.aspect).toBeLessThan(5);
    for (const joint of Object.values(pose.joints)) {
      expect(joint[0]).toBeGreaterThanOrEqual(0);
      expect(joint[0]).toBeLessThanOrEqual(1);
      expect(joint[1]).toBeGreaterThanOrEqual(0);
      expect(joint[1]).toBeLessThanOrEqual(1);
    }
    expect(pose.joints.head).toBeDefined();
    expect(pose.joints.neck).toBeDefined();
    expect(pose.joints.chest).toBeDefined();
  });

  it.each(POSES.map(pose => [pose.id, pose] as const))('%s builds valid strokes that stay inside the box', (_, pose) => {
    const box = { x: 40, y: 70, w: 480 * pose.aspect, h: 480 };
    const strokes = buildPoseStrokes(pose, box, '#5B9BD5');
    expect(strokes.length).toBeGreaterThanOrEqual(10);
    for (const stroke of strokes) {
      expect(['pencil', 'line']).toContain(stroke.tool);
      expect(stroke.color).toBe('#5B9BD5');
      expect(stroke.opacity).toBe(1);
      expect(stroke.size).toBeGreaterThan(0);
      expect(stroke.pressure).toBeUndefined();
      expect(stroke.points.length % 2).toBe(0);
      expect(stroke.points.length).toBeGreaterThanOrEqual(2);
      expect(stroke.points.every(Number.isFinite)).toBe(true);
      if (stroke.tool === 'line') {
        expect(stroke.points).toHaveLength(4);
      }
    }
    const bounds = layerBounds({ strokes })!;
    expect(bounds.x).toBeGreaterThanOrEqual(box.x);
    expect(bounds.y).toBeGreaterThanOrEqual(box.y);
    expect(bounds.x + bounds.w).toBeLessThanOrEqual(box.x + box.w);
    expect(bounds.y + bounds.h).toBeLessThanOrEqual(box.y + box.h);
    // The figure fills its box, so fitting the box to a panel fits the figure.
    expect(bounds.h).toBeGreaterThan(box.h * 0.85);
  });

  it('stands about seven and a half heads tall', () => {
    const standing = POSES[0];
    expect(1 / standing.headSize).toBeGreaterThan(7.3);
    expect(1 / standing.headSize).toBeLessThan(8.1);
  });

  it('keeps limbs the same length from pose to pose, or shorter where they point at the viewer', () => {
    for (const pose of POSES.filter(item => item.id !== 'bust')) {
      for (const side of ['L', 'R'] as const) {
        expect(span(pose, `hip${side}`, `knee${side}`)).toBeLessThanOrEqual(1.92);
        expect(span(pose, `knee${side}`, `ankle${side}`)).toBeCloseTo(1.6, 1);
        expect(span(pose, `shoulder${side}`, `elbow${side}`)).toBeLessThanOrEqual(1.52);
        expect(span(pose, `shoulder${side}`, `elbow${side}`)).toBeGreaterThan(1.3);
        expect(span(pose, `elbow${side}`, `wrist${side}`)).toBeLessThanOrEqual(1.27);
      }
      expect(span(pose, 'neck', 'head')).toBeCloseTo(0.9, 1);
    }
  });

  it('leaves out the bones of joints a pose does not have', () => {
    const bust = POSES.find(pose => pose.id === 'bust')!;
    expect(bust.joints.pelvis).toBeUndefined();
    const full = buildPoseStrokes(POSES[0], { x: 0, y: 0, w: 100, h: 300 }, '#000000');
    const cut = buildPoseStrokes(bust, { x: 0, y: 0, w: 200, h: 300 }, '#000000');
    expect(cut.length).toBeLessThan(full.length);
    expect(cut.filter(stroke => stroke.points.length === 2)).toHaveLength(4);
  });

  it('draws thicker lines on a larger figure, within limits', () => {
    const pose = POSES[0];
    const size = (h: number) => buildPoseStrokes(pose, { x: 0, y: 0, w: h * pose.aspect, h }, '#000000')[0].size;
    expect(size(100)).toBe(1.5);
    expect(size(900)).toBeGreaterThan(size(400));
    expect(size(9000)).toBe(8);
  });

  it('fits the pose box inside a panel, centred, keeping its shape', () => {
    const panel = { x: 100, y: 50, w: 400, h: 300 };
    for (const pose of POSES) {
      const box = fitPoseBox(pose, panel);
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.y).toBeGreaterThanOrEqual(panel.y);
      expect(box.x + box.w).toBeLessThanOrEqual(panel.x + panel.w);
      expect(box.y + box.h).toBeLessThanOrEqual(panel.y + panel.h);
      expect(box.w / box.h).toBeCloseTo(pose.aspect, 1);
      expect(box.x + box.w / 2).toBeCloseTo(panel.x + panel.w / 2, 0);
      expect(box.y + box.h / 2).toBeCloseTo(panel.y + panel.h / 2, 0);
    }
  });

  it('can be selected whole and turned like any other strokes', () => {
    const strokes = buildPoseStrokes(POSES[0], { x: 0, y: 0, w: 104, h: 300 }, '#000000');
    const lasso = [-10, -10, 120, -10, 120, 310, -10, 310];
    const picked = pickStrokes(strokes, lasso);
    expect(picked).toHaveLength(strokes.length);
    const turned = transformSelected(strokes, picked, rotateAround(52, 150, Math.PI / 2));
    const bounds = layerBounds({ strokes: turned })!;
    expect(bounds.w).toBeGreaterThan(bounds.h * 2);
  });
});

describe('a pose layer in the art store', () => {
  const panelId = 'pose-panel';
  const names = () => (loadArt(panelId)?.layers ?? []).map(layer => layer.name);
  const strokes: Stroke[] = buildPoseStrokes(POSES[2], { x: 0, y: 0, w: 200, h: 220 }, '#5B9BD5');
  /** Points are stored as 32-bit floats, so that is how they read back. */
  const stored = strokes.map(stroke => ({ ...stroke, points: stroke.points.map(Math.fround) }));

  it('arrives with its strokes as one undo step, and survives a restart', () => {
    const db = connectTestStorage();
    saveArt(panelId, { layers: [newLayer('Sketch'), newLayer('Ink')] });
    const id = addLayer(panelId, 'Running', { strokes, opacity: POSE_LAYER_OPACITY }, 1);
    expect(names()).toEqual(['Sketch', 'Running', 'Ink']);
    const added = loadArt(panelId)!.layers[1];
    expect(added.id).toBe(id);
    expect(added.strokes).toEqual(strokes);
    expect(added.opacity).toBe(POSE_LAYER_OPACITY);
    restart(db);
    expect(loadArt(panelId)!.layers[1].strokes).toEqual(stored);
    expect(loadArt(panelId)!.layers[1].opacity).toBe(POSE_LAYER_OPACITY);
  });

  it('is taken back whole by one undo, and brought back whole by redo', () => {
    const db = connectTestStorage();
    saveArt(panelId, { layers: [newLayer('Sketch'), newLayer('Ink')] });
    addLayer(panelId, 'Running', { strokes, opacity: POSE_LAYER_OPACITY }, 0);
    expect(undoArt(panelId)).toBe(true);
    expect(names()).toEqual(['Sketch', 'Ink']);
    expect(undoArt(panelId)).toBe(false);
    expect(redoArt(panelId)).toBe(true);
    expect(names()).toEqual(['Running', 'Sketch', 'Ink']);
    expect(loadArt(panelId)!.layers[0].strokes).toEqual(stored);
    restart(db);
    expect(loadArt(panelId)!.layers[0].strokes).toEqual(stored);
  });

  it('still adds an empty layer the way it always did', () => {
    const db = connectTestStorage();
    saveArt(panelId, { layers: [newLayer('Sketch')] });
    addLayer(panelId, 'Blank');
    restart(db);
    expect(loadArt(panelId)!.layers[1].strokes).toEqual([]);
  });
});
