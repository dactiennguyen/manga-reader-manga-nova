import { Canvas, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';

import { buildPoseStrokes, fitPoseBox, posesOffered, type Pose } from '../../core/art/poses';
import { t } from '../../core/i18n';
import { drawStroke, recordPicture } from '../../render/drawArt';
import { INK } from '../../render/ink';
import { useStudio } from '../../state/useStudio';
import { Pressable, Sheet, Text } from '../../ui';

const THUMB = 96;

/** Drawn with the same strokes the layer will get, so the thumbnail cannot drift from the result. */
function PoseThumb({ pose }: { pose: Pose }) {
  const picture = useMemo(() => {
    const box = fitPoseBox(pose, { x: 0, y: 0, w: THUMB, h: THUMB });
    const strokes = buildPoseStrokes(pose, box, INK);
    return recordPicture(canvas => strokes.forEach(stroke => drawStroke(canvas, stroke)));
  }, [pose]);
  return (
    <Canvas style={{ width: THUMB, height: THUMB }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

export function PosesSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (pose: Pose) => void;
}) {
  const unlocked = useStudio(s => s.unlocked);
  const poses = useMemo(() => posesOffered(unlocked), [unlocked]);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Poses')} subtitle={t('A mannequin to trace, on its own layer under your drawing')}>
      <View className="flex-row flex-wrap gap-3 px-4 pb-2 pt-3">
        {poses.map(pose => (
          <Pressable
            key={pose.id}
            accessibilityLabel={t('Add {name}', { name: t(pose.label) })}
            onPress={() => onPick(pose)}
            className="w-[30%] gap-1"
          >
            <View className="items-center overflow-hidden rounded-md bg-paper py-2">
              <PoseThumb pose={pose} />
            </View>
            <Text variant="caption" tone="secondary" numberOfLines={1} className="text-center">
              {t(pose.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
