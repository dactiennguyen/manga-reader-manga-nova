import { Canvas, Picture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { trailerSeconds, type TrailerPlan } from '../../core/studio/trailer';
import { MIME, saveToDevice, shareFile } from '../../native/files';
import { recordPicture } from '../../render/drawArt';
import { Button, Chip, EmptyState, LoadingView, ProgressBar, Sheet, Text, toast } from '../../ui';
import { PauseIcon, PlayIcon, ReplayIcon, SaveIcon, ShareIcon, TrailerIcon } from '../../ui/icons';
import { voicedChapterOf, voicesTrackFor } from '../nearby/dub/dubExport';
import { disposeTrailerAssets, drawTrailerFrame, loadTrailerAssets, type TrailerAssets } from './trailerFrame';
import { TrailerCancelled, makeTrailerVideo, trailerPlanFor, type TrailerVideo } from './trailerVideo';

type VideoState =
  | { kind: 'idle' }
  | { kind: 'making'; done: number; total: number }
  /** Cancelled, and the run has not stopped yet: a new one waits so the two never share files. */
  | { kind: 'stopping' }
  | { kind: 'ready'; video: TrailerVideo };

const PREVIEW_MAX_HEIGHT = 400;

/** One press of Make video. Each run checks only its own flag, so a cancelled run can never resume. */
type Run = { cancelled: boolean };

/** Plays the trailer live with Skia from the same frames the video is made of, so watching costs no wait. */
function Player({ plan, projectId }: { plan: TrailerPlan; projectId: ID }) {
  const [assets, setAssets] = useState<TrailerAssets | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [width, setWidth] = useState(0);
  const [video, setVideo] = useState<VideoState>({ kind: 'idle' });
  const run = useRef<Run | null>(null);
  /** A chapter dubbed in Dub together lends its voices to the video. */
  const voicedChapter = useMemo(() => voicedChapterOf(projectId), [projectId]);
  const [withVoices, setWithVoices] = useState(true);

  useEffect(() => {
    let alive = true;
    let loaded: TrailerAssets | null = null;
    loadTrailerAssets(plan, () => !alive)
      .then(result => {
        loaded = result;
        if (alive) {
          setAssets(result);
        } else {
          disposeTrailerAssets(result);
        }
      })
      .catch(() => {
        if (alive) {
          toast(t("Couldn't make the video"));
        }
      });
    return () => {
      alive = false;
      if (run.current) {
        run.current.cancelled = true;
        run.current = null;
      }
      if (loaded) {
        disposeTrailerAssets(loaded);
      }
    };
  }, [plan]);

  const making = video.kind === 'making';
  useEffect(() => {
    if (!assets || !playing || making) {
      return;
    }
    const timer = setInterval(() => {
      setFrame(current => {
        if (current >= plan.totalFrames - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1000 / plan.fps);
    return () => clearInterval(timer);
  }, [assets, playing, making, plan]);

  const scale = Math.min(width / plan.size.w, PREVIEW_MAX_HEIGHT / plan.size.h);
  const stage = { width: plan.size.w * scale, height: plan.size.h * scale };
  const picture = useMemo(
    () =>
      assets
        ? recordPicture(canvas => {
            canvas.scale(scale, scale);
            drawTrailerFrame(canvas, plan, assets, frame);
          })
        : null,
    [assets, plan, frame, scale],
  );

  const toggle = () => {
    if (!playing && frame >= plan.totalFrames - 1) {
      setFrame(0);
    }
    setPlaying(value => !value);
  };

  const make = async () => {
    if (run.current) {
      return;
    }
    const mine: Run = { cancelled: false };
    run.current = mine;
    setPlaying(false);
    setVideo({ kind: 'making', done: 0, total: plan.totalFrames });
    try {
      const audio = voicedChapter && withVoices ? await voicesTrackFor(voicedChapter) : null;
      const result = await makeTrailerVideo(
        plan,
        (done, total) => {
          if (!mine.cancelled) {
            setVideo({ kind: 'making', done, total });
          }
        },
        () => mine.cancelled,
        assets ?? undefined,
        audio,
      );
      if (!mine.cancelled) {
        setVideo({ kind: 'ready', video: result });
        if (voicedChapter && withVoices && !result.voiced) {
          toast(t("Couldn't add the voices. The video has no sound."));
        }
      }
    } catch (error) {
      if (!mine.cancelled) {
        setVideo({ kind: 'idle' });
        if (!(error instanceof TrailerCancelled)) {
          toast(t("Couldn't make the video"));
        }
      }
    } finally {
      // Only now may a new run start: this one no longer touches the trailer folder.
      if (run.current === mine) {
        run.current = null;
        if (mine.cancelled) {
          setVideo({ kind: 'idle' });
        }
      }
    }
  };

  const cancel = () => {
    if (run.current) {
      run.current.cancelled = true;
      setVideo({ kind: 'stopping' });
    }
  };

  const share = (item: TrailerVideo) =>
    shareFile(item.path, MIME.mp4, t('Story trailer')).catch(() => toast(t("Couldn't share the video")));

  const save = async (item: TrailerVideo) => {
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
            accessibilityLabel={t('Trailer of {title}', { title: plan.title || t('Untitled') })}
            className="items-center justify-center overflow-hidden rounded-md bg-overlay"
            style={stage}
          >
            {picture ? (
              <Canvas style={stage}>
                <Picture picture={picture} />
              </Canvas>
            ) : (
              <LoadingView label={t('Cutting the panels…')} />
            )}
          </View>
        )}
      </View>
      <ProgressBar value={(frame + 1) / plan.totalFrames} />
      {video.kind === 'making' ? (
        <View className="gap-2">
          <ProgressBar value={video.done / Math.max(1, video.total)} />
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
            disabled={!assets}
            className="flex-1"
          />
          {(video.kind === 'idle' || video.kind === 'stopping') && (
            <Button
              title={t('Make video')}
              icon={ReplayIcon}
              onPress={make}
              disabled={!assets || video.kind === 'stopping'}
              className="flex-1"
            />
          )}
        </View>
      )}
      {voicedChapter && (video.kind === 'idle' || video.kind === 'stopping') && (
        <View className="flex-row">
          <Chip label={t('With recorded voices')} selected={withVoices} onPress={() => setWithVoices(value => !value)} />
        </View>
      )}
      {video.kind === 'ready' && (
        <View className="flex-row gap-3">
          <Button title={t('Share')} icon={ShareIcon} onPress={() => share(video.video)} className="flex-1" />
          <Button title={t('Save')} icon={SaveIcon} variant="secondary" onPress={() => save(video.video)} className="flex-1" />
        </View>
      )}
    </View>
  );
}

/**
 * A short vertical trailer of a story, cut from its best drawn panels and lines: watch it at once, then
 * make an MP4 to save or share. Home places it.
 */
export function TrailerSheet({ projectId, visible, onClose }: { projectId: ID; visible: boolean; onClose: () => void }) {
  // Planned when the sheet opens: the story cannot change while it covers the screen.
  const plan = useMemo(() => (visible ? trailerPlanFor(projectId) : null), [visible, projectId]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('Story trailer')}
      subtitle={plan ? t('{seconds} seconds, made from your panels', { seconds: Math.round(trailerSeconds(plan)) }) : undefined}
    >
      {plan ? (
        <Player plan={plan} projectId={projectId} />
      ) : (
        <EmptyState
          icon={TrailerIcon}
          title={t('Nothing to show yet')}
          message={t('Draw a few panels in this story, then come back for its trailer.')}
        />
      )}
    </Sheet>
  );
}
