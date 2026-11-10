import { AiIcon, ArrowDownIcon, ArrowUpIcon, DeleteIcon, FitIcon, HistoryIcon, MoveToIcon, PanelsIcon, SearchIcon, ShareIcon, StatsIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { BLOCK_LABEL } from '../../core/model/constants';
import type { ID, Scene } from '../../core/model/types';
import type { BlockLocation } from '../../core/script/aiDrafts';
import { blockEdges } from '../../core/script/blockOps';
import { sceneSummary } from '../../core/script/scriptTools';
import { Menu } from '../../ui';
import { useSticky } from '../characters/fields';

export function ScriptMainMenu({
  visible,
  onClose,
  onAi,
  onFind,
  onPaginate,
  onVersions,
  onFocusMode,
  onStats,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  onAi: () => void;
  onFind: () => void;
  onPaginate: () => void;
  onVersions: () => void;
  onFocusMode: () => void;
  onStats: () => void;
  onShare: () => void;
}) {
  return (
    <Menu
      visible={visible}
      onClose={onClose}
      title={t('Script')}
      items={[
        {
          label: t('AI writing help'),
          icon: AiIcon,
          subtitle: t('Continue, rewrite, change voice, shorten, SFX ideas'),
          onPress: onAi,
        },
        { label: t('Find and replace'), icon: SearchIcon, onPress: onFind },
        { label: t('Paginate'), icon: PanelsIcon, onPress: onPaginate },
        { label: t('Version history'), icon: HistoryIcon, onPress: onVersions },
        { label: t('Focus mode'), icon: FitIcon, onPress: onFocusMode },
        { label: t('Statistics'), icon: StatsIcon, onPress: onStats },
        { label: t('Share script'), icon: ShareIcon, subtitle: t('Plain-text screenplay (.txt)'), onPress: onShare },
      ]}
    />
  );
}

export function BlockMenu({
  location,
  sceneIds,
  onClose,
  onMove,
  onMoveToScene,
  onDelete,
}: {
  location: BlockLocation | undefined;
  sceneIds: ID[];
  onClose: () => void;
  onMove: (blockId: ID, delta: -1 | 1) => void;
  onMoveToScene: (blockId: ID) => void;
  onDelete: (blockId: ID) => void;
}) {
  const shown = useSticky(location);
  const edge = blockEdges(sceneIds, shown ?? undefined);
  const blockId = shown?.block.id;
  const run = (action: (id: ID) => void) => () => {
    if (blockId) {
      action(blockId);
    }
  };
  return (
    <Menu
      visible={!!location}
      onClose={onClose}
      title={shown ? t(BLOCK_LABEL[shown.block.type]) : t('Block|script')}
      subtitle={shown?.block.text.trim().replace(/\s+/g, ' ').slice(0, 60) || undefined}
      items={[
        { label: t('Move up'), icon: ArrowUpIcon, disabled: edge.first, onPress: run(id => onMove(id, -1)) },
        { label: t('Move down'), icon: ArrowDownIcon, disabled: edge.last, onPress: run(id => onMove(id, 1)) },
        { label: t('Move to scene…'), icon: MoveToIcon, disabled: sceneIds.length <= 1, onPress: run(onMoveToScene) },
        {
          label: t('Delete block'),
          icon: DeleteIcon,
          destructive: true,
          disabled: !shown || shown.scene.blocks.length <= 1,
          onPress: run(onDelete),
        },
      ]}
    />
  );
}

export function MoveToSceneMenu({
  visible,
  scenes,
  currentSceneId,
  onClose,
  onPick,
}: {
  visible: boolean;
  scenes: Scene[];
  currentSceneId: ID | undefined;
  onClose: () => void;
  onPick: (sceneId: ID) => void;
}) {
  return (
    <Menu
      visible={visible}
      onClose={onClose}
      title={t('Move to scene')}
      subtitle={t('The block goes to the end of the scene')}
      items={scenes.map((scene, index) => ({
        label: t('Scene {n}', { n: index + 1 }),
        subtitle:
          scene.id === currentSceneId
            ? t('Current scene')
            : sceneSummary(scene) || tn(scene.blocks.length, '{count} block', '{count} blocks'),
        disabled: scene.id === currentSceneId,
        onPress: () => onPick(scene.id),
      }))}
    />
  );
}

export function SceneMenu({
  sceneId,
  sceneIds,
  onClose,
  onMove,
  onDelete,
}: {
  sceneId: ID | null;
  sceneIds: ID[];
  onClose: () => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (sceneId: ID, number: number) => void;
}) {
  const shown = useSticky(sceneId);
  const index = shown ? sceneIds.indexOf(shown) : -1;
  return (
    <Menu
      visible={sceneId !== null}
      onClose={onClose}
      title={t('Scene {n}', { n: index + 1 })}
      items={[
        { label: t('Move up'), icon: ArrowUpIcon, disabled: index <= 0, onPress: () => onMove(index, -1) },
        { label: t('Move down'), icon: ArrowDownIcon, disabled: index >= sceneIds.length - 1, onPress: () => onMove(index, 1) },
        {
          label: t('Delete scene'),
          icon: DeleteIcon,
          destructive: true,
          disabled: sceneIds.length <= 1,
          onPress: () => {
            if (shown) {
              onDelete(shown, index + 1);
            }
          },
        },
      ]}
    />
  );
}
