import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useSyncExternalStore } from 'react';

import { fileUri } from '../core/util/paths';

const cache = new Map<string, SkImage | null>();
const pending = new Map<string, Promise<SkImage | null>>();
const listeners = new Set<() => void>();
let rev = 0;

export function getImage(uri: string): SkImage | null {
  const cached = cache.get(uri);
  if (cached !== undefined) {
    return cached;
  }
  loadImage(uri);
  return null;
}

/** Takes the stored path as it is, relative or absolute. */
export function loadImage(uri: string): Promise<SkImage | null> {
  if (cache.has(uri)) {
    return Promise.resolve(cache.get(uri) ?? null);
  }
  let job = pending.get(uri);
  if (!job) {
    job = Skia.Data.fromURI(fileUri(uri))
      .then(data => Skia.Image.MakeImageFromEncoded(data))
      .catch(() => null)
      .then(image => {
        cache.set(uri, image);
        pending.delete(uri);
        rev++;
        listeners.forEach(listener => listener());
        return image;
      });
    pending.set(uri, job);
  }
  return job;
}

export function forgetImage(uri: string): void {
  cache.delete(uri);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useImageCacheRev(): number {
  return useSyncExternalStore(subscribe, () => rev);
}
