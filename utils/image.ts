/**
 * Re-encodes an image to normalize EXIF orientation into pixel data and
 * convert any input format (including HEIC/HEIF) to JPEG.
 * Mobile cameras embed rotation in EXIF rather than rotating pixels.
 * Servers that ignore EXIF will display such images rotated 90 degrees.
 * Re-encoding bakes the correct orientation into the pixels.
 *
 * Falls back to the original URI if expo-image-manipulator's native module
 * is unavailable (e.g. running in Expo Go before a dev-client rebuild).
 */
export async function normalizeImageOrientation(uri: string): Promise<string> {
  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator')
    const ref = await ImageManipulator.manipulate(uri).renderAsync()
    const result = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })
    return result.uri
  } catch {
    return uri
  }
}
