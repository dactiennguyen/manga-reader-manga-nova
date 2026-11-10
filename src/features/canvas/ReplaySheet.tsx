import { Canvas, ClipOp, Group, Picture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { PauseIcon, PlayIcon, ReplayIcon, SaveIcon, ShareIcon } from '../../ui/icons';

import { artAtStep, replayFps, replayFrames, replaySteps } from '../../core/art/replay';
import { t } from '../../core/i18n';
import { artImageUris } from '../../core/art/strokes';
import type { PanelShape } from '../../core/layout/layout';
import type { ID, PanelArt } from '../../core/model/types';
import { MIME, saveToDevice, shareFile } from '../../native/files';
import { drawArt, recordPicture } from '../../render/drawArt';
import { polyPath } from '../../render/drawPage';
import { loadImage, useImageCacheRev } from '../../render/images';
import { PAPER } from '../../render/ink';
import { loadArt } from '../../state/artStore';
import { Button, EmptyState, ProgressBar, Sheet, Text, toast } from '../../ui';
import { ReplayCancelled, makeReplayVideo, type ReplayVideo } from './replayVideo';

type VideoState =
  | { kind: 'idle' }
  | { kind: 'making'; done: number; total: number }
  | { kind: 'ready'; video: ReplayVideo };

const PREVIEW_MAX_HEIGHT = 320;

function Player({ art, shape }: { art: PanelArt; shape: PanelShape }) {
  const frames = useMemo(() => replayFrames(replaySteps(art)), [art]);
  const fps = replayFps(frames.length);
  const [index, setIndex] = useState(frames.length - 1);
  const [playing, setPlaying] = useState(false);
  const [width, setWidth] = useState(0);
  const [video, setVideo] = useState<VideoState>({ kind: 'idle' });
  const cancelled = useRef(false);
  const imageRev = useImageCacheRev();

  useEffect(() => {
    artImageUris(art).forEach(uri => {
      loadImage(uri).catch(() => undefined);
    });
    return () => {
      cancelled.current = true;
    };
  }, [art]);

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

  const clip = useMemo(() => polyPath(shape.poly), [shape]);
  const picture = useMemo(
    () =>
      recordPicture(canvas => {
        canvas.clipPath(clip, ClipOp.Intersect, true);
        drawArt(canvas, artAtStep(art, frames[index] ?? 0));
      }),
    // The image cache revision redraws the frame once a layer image has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [art, clip, frames, index, imageRev],
  );

  const { bbox } = shape;
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
        art,
        shape,
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

/** Plays back how a panel was drawn, stroke by stroke, and turns it into a video to share. */
export function ReplaySheet({
  visible,
  panelId,
  shape,
  onClose,
}: {
  visible: boolean;
  panelId: ID;
  shape: PanelShape;
  onClose: () => void;
}) {
  // Read when the sheet opens: the drawing cannot change while it covers the canvas.
  const art = useMemo(() => (visible ? loadArt(panelId) : null), [visible, panelId]);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Drawing replay')} subtitle={t('Watch this panel being drawn')}>
      {art && replaySteps(art) > 0 ? (
        <Player art={art} shape={shape} />
      ) : (
        <EmptyState title={t('Nothing to replay yet.')} message={t('Draw in this panel, then come back.')} />
      )}
    </Sheet>
  );
}
