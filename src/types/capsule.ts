/**
 * Core domain types for FutureBoxes.
 * Source of truth: design/database/schema.md §2-3, PRD.md §3.
 */

/** 4 preset templates. Adding a new template = add a constant, no schema change. */
export type TemplateType = 'free' | 'goal' | 'memory' | 'decision';

/** Yes/No reflection answer, set once when the capsule is opened (F5). */
export type ReflectionAnswer = 'yes' | 'no';

/**
 * Derived (non-persisted) lifecycle state — see schema.md §5 `deriveStatus`.
 * Never store this on the record; always recompute from openedAt/openDate/now.
 */
export type CapsuleStatus = 'locked' | 'ready' | 'opened';

/**
 * Persisted record. Field-for-field mirror of schema.md §3.
 * ISO 8601 strings are used for all dates (MMKV stores JSON, not Date objects).
 */
export interface TimeCapsule {
  id: string;
  title: string;
  message: string;
  photoUri: string | null;
  templateType: TemplateType;
  reflectionQuestion: string | null;
  /** ISO 8601, must be > createdAt at creation time. */
  openDate: string;
  /** ISO 8601, immutable. */
  createdAt: string;
  /** ISO 8601, set once on first open, immutable after that. */
  openedAt: string | null;
  reflectionAnswer: ReflectionAnswer | null;
  notificationId: string | null;
}

/** Input for creating a capsule (F1). id/createdAt/openedAt/notificationId are derived, not user input. */
export interface CreateCapsuleInput {
  title: string;
  message: string;
  photoUri?: string | null;
  templateType: TemplateType;
  reflectionQuestion?: string | null;
  /** ISO 8601, must be in the future. */
  openDate: string;
}

/** Partial patch used internally by storage service (e.g. set openedAt, reflectionAnswer). */
export type CapsulePatch = Partial<
  Pick<TimeCapsule, 'openedAt' | 'reflectionAnswer' | 'notificationId'>
>;
