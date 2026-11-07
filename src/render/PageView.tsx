import { Canvas, Group, Picture, type SkPicture } from '@shopify/react-native-skia';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ID } from '../core/model/types';
import { renderDeps } from './config';
import { buildPageContext, recordPage, type PageContext, type PageDrawOptions } from './drawPage';
import { useEngineFonts } from './fonts';
import { useImageCacheRev } from './images';

export function usePageContext(pageId: ID | undefined): PageContext | null {
  const deps = renderDeps();
  const page = deps.usePage(pageId);
  const project = deps.useProjectOfPage(pageId);
  return useMemo(() => (page && project ? buildPageContext(page, project) : null), [page, project]);
}

/** Re-records when this page changes: artRev is per page, so drawing on one page leaves the others alone. */
export function usePagePicture(
  pageId: ID | undefined,
  options: PageDrawOptions = {},
): { picture: SkPicture | null; ctx: PageContext | null } {
  const ctx = usePageContext(pageId);
  const fonts = useEngineFonts();
  const imageRev = useImageCacheRev();
  const artRev = ctx?.page.artRev;
  const key = JSON.stringify(options);
  const picture = useMemo(
    () => (ctx ? recordPage(ctx, fonts, JSON.parse(key) as PageDrawOptions) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, fonts, artRev, imageRev, key],
  );
  return { picture, ctx };
}

export function PageView({
  pageId,
  width,
  options,
  style,
  children,
}: {
  pageId: ID;
  width: number;
  options?: PageDrawOptions;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { picture, ctx } = usePagePicture(pageId, options);
  if (!ctx) {
    return null;
  }
  const scale = width / ctx.size.w;
  const height = ctx.size.h * scale;
  return (
    <View className="bg-white" style={[{ width, height }, style]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ scale }]}>{picture && <Picture picture={picture} />}</Group>
        {children}
      </Canvas>
      {!ctx.page.layout && <View className="border border-divider" style={StyleSheet.absoluteFill} />}
    </View>
  );
}
