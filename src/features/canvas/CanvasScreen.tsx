import { AddImageIcon, CharactersIcon, DeleteIcon, EditIcon, FlipIcon, GridIcon, ImageIcon, MaterialsIcon } from '../../ui/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, View, type LayoutChangeEvent } from 'react-native';
import { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScopedTheme } from 'uniwind';

import type { Box } from '../../core/art/artMath';
import { GUIDES, defaultGuide, type GuideKind } from '../../core/art/guides';
import type { SessionEnv } from '../../core/art/session';
import { DEFAULT_OPACITY, DEFAULT_SIZES, GRAYS } from '../../core/art/tools';
import type { PanelShape } from '../../core/layout/layout';
import type { Character, ID } from '../../core/model/types';
import { setKeepAwake } from '../../native/screen';
import type { PageContext } from '../../render/drawPage';
import { usePageContext } from '../../render/PageView';
import { useCharacters, useLastOpened } from '../../state/hooks';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useSettings } from '../../state/useSettings';
import { EmptyState, Menu, MOTION, Screen, toast } from '../../ui';
import { CanvasRail } from './CanvasRail';
import { CanvasStage } from './CanvasStage';
import { CanvasToolPanel } from './CanvasToolPanel';
import { ArtRevWatcher, CanvasTopBar } from './CanvasTopBar';
import {
  BrushPreview,
  DescriptionBanner,
  ReferenceWindow,
  TipsOverlay,
  ZoomBadge,
  type CanvasReference,
} from './CanvasOverlays';
import { CharacterRefSheet, characterReference } from './CharacterRefSheet';
import { LayerPanel } from './LayerPanel';
import type { Material } from './materials';
import { MaterialsSheet } from './MaterialsSheet';
import { useCanvasDoc } from './useCanvasDoc';
import { useCanvasEngine, type EngineHandlers } from './useCanvasEngine';
import { useCanvasEnv, useCanvasHandlers } from './useCanvasHandlers';
import { useCanvasTools } from './useCanvasTools';
import { useLayerActions } from './useLayerActions';

const FADED_OPACITY = 0.4;
const TOP_BAR_HEIGHT = 56;
const PANEL_CLEARANCE = 136;

export function CanvasScreen() {
  const { pageId, panelId } = useAppRoute<'Canvas'>().params;
  const ctx = usePageContext(pageId);
  const shape = ctx?.shapes.find(item => item.id === panelId);
  if (!ctx || !shape) {
    return (
      <Screen>
        <EmptyState title="Panel not found" message="This panel no longer exists on the page." />
      </Screen>
    );
  }
  return (
    <ScopedTheme theme="dark">
      <CanvasEditor key={panelId} ctx={ctx} shape={shape} pageId={pageId} panelId={panelId} />
    </ScopedTheme>
  );
}

const NO_HANDLERS: EngineHandlers = { onStroke: () => {}, onTransform: () => {}, onEffect: () => {} };

