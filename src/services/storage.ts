import { createMMKV, type MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';
import { generateId } from '../utils/id';
import { cancelCapsuleNotification, scheduleCapsuleNotification } from './notifications';
import { deletePhoto } from './photos';
import type {
  CapsulePatch,
  CreateCapsuleInput,
  ReflectionAnswer,
  TimeCapsule,
} from '../types/capsule';

/**
 * MMKV-backed persistence for TimeCapsule (F7), following the key pattern and
 * ordering rules from design/database/schema.md §4.
 *
 * `capsule:<id>`   -> JSON of one TimeCapsule
 * `capsule:index`  -> JSON string[] of all ids (MMKV has no "list by prefix")
 */

const ENCRYPTION_KEY_STORE_NAME = 'futurebox_mmkv_encryption_key';
const INDEX_KEY = 'capsule:index';
const capsuleKey = (id: string): string => `capsule:${id}`;

let mmkvPromise: Promise<MMKV> | null = null;

/**
 * Lazily creates (once) the encrypted MMKV instance. The AES-256 key is
 * generated on first run and persisted in expo-secure-store (schema.md §4.3).
 */
async function getStorage(): Promise<MMKV> {
  if (!mmkvPromise) {
    mmkvPromise = (async () => {
      let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_NAME);
      if (!key) {
        // generateId() is a 36-char UUID; stripping dashes gives exactly 32
        // ASCII chars = 32 bytes, the exact length AES-256 requires.
        key = generateId().replace(/-/g, '');
        await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_NAME, key);
      }
      return createMMKV({
        id: 'futurebox-storage',
        encryptionKey: key,
        encryptionType: 'AES-256',
      });
    })();
  }
  return mmkvPromise;
}

function readIndex(storage: MMKV): string[] {
  const raw = storage.getString(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(storage: MMKV, ids: string[]): void {
  storage.set(INDEX_KEY, JSON.stringify(ids));
}

function readCapsule(storage: MMKV, id: string): TimeCapsule | null {
  const raw = storage.getString(capsuleKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TimeCapsule;
  } catch {
    // Corrupt JSON for this one record — skip it, don't crash the whole list (Crash-free NFR).
    return null;
  }
}

function writeCapsule(storage: MMKV, capsule: TimeCapsule): void {
  storage.set(capsuleKey(capsule.id), JSON.stringify(capsule));
}

/**
 * F1 — validates, persists, and schedules the reminder notification for a new
 * capsule, in the order described in design/flows/f1-create-capsule.md:
 * validate -> create record -> persist -> schedule notification -> persist notificationId.
 */
export async function createCapsule(input: CreateCapsuleInput): Promise<TimeCapsule> {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title) throw new Error('title không được để trống');
  if (!message) throw new Error('message không được để trống');

  const now = new Date();
  const openDate = new Date(input.openDate);
  if (!(openDate.getTime() > now.getTime())) {
    throw new Error('openDate phải ở tương lai (F1 AC)');
  }

  const storage = await getStorage();
  const capsule: TimeCapsule = {
    id: generateId(),
    title,
    message,
    photoUri: input.photoUri ?? null,
    templateType: input.templateType,
    reflectionQuestion: input.reflectionQuestion ?? null,
    openDate: openDate.toISOString(),
    createdAt: now.toISOString(),
    openedAt: null,
    reflectionAnswer: null,
    notificationId: null,
  };

  // Write record before updating the index (schema.md §4.2: an orphan record
  // with no index entry is harmless; the reverse — index pointing at a
  // missing record — is what listCapsules() has to self-heal against).
  writeCapsule(storage, capsule);
  const ids = readIndex(storage);
  ids.push(capsule.id);
  writeIndex(storage, ids);

  // Notification scheduling is a soft-fail: a denied permission or a native
  // error must not prevent the capsule from being created (F1/F6 AC).
  const notificationId = await scheduleCapsuleNotification(capsule);
  if (notificationId) {
    capsule.notificationId = notificationId;
    writeCapsule(storage, capsule);
  }

  return capsule;
}

export async function getCapsule(id: string): Promise<TimeCapsule | null> {
  const storage = await getStorage();
  return readCapsule(storage, id);
}

/**
 * F3 — loads every capsule via the index. Any id whose record is missing or
 * corrupt is dropped from the index on read (self-heal, per F10 edge cases).
 * Sorting/grouping by derived status is left to the caller (agent-uiux).
 */
export async function listCapsules(): Promise<TimeCapsule[]> {
  const storage = await getStorage();
  const ids = readIndex(storage);
  const capsules: TimeCapsule[] = [];
  let hasOrphans = false;
  const survivingIds: string[] = [];

  for (const id of ids) {
    const capsule = readCapsule(storage, id);
    if (capsule) {
      capsules.push(capsule);
      survivingIds.push(id);
    } else {
      hasOrphans = true;
    }
  }

  if (hasOrphans) {
    writeIndex(storage, survivingIds);
  }

  return capsules;
}

async function patchCapsule(id: string, patch: CapsulePatch): Promise<TimeCapsule | null> {
  const storage = await getStorage();
  const existing = readCapsule(storage, id);
  if (!existing) return null;
  const updated: TimeCapsule = { ...existing, ...patch };
  writeCapsule(storage, updated);
  return updated;
}

/** F4 — sets openedAt on first open only; immutable afterwards. */
export async function markCapsuleOpened(id: string): Promise<TimeCapsule | null> {
  const storage = await getStorage();
  const existing = readCapsule(storage, id);
  if (!existing) return null;
  if (existing.openedAt != null) return existing; // already opened, no-op (immutable)
  return patchCapsule(id, { openedAt: new Date().toISOString() });
}

/** F5 — persists the Yes/No reflection answer exactly once. */
export async function saveReflectionAnswer(
  id: string,
  answer: ReflectionAnswer
): Promise<TimeCapsule | null> {
  const storage = await getStorage();
  const existing = readCapsule(storage, id);
  if (!existing) return null;
  if (existing.openedAt == null || existing.reflectionQuestion == null) {
    throw new Error('Chỉ được trả lời phản tư khi hộp đã mở và có câu hỏi (F5 AC)');
  }
  if (existing.reflectionAnswer != null) return existing; // "lưu 1 lần" (F5 AC)
  return patchCapsule(id, { reflectionAnswer: answer });
}

/**
 * F10 — deletes a capsule and everything tied to it, following the order in
 * design/flows/f10-delete-capsule.md: cancel notification -> delete photo ->
 * delete record -> update index. Each step is idempotent/soft-fail.
 */
export async function deleteCapsule(id: string): Promise<void> {
  const storage = await getStorage();
  const existing = readCapsule(storage, id);

  if (existing?.notificationId) {
    await cancelCapsuleNotification(existing.notificationId);
  }
  if (existing?.photoUri) {
    deletePhoto(existing.photoUri);
  }

  storage.remove(capsuleKey(id));
  const remainingIds = readIndex(storage).filter((existingId) => existingId !== id);
  writeIndex(storage, remainingIds);
}
