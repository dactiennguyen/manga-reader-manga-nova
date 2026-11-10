import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { PauseIcon, PlayIcon, ReplayIcon, SaveIcon, ShareIcon } from '../../ui/icons';

import { replayFps, replayFrames, sceneSteps } from '../../core/art/replay';
import { t } from '../../core/i18n';
import { artImageUris } from '../../core/art/strokes';
import type { PanelShape, Rect } from '../../core/layout/layout';
import type { ID } from '../../core/model/types';
import { MIME, saveToDevice, shareFile } from '../../native/files';
import { recordPicture } from '../../render/drawArt';
import { loadImage, useImageCacheRev } from '../../render/images';
import { PAPER } from '../../render/ink';
import { loadArt } from '../../state/artStore';
import { Button, EmptyState, ProgressBar, Sheet, Text, toast } from '../../ui';
import {
  ReplayCancelled,
  drawReplayStep,
  makeReplayVideo,
  sceneArts,
  sceneClips,
  type ReplayScene,
  type ReplayVideo,
} from './replayVideo';

type VideoState =
  | { kind: 'idle' }
  | { kind: 'making'; done: number; total: number }
  | { kind: 'ready'; video: ReplayVideo };

const PREVIEW_MAX_HEIGHT = 320;

function Player({ scene }: { scene: ReplayScene }) {
  const frames = useMemo(() => replayFrames(sceneSteps(sceneArts(scene))), [scene]);
  const fps = replayFps(frames.length);
  const [index, setIndex] = useState(frames.length - 1);
  const [playing, setPlaying] = useState(false);
  const [width, setWidth] = useState(0);
  const [video, setVideo] = useState<VideoState>({ kind: 'idle' });
  const cancelled = useRef(false);
  const imageRev = useImageCacheRev();

  useEffect(() => {
    sceneArts(scene)
      .flatMap(artImageUris)
      .forEach(uri => {
        loadImage(uri).catch(() => undefined);
      });
    return () => {
      cancelled.current = true;
    };
  }, [scene]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setInterval(() => {
      setIndex(current => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, fps, frames.length]);

  const clips = useMemo(() => sceneClips(scene), [scene]);
  const picture = useMemo(
    () => recordPicture(canvas => drawReplayStep(canvas, scene, clips, frames[index] ?? 0)),
    // The image cache revision redraws the frame once a layer image has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, clips, frames, index, imageRev],
  );

  const { bbox } = scene;
  const scale = Math.min(width / bbox.w, PREVIEW_MAX_HEIGHT / bbox.h);
  const stage = { width: bbox.w * scale, height: bbox.h * scale, backgroundColor: PAPER };

  const toggle = () => {
    if (!playing && index >= frames.length - 1) {
      setIndex(0);
    }
    setPlaying(value => !value);
  };

  const make = async () => {
    setPlaying(false);
    cancelled.current = false;
    setVideo({ kind: 'making', done: 0, total: frames.length });
    try {
      const result = await makeReplayVideo(
        scene,
        (done, total) => setVideo({ kind: 'making', done, total }),
        () => cancelled.current,
      );
      setVideo({ kind: 'ready', video: result });
    } catch (error) {
      if (cancelled.current) {
        return;
      }
      setVideo({ kind: 'idle' });
      if (!(error instanceof ReplayCancelled)) {
        toast(t("Couldn't make the video"));
      }
    }
  };

  const cancel = () => {
    cancelled.current = true;
    setVideo({ kind: 'idle' });
  };

  const share = (item: ReplayVideo) =>
    shareFile(item.path, MIME.mp4, t('Drawing replay')).catch(() => toast(t("Couldn't share the video")));

  const save = async (item: ReplayVideo) => {
    try {
      if (await saveToDevice(item.path, item.fileName, MIME.mp4)) {
        toast(t('Saved to device'));
      }
    } catch {
      toast(t("Couldn't save the video"));
    }
  };

  return (
    <View className="gap-3 px-4 pb-2 pt-1">
      <View className="items-center" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('Drawing replay, step {n} of {total}', { n: index + 1, total: frames.length })}
            className="overflow-hidden rounded-sm"
            style={stage}
          >
            <Canvas style={stage}>
              <Group transform={[{ scale }, { translateX: -bbox.x }, { translateY: -bbox.y }]}>
                <Picture picture={picture} />
              </Group>
            </Canvas>
          </View>
        )}
      </View>
      <ProgressBar value={(index + 1) / frames.length} />
      {video.kind === 'making' ? (
        <View className="gap-2">
          <Text variant="bodySmall" tone="secondary" className="text-center">
            {t('Drawing frame {done} of {total}', { done: video.done, total: video.total })}
          </Text>
          <Button title={t('Cancel')} variant="ghost" onPress={cancel} />
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Button
            title={playing ? t('Pause') : t('Play')}
            icon={playing ? PauseIcon : PlayIcon}
            variant="secondary"
            onPress={toggle}
            className="flex-1"
          />
          {video.kind === 'idle' && <Button title={t('Make video')} icon={ReplayIcon} onPress={make} className="flex-1" />}
        </View>
      )}
      {video.kind === 'ready' && (
        <View className="flex-row gap-3">
          <Button title={t('Share')} icon={ShareIcon} onPress={() => share(video.video)} className="flex-1" />
          <Button
            title={t('Save')}
            icon={SaveIcon}
            variant="secondary"
            onPress={() => save(video.video)}
            className="flex-1"
          />
        </View>
      )}
    </View>
  );
}

/** Plays back how a panel or a whole page was drawn, stroke by stroke, and turns it into a video to share. */
export function ReplaySheet({
  visible,
  panels,
  page,
  onClose,
}: {
  visible: boolean;
  /** One panel, or every panel of a page in reading order. */
  panels: { panelId: ID; shape: PanelShape }[];
  /** The page size, when the whole page is replayed with its panel borders. */
  page?: Rect;
  onClose: () => void;
}) {
  const ids = panels.map(panel => panel.panelId).join(',');
  // Read when the sheet opens: the drawing cannot change while it covers the screen. Callers pass a
  // new array on every render, so the panel ids stand in for it.
  const scene = useMemo<ReplayScene | null>(() => {
    if (!visible || panels.length === 0) {
      return null;
    }
    return {
      parts: panels.map(panel => ({ shape: panel.shape, art: loadArt(panel.panelId) })),
      bbox: page ?? panels[0].shape.bbox,
      framed: !!page,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ids, page?.w, page?.h]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('Drawing replay')}
      subtitle={page ? t('Watch this page being drawn') : t('Watch this panel being drawn')}
    >
      {scene && sceneSteps(sceneArts(scene)) > 0 ? (
        <Player scene={scene} />
      ) : (
        <EmptyState
          title={t('Nothing to replay yet.')}
          message={page ? t('Draw on this page, then come back.') : t('Draw in this panel, then come back.')}
        />
      )}
    </Sheet>
  );
}