function CanvasEditor({ ctx, shape, pageId, panelId }: { ctx: PageContext; shape: PanelShape; pageId: ID; panelId: ID }) {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const handedness = useSettings(s => s.handedness);
  const keepAwake = useSettings(s => s.keepAwakeWhileDrawing);
  const tipsSeen = useSettings(s => s.canvasTipsSeen);
  const panel = ctx.page.panels[panelId];
  const colored = !!ctx.project.color;
  const side = handedness === 'left' ? 'right' : 'left';
  const otherSide = side === 'left' ? 'right' : 'left';
  useLastOpened(ctx.project.id, { screen: 'Canvas', chapterId: ctx.page.chapterId, pageId, panelId });

  const [area, setArea] = useState({ w: 0, h: 0 });
  const [stylusMode, setStylusMode] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [grid, setGrid] = useState(false);
  const [flip, setFlip] = useState(false);
  const [sizing, setSizing] = useState(false);
  const [reference, setReference] = useState<CanvasReference | null>(null);
  const [guide, setGuide] = useState<GuideKind | null>(null);
  const [sheet, setSheet] = useState<'characters' | 'materials' | null>(null);
  const [opacityPreview, setOpacityPreview] = useState<{ id: ID; value: number } | null>(null);
  const [banner, setBanner] = useState(false);

  const handlers = useRef(NO_HANDLERS);
  const initialEnv = useMemo<SessionEnv>(
    () => ({
      tool: 'pencil',
      size: DEFAULT_SIZES.pencil,
      opacity: DEFAULT_OPACITY.pencil,
      color: GRAYS[0],
      tone: null,
      picking: false,
      stylusMode: false,
      pageW: ctx.size.w,
      area: { w: 1, h: 1 },
      bbox: shape.bbox,
      poly: shape.poly,
      layer: null,
    }),
    // Only the first value matters: useCanvasEnv takes over after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const engine = useCanvasEngine(handlers, initialEnv);
  const doc = useCanvasDoc(panelId, pageId, engine);
  const tools = useCanvasTools(doc.hadArt, colored);
  const toggleChrome = useCallback(() => setChrome(value => !value), []);
  useCanvasHandlers({ handlers, engine, doc, tools, panelId, setStylusMode, toggleChrome });
  useCanvasEnv({ engine, doc, tools, panelId, shape, pageW: ctx.size.w, stylusMode, area });

  const { send, chromeRects, faded, view, env } = engine;
  const { art, active, leave, onArtRev } = doc;

  const done = useCallback(() => {
    leave();
    navigation.goBack();
  }, [leave, navigation]);

  useEffect(() => leave, [leave]);

  useEffect(() => {
    if (!keepAwake) {
      return;
    }
    setKeepAwake(true);
    return () => setKeepAwake(false);
  }, [keepAwake]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (layersOpen) {
        setLayersOpen(false);
      } else {
        done();
      }
      return true;
    });
    return () => sub.remove();
  }, [done, layersOpen]);

  useEffect(() => {
    if (!doc.hadArt && panel?.description) {
      setBanner(true);
      const timer = setTimeout(() => setBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [doc.hadArt, panel?.description]);

  useEffect(() => {
    if (area.w > 0 && area.h > 0) {
      send({ type: 'fit', flip });
    }
  }, [area, flip, send, shape]);

  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ w: width, h: height });
  }, []);

  const rects = useRef<Record<string, Box>>({});
  const trackers = useMemo(() => {
    const track = (key: string) => (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      rects.current = { ...rects.current, [key]: { x, y, w: width, h: height } };
      chromeRects.value = rects.current;
    };
    return { top: track('top'), rail: track('rail'), panel: track('panel') };
  }, [chromeRects]);

  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(faded.value ? FADED_OPACITY : 1, { duration: MOTION.fast }),
  }));

  const { importImage, clearActive, addReference, placeMaterial } = useLayerActions(panelId, active, shape, setReference);
  const characters = useCharacters(ctx.project.id);

  const closeReference = useCallback(() => setReference(null), []);

  const chooseGuide = (kind: GuideKind) => {
    const next = kind === guide ? null : kind;
    setGuide(next);
    send({ type: 'setGuide', guide: next ? defaultGuide(next, shape.bbox) : null });
    toast(next ? GUIDES.find(item => item.id === next)?.hint ?? '' : 'Ruler off');
  };

  const showCharacter = (character: Character) => {
    setSheet(null);
    setReference(characterReference(character));
  };

  const addMaterial = async (material: Material) => {
    setSheet(null);
    if (await placeMaterial(material)) {
      if (material.kind === 'pattern') {
        tools.chooseTool('move');
      }
      toast(material.kind === 'pattern' ? 'Drag to place it, pinch to resize' : 'Background added under your drawing');
    }
  };
  const closeLayers = useCallback(() => setLayersOpen(false), []);
  const railTop = insets.top + TOP_BAR_HEIGHT + 8;
  const suffix = `${tools.picking ? ' · Tap to pick a color' : ''}${stylusMode ? ' · Stylus' : ''}`;

  return (
    <View className="flex-1 bg-bg">
      <ArtRevWatcher panelId={panelId} onRev={onArtRev} />
      <CanvasStage
        ctx={ctx}
        shape={shape}
        panelId={panelId}
        layers={art.layers}
        activeId={active?.id}
        opacityPreview={opacityPreview}
        grid={grid}
        mirrored={guide === 'symmetry'}
        engine={engine}
        onLayout={onStageLayout}
      />
      {sizing ? <BrushPreview size={tools.size} view={view} /> : null}
      {banner && panel?.description ? <DescriptionBanner text={panel.description} top={railTop} /> : null}
      {reference ? (
        <ReferenceWindow
          key={reference.id}
          reference={reference}
          initialX={side === 'left' ? Math.max(0, area.w - 164) : 8}
          initialY={railTop}
          onClose={closeReference}
        />
      ) : null}
      {chrome ? (
        <>
          <ZoomBadge view={view} env={env} suffix={suffix} side={otherSide} bottom={insets.bottom + PANEL_CLEARANCE} />
          <CanvasRail
            tool={tools.tool}
            shape={tools.shapeTool}
            picking={tools.picking}
            guide={guide}
            collapsed={collapsed}
            side={side}
            top={railTop}
            maxHeight={Math.max(120, area.h - railTop - insets.bottom - PANEL_CLEARANCE)}
            fade={fade}
            onTool={tools.chooseTool}
            onPick={() => tools.setPicking(value => !value)}
            onGuide={chooseGuide}
            onToggle={() => setCollapsed(value => !value)}
            onLayout={trackers.rail}
          />
          <CanvasToolPanel
            tools={tools}
            colored={colored}
            fade={fade}
            onPreview={setSizing}
            onLayout={trackers.panel}
          />
          <CanvasTopBar
            title={`Panel ${shape.index + 1}`}
            panelId={panelId}
            layersOpen={layersOpen}
            fade={fade}
            onDone={done}
            onLayers={() => setLayersOpen(value => !value)}
            onMore={() => setMenuOpen(true)}
            onLayout={trackers.top}
          />
        </>
      ) : null}
      {layersOpen ? (
        <LayerPanel
          panelId={panelId}
          fallback={art}
          side={otherSide}
          onImportImage={importImage}
          onOpacityPreview={setOpacityPreview}
          onClose={closeLayers}
        />
      ) : null}
      <Menu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={`Panel ${shape.index + 1}`}
        items={[
          { label: 'Materials', icon: MaterialsIcon, onPress: () => setSheet('materials') },
          { label: 'Character reference', icon: CharactersIcon, onPress: () => setSheet('characters') },
          { label: 'Flip view horizontally', icon: FlipIcon, onPress: () => setFlip(value => !value) },
          { label: grid ? 'Hide grid' : 'Show grid', icon: GridIcon, onPress: () => setGrid(value => !value) },
          stylusMode && { label: 'Draw with a finger again', icon: EditIcon, onPress: () => setStylusMode(false) },
          { label: 'Add reference image', icon: AddImageIcon, onPress: addReference },
          { label: 'Import image into layer', icon: ImageIcon, onPress: importImage },
          { label: 'Clear current layer', icon: DeleteIcon, destructive: true, onPress: clearActive },
        ]}
      />
      <CharacterRefSheet
        visible={sheet === 'characters'}
        characters={characters}
        onClose={() => setSheet(null)}
        onPick={showCharacter}
      />
      <MaterialsSheet visible={sheet === 'materials'} onClose={() => setSheet(null)} onPick={addMaterial} />
      {tipsSeen ? null : <TipsOverlay onClose={() => useSettings.getState().set({ canvasTipsSeen: true })} />}
    </View>
  );
}
