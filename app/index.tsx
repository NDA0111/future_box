import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listCapsules } from '../src/services/storage';
import { deriveStatus } from '../src/utils/deriveStatus';
import { Snackbar } from '../src/components/Snackbar';
import type { CapsuleStatus, TimeCapsule } from '../src/types/capsule';
import { colors, radii, spacing, typography } from '../src/constants/theme';

/**
 * Home (F3) — capsules grouped by derived status, with the open-capsule
 * entry point (F4). Presentation layer per screens.md "Home (Danh sách hộp)";
 * happy-path only, edge cases (e.g. storage errors) for agent-react.
 */

type Section = { key: CapsuleStatus; title: string; data: TimeCapsule[] };

function formatCountdown(openDate: string, now: Date): string {
  const diffMs = new Date(openDate).getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86_400_000);
  if (days >= 1) return `Còn ${days} ngày`;
  const hours = Math.ceil(diffMs / 3_600_000);
  if (hours >= 1) return `Còn ${hours} giờ`;
  const mins = Math.max(1, Math.ceil(diffMs / 60_000));
  return `Còn ${mins} phút`;
}

function formatOpenedDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function buildSections(capsules: TimeCapsule[], now: Date): Section[] {
  const ready: TimeCapsule[] = [];
  const locked: TimeCapsule[] = [];
  const opened: TimeCapsule[] = [];

  for (const c of capsules) {
    const status = deriveStatus(c.openedAt, c.openDate, now);
    if (status === 'ready') ready.push(c);
    else if (status === 'locked') locked.push(c);
    else opened.push(c);
  }

  ready.sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime());
  locked.sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime());
  opened.sort((a, b) => new Date(b.openedAt ?? 0).getTime() - new Date(a.openedAt ?? 0).getTime());

  const sections: Section[] = [
    { key: 'ready', title: 'Sẵn sàng mở', data: ready },
    { key: 'locked', title: 'Đang khóa', data: locked },
    { key: 'opened', title: 'Đã mở', data: opened },
  ];
  // Hide empty sections so section titles never show with no items (screens.md).
  return sections.filter((s) => s.data.length > 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCapsules(await listCapsules());
      setLoadError(null);
    } catch {
      // Storage/read failure (e.g. corrupt encryption key) — surface it instead
      // of failing silently with an empty list (Crash-free NFR).
      setLoadError('Không thể tải danh sách hộp. Vui lòng thử lại.');
    }
  }, []);

  // Re-derive status on every focus, no restart needed (F3 AC).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!loadError) return;
    const timer = setTimeout(() => setLoadError(null), 3000);
    return () => clearTimeout(timer);
  }, [loadError]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const sections = buildSections(capsules, new Date());

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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => {
            if (section.key === 'ready') {
              return (
                <Pressable
                  onPress={() => router.push(`/capsule/${item.id}`)}
                  style={({ pressed }) => [styles.readyCard, pressed && styles.cardPressed]}
                >
                  <Text style={styles.readyIcon}>💌</Text>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.readyBadge}>Sẵn sàng mở 🎉</Text>
                  </View>
                </Pressable>
              );
            }
            if (section.key === 'locked') {
              return (
                <View style={styles.lockedCard}>
                  <Text style={styles.lockedIcon}>🔒</Text>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.countdown}>{formatCountdown(item.openDate, new Date())}</Text>
                  </View>
                </View>
              );
            }
            return (
              <Pressable
                onPress={() => router.push(`/capsule/${item.id}`)}
                style={({ pressed }) => [styles.openedRow, pressed && styles.cardPressed]}
              >
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.openedMeta}>
                  {item.reflectionAnswer && (
                    <Text style={styles.openedIcon}>{item.reflectionAnswer === 'yes' ? '✅' : '💛'}</Text>
                  )}
                  <Text style={styles.openedDate}>
                    {item.openedAt ? formatOpenedDate(item.openedAt) : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      {loadError && <Snackbar message={loadError} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  listContent: { paddingBottom: spacing.xl },
  sectionHeader: {
    ...typography.heading,
    color: colors.textMuted,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
  },
  cardPressed: { opacity: 0.85 },
  readyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  readyIcon: { fontSize: 28 },
  readyBadge: { ...typography.caption, color: colors.primaryDark, marginTop: spacing.xs },
  lockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    opacity: 0.85,
  },
  lockedIcon: { fontSize: 24 },
  cardTextWrap: { flex: 1 },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  countdown: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  openedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  openedMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  openedIcon: { fontSize: 14 },
  openedDate: { ...typography.caption, color: colors.textMuted },
});
