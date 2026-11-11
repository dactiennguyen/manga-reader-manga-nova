import type { ReactNode } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';

import { t } from '../core/i18n';
import type { Character, Project } from '../core/model/types';
import { fileUri } from '../core/util/paths';
import { STYLE_ART } from './art';
import { Text } from './Text';

/** A required image carries its pixel size as its style, so the fill has to be stated. */
const FILL = { width: '100%', height: '100%' } as const;

/** Printed art across the width, with room to lay text over the empty paper. */
export function ArtBanner({ source, ratio, children }: { source: ImageSourcePropType; ratio: number; children?: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-xl bg-paper" style={{ aspectRatio: ratio }}>
      <Image accessibilityIgnoresInvertColors source={source} resizeMode="cover" className="absolute inset-0" style={FILL} />
      {children}
    </View>
  );
}

const COVER_SMALL = 96;

/** The art of the story's style with its title printed in the empty top of the sheet, like a zine. */
function PrintedCover({ project, width, height }: { project: Pick<Project, 'title' | 'style'>; width: number; height: number }) {
  const small = width < COVER_SMALL;
  return (
    <>
      <Image accessibilityIgnoresInvertColors source={STYLE_ART[project.style]} className="absolute inset-0" style={{ width, height }} />
      <View className={`absolute inset-x-0 top-0 ${small ? 'p-1.5' : 'p-3'}`}>
        <Text variant={small ? 'caption' : 'heading'} tone="onPaper" numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {project.title.trim() || t('Untitled')}
        </Text>
      </View>
    </>
  );
}

export function Cover({
  project,
  width,
  children,
  className,
}: {
  project: Pick<Project, 'title' | 'coverUri' | 'style'>;
  width: number;
  children?: ReactNode;
  className?: string;
}) {
  const height = Math.round(width * 1.4);
  return (
    <View className={`items-center justify-center overflow-hidden rounded-md bg-overlay ${className ?? ''}`} style={{ width, height }}>
      {project.coverUri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: fileUri(project.coverUri) }}
          className="absolute inset-0"
          style={{ width, height }}
        />
      ) : (
        <PrintedCover project={project} width={width} height={height} />
      )}
      {children}
    </View>
  );
}

export function Avatar({
  character,
  size = 44,
  square,
}: {
  character: Pick<Character, 'name' | 'sheet'> | null | undefined;
  size?: number;
  square?: boolean;
}) {
  const uri = character?.sheet?.face;
  return (
    <View
      className={`items-center justify-center overflow-hidden bg-overlay ${square ? 'rounded-md' : 'rounded-full'}`}
      style={{ width: size, height: size }}
    >
      {uri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: fileUri(uri) }}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text variant="label" tone="secondary">
          {character?.name.trim().slice(0, 1).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
}
