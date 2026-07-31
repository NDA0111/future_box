import * as Notifications from 'expo-notifications';
import type { TimeCapsule } from '../types/capsule';

/**
 * Local notification wrapper (F6). No push server — schedules a device-local
 * notification firing at `capsule.openDate`.
 *
 * Content deliberately never reveals capsule contents (F6 AC / Security NFR):
 * "Một hộp thời gian đã sẵn sàng để mở."
 */

// Foreground presentation is irrelevant for this app (notification only matters
// once the user isn't actively looking at Home), but a handler must be set or
// expo-notifications warns. Keep it minimal.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Schedules a local notification for the capsule's openDate.
 * Returns the notificationId to persist on the record, or `null` if
 * permission was denied or scheduling failed (soft-fail — F1/F6 AC:
 * the app must still work without notification permission).
 */
export async function scheduleCapsuleNotification(
  capsule: Pick<TimeCapsule, 'id' | 'openDate'>
): Promise<string | null> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    let granted = permission.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) {
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'FutureBoxes',
        body: 'Một hộp thời gian đã sẵn sàng để mở.',
        data: { capsuleId: capsule.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(capsule.openDate),
      },
    });
    return notificationId;
  } catch {
    // Scheduling failure must not block capsule creation (F1 error handling table).
    return null;
  }
}

/** Cancels a previously scheduled notification. Safe to call with null/stale ids (F10). */
export async function cancelCapsuleNotification(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired or unknown id — nothing to do (F10 edge case table).
  }
}
