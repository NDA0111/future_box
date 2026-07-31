import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';

/**
 * F10 — shared "Xóa hộp này?" confirmation dialog (screens.md "Xác nhận xóa
 * hộp (Modal)"). One component, mounted from Home (long-press) and from the
 * capsule detail screen; caller passes `onConfirm` (the actual delete) and
 * `onCancel` (unmount/close). Applies to a capsule in any status (F10 A3).
 */
export function DeleteConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    if (deleting) return;
    setDeleting(true);
    await onConfirm();
    // Caller unmounts this modal (navigates away / clears target id) — no
    // need to reset `deleting` here.
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={deleting ? undefined : onCancel} />
      <Pressable style={styles.dialog} onPress={() => {}}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={typography.heading}>Xóa hộp này?</Text>
        <Text style={styles.subtext}>
          Hành động này không thể hoàn tác. Hộp, ảnh và thông báo liên quan sẽ bị xóa vĩnh viễn.
        </Text>
        <View style={styles.row}>
          <Pressable onPress={onCancel} disabled={deleting} style={styles.cancelBtn}>
            <Text style={styles.cancelLabel}>Hủy</Text>
          </Pressable>
          <Pressable onPress={handleConfirm} disabled={deleting} style={styles.deleteBtn}>
            <Text style={styles.deleteLabel}>{deleting ? 'Đang xóa...' : 'Xóa'}</Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.sm,
  },
  icon: { fontSize: 28 },
  subtext: { ...typography.body, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.sm },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelLabel: { ...typography.body, color: colors.textMuted },
  deleteBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
  },
  deleteLabel: { ...typography.body, color: colors.surface, fontWeight: '600' },
});
