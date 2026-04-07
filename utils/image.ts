import * as ImageManipulator from 'expo-image-manipulator'

/**
 * Re-encodes an image to normalize EXIF orientation into pixel data.
 * Mobile cameras embed rotation in EXIF rather than rotating pixels.
 * Servers that ignore EXIF will display such images rotated 90 degrees.
 * Re-encoding bakes the correct orientation into the pixels.
 */
export async function normalizeImageOrientation(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  )
  return result.uri
}
