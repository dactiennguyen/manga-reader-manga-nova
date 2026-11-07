import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { Image, type ImageSourcePropType } from 'react-native';

import { saveImageData } from '../../native/files';

/** Copies an image bundled with the app into the story's own images, so exports can carry it. */
export async function importBundledImage(
  source: ImageSourcePropType,
): Promise<{ uri: string; width: number; height: number } | null> {
  const asset = Image.resolveAssetSource(source)?.uri;
  const image = asset ? Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(asset)) : null;
  if (!image) {
    return null;
  }
  const uri = await saveImageData(image.encodeToBase64(ImageFormat.PNG), 'png');
  return { uri, width: image.width(), height: image.height() };
}
