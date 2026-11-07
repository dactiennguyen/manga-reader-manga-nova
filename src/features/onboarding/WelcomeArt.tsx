import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { BrushIcon, CheckIcon, EditIcon, EraserIcon, ExportIcon, PenLineIcon } from '../../ui/icons';

import { Icon, type IconGlyph } from '../../ui';

export type WelcomeArtKind = 'write' | 'draw' | 'finish';

const PAGE_RATIO = 5 / 7;
const PANEL_PADDING = 32;

function Page({ children }: { children: ReactNode }) {
  return <View className="flex-1 gap-2 rounded-md bg-raised p-3">{children}</View>;
}

function ActionTile({ icon }: { icon: IconGlyph }) {
  return (
    <View className="absolute -bottom-3 -right-3 h-14 w-14 items-center justify-center rounded-lg bg-accent">
      <Icon icon={icon} size={26} color="on-accent" />
    </View>
  );
}

function ScriptPage() {
  return (
    <Page>
      <View className="h-3 w-1/2 rounded-full bg-control-border" />
      <View className="mt-2 h-2 w-full rounded-full bg-overlay" />
      <View className="h-2 w-5/6 rounded-full bg-overlay" />
      <View className="h-2 w-2/3 rounded-full bg-overlay" />
      <View className="mt-2 h-2 w-1/3 rounded-full bg-control-border" />
      <View className="h-2 w-full rounded-full bg-overlay" />
      <View className="h-2 w-3/4 rounded-full bg-overlay" />
      <ActionTile icon={PenLineIcon} />
    </Page>
  );
}

function PanelGrid({ active }: { active?: ReactNode }) {
  return (
    <>
      <View className="flex-7 rounded-sm bg-overlay" />
      <View className="flex-5 flex-row gap-2">
        <View className="flex-1 rounded-sm bg-overlay" />
        <View className="flex-1 items-center justify-center rounded-sm bg-accent/15">{active}</View>
      </View>
    </>
  );
}

function ToolStrip() {
  return (
    <View className="absolute -left-5 top-4 gap-1 rounded-lg bg-overlay p-1">
      <View className="h-9 w-9 items-center justify-center rounded-sm bg-accent/15">
        <Icon icon={EditIcon} size={18} color="accent" />
      </View>
      <View className="h-9 w-9 items-center justify-center">
        <Icon icon={BrushIcon} size={18} color="text-secondary" />
      </View>
      <View className="h-9 w-9 items-center justify-center">
        <Icon icon={EraserIcon} size={18} color="text-secondary" />
      </View>
    </View>
  );
}

function DrawPage() {
  return (
    <Page>
      <PanelGrid active={<Icon icon={BrushIcon} size={24} color="accent" />} />
      <ToolStrip />
    </Page>
  );
}

function FinishedPage() {
  return (
    <Page>
      <PanelGrid active={<Icon icon={CheckIcon} size={24} color="accent" />} />
      <ActionTile icon={ExportIcon} />
    </Page>
  );
}

const ART: Record<WelcomeArtKind, () => ReactNode> = { write: ScriptPage, draw: DrawPage, finish: FinishedPage };

/** A plain Studio composition of the app's own surfaces. Decorative, so screen readers skip it. */
export function WelcomeArt({ kind }: { kind: WelcomeArtKind }) {
  const Art = ART[kind];
  const [page, setPage] = useState<{ width: number; height: number } | null>(null);

  const fit = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const room = { width: width - PANEL_PADDING * 2, height: height - PANEL_PADDING * 2 };
    const fitted = Math.min(room.width, room.height * PAGE_RATIO);
    setPage({ width: fitted, height: fitted / PAGE_RATIO });
  };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={fit}
      className="min-h-[200px] flex-1 items-center justify-center rounded-xl bg-surface"
    >
      {!!page && (
        <View style={page}>
          <Art />
        </View>
      )}
    </View>
  );
}
