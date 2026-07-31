import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listCapsules } from '../src/services/storage';
import type { TimeCapsule } from '../src/types/capsule';
import { colors, radii, spacing, typography } from '../src/constants/theme';

/**
 * Placeholder Home screen — full Home (F3: grouped sections, countdown, empty
 * state illustration, swipe-to-delete) is a separate feature/task per
 * design/screens.md. This stub only exists so the "Tạo hộp thời gian" screen
 * (F1/F6/F8/F9) has somewhere to navigate from/back to.
 */
export default function HomeScreen() {
  const router = useRouter();
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);

  useFocusEffect(
    useCallback(() => {
      listCapsules().then(setCapsules);
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.title}>FutureBoxes</Text>
        <Pressable
          onPress={() => router.push('/create-capsule')}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Text style={styles.addButtonLabel}>+</Text>
        </Pressable>
      </View>

      {capsules.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyText}>
            Chưa có hộp nào. Gửi một lời nhắn cho chính mình trong tương lai nhé!
          </Text>
          <Pressable
            onPress={() => router.push('/create-capsule')}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaLabel}>Tạo hộp đầu tiên</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.body}>{capsules.length} hộp đã lưu.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: { transform: [{ scale: 0.95 }] },
  addButtonLabel: { color: colors.surface, fontSize: 24, lineHeight: 26 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  ctaPressed: { opacity: 0.85 },
  ctaLabel: { color: colors.surface, ...typography.heading },
  body: { ...typography.body, color: colors.text },
});
