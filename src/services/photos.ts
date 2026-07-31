import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { generateId } from '../utils/id';

/**
 * Photo attachment wrapper (F8). Picks 1 image and copies it into the app's own
 * document storage so it survives even if the original library asset is removed
 * (schema.md §4.3 — MMKV never stores binary, only `photoUri`).
 */

const PHOTOS_DIR_NAME = 'capsule-photos';

function getPhotosDirectory(): Directory {
  const dir = new Directory(Paths.document, PHOTOS_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export type PhotoPickResult = {
  uri: string | null;
  /** True only when the library permission was actually denied — lets the
   * caller show feedback (F1 edge case table), unlike a plain user cancel. */
  permissionDenied: boolean;
};

/**
 * Launches the image library, copies the chosen image into app storage, and
 * returns its stable `photoUri`. `uri` is `null` if the user cancels or
 * permission is denied — capsule creation must still proceed without a photo
 * (F1/F8 AC: photo is optional).
 */
export async function pickAndSavePhoto(): Promise<PhotoPickResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { uri: null, permissionDenied: true };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) {
      return { uri: null, permissionDenied: false };
    }

    const sourceUri = result.assets[0].uri;
    const source = new File(sourceUri);
    const destination = new File(getPhotosDirectory(), `${generateId()}${source.extension || '.jpg'}`);
    await source.copy(destination, { overwrite: true });
    return { uri: destination.uri, permissionDenied: false };
  } catch {
    // Picker/copy failure is a soft-fail: capsule creation continues without a photo.
    return { uri: null, permissionDenied: false };
  }
}

/** Deletes the photo file for a capsule. Idempotent — safe if already missing (F10). */
export function deletePhoto(photoUri: string | null): void {
  if (!photoUri) return;
  try {
    const file = new File(photoUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Missing/inaccessible file — nothing to do (F10 edge case table).
  }
}
