import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

/**
 * Re-encodes an image to normalize EXIF orientation into pixel data and
 * convert any input format (including HEIC/HEIF) to JPEG.
 * Mobile cameras embed rotation in EXIF rather than rotating pixels.
 * Servers that ignore EXIF will display such images rotated 90 degrees.
 * Re-encoding bakes the correct orientation into the pixels.
 */
export async function normalizeImageOrientation(uri: string): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).renderAsync()
  const result = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })
  return result.uri
}
