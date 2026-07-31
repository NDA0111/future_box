import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ConfettiCannon from 'react-native-confetti-cannon';
import { getCapsule, markCapsuleOpened } from '../../src/services/storage';
import { deriveStatus } from '../../src/utils/deriveStatus';
import { Snackbar } from '../../src/components/Snackbar';
import type { TimeCapsule } from '../../src/types/capsule';
import { colors, radii, spacing, typography } from '../../src/constants/theme';

/**
 * Mở hộp (F4) + Xem lại hộp đã mở — one shared route per task scope: a
 * capsule that is `ready` plays the unbox moment once; a capsule already
 * `opened` renders the same content statically, no animation (screens.md
 * "Mở hộp" + "Xem lại hộp đã mở"). Happy path only — F5 (câu hỏi phản tư) is
 * a separate feature/task, not wired up here yet (see handoff note below).
 */

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}, ${hh}:${min}`;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CapsuleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [capsule, setCapsule] = useState<TimeCapsule | null | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const confettiRef = useRef<ConfettiCannon>(null);
  const contentFade = useRef(new Animated.Value(0)).current;
  const boxScale = useRef(new Animated.Value(1)).current;
  const unboxingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let found: TimeCapsule | null;
      try {
        found = await getCapsule(id);
      } catch {
        // Storage read failure — surface it instead of failing silently.
        if (cancelled) return;
        setBlockedReason('Không thể tải hộp. Vui lòng thử lại.');
        setTimeout(() => router.replace('/'), 1200);
        return;
      }
      if (cancelled) return;
      if (!found) {
        setBlockedReason('Không tìm thấy hộp này.');
        setTimeout(() => router.replace('/'), 1200);
        return;
      }
      // Guard re-check (design/flows/f3-f4-list-open-capsule.md "ReDerive"):
      // a locked capsule has no reveal path here at all.
      const status = deriveStatus(found.openedAt, found.openDate);
      if (status === 'locked') {
        setBlockedReason('Hộp này chưa đến ngày mở.');
        setTimeout(() => router.replace('/'), 1200);
        return;
      }
      setCapsule(found);
      if (status === 'opened') {
        setRevealed(true);
        contentFade.setValue(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router, contentFade]);

  async function handleUnbox() {
    // Guard against double-tap / duplicate invocation firing the animation
    // and markCapsuleOpened() twice (storage layer is idempotent, but the
    // animation itself is not).
    if (unboxingRef.current || revealed) return;
    unboxingRef.current = true;
    confettiRef.current?.start();
    Animated.sequence([
      Animated.timing(boxScale, { toValue: 1.1, duration: 200, useNativeDriver: true }),
      Animated.timing(boxScale, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(async () => {
      // Persist openedAt *before* revealing content: if the app is killed
      // right after this point, the capsule is already recorded as opened,
      // so re-launching never re-shows an un-openable "ready" box the user
      // already saw the reveal for (Reliability NFR, same principle as F7
      // deriveStatus's clock-rollback guard).
      const updated = await markCapsuleOpened(id);
      if (updated) setCapsule(updated);
      setRevealed(true);
      Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  }

  function handleContinue() {
    // F5 (câu hỏi phản tư) is out of scope for this task even when
    // reflectionQuestion is set — always return Home for now; agent-react/
    // next feature wires the branch to the Reflection screen.
    router.replace('/');
  }

  if (blockedReason) {
    return (
      <View style={styles.flex}>
        <Snackbar message={blockedReason} />
      </View>
    );
  }
  if (capsule === undefined) return <View style={styles.flex} />;
  if (!capsule) return null; // already redirected

  const wasAlreadyOpened = revealed && capsule.openedAt != null;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerAction}>‹ Back</Text>
        </Pressable>
      </View>

      {!revealed ? (
        <Pressable style={styles.unboxWrap} onPress={handleUnbox}>
          <Animated.Text style={[styles.unboxEmoji, { transform: [{ scale: boxScale }] }]}>
            🎁
          </Animated.Text>
          <Text style={styles.unboxHint}>Chạm để mở hộp</Text>
          <ConfettiCannon
            ref={confettiRef}
            count={80}
            origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
            fadeOut
            autoStart={false}
          />
        </Pressable>
      ) : (
        <Animated.View style={{ opacity: contentFade, flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={typography.title}>{capsule.title}</Text>
            <Text style={styles.metaLine}>Bạn đã gửi vào ngày {formatDateTime(capsule.createdAt)}</Text>
            {wasAlreadyOpened && capsule.openedAt && (
              <Text style={styles.metaLine}>Bạn đã mở hộp này vào {formatDateTime(capsule.openedAt)}</Text>
            )}

            {capsule.photoUri && !imageError && (
              <Image
                source={{ uri: capsule.photoUri }}
                style={styles.photo}
                onError={() => setImageError(true)}
              />
            )}
            {capsule.photoUri && imageError && (
              <View style={styles.photoFallback}>
                <Text style={styles.photoFallbackIcon}>🖼️</Text>
                <Text style={styles.photoFallbackText}>Ảnh không còn khả dụng</Text>
              </View>
            )}

            <Text style={styles.message}>{capsule.message}</Text>
          </ScrollView>

          <Pressable onPress={handleContinue} style={styles.continueButton}>
            <Text style={styles.continueLabel}>
              {capsule.reflectionQuestion ? 'Tiếp tục' : 'Xong'}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  headerAction: { ...typography.body, color: colors.primaryDark },
  unboxWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  unboxEmoji: { fontSize: 96 },
  unboxHint: { ...typography.body, color: colors.textMuted },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  metaLine: { ...typography.caption, color: colors.textMuted },
  photo: { width: '100%', height: 220, borderRadius: radii.md, marginVertical: spacing.sm },
  photoFallback: {
    height: 160,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginVertical: spacing.sm,
  },
  photoFallbackIcon: { fontSize: 32 },
  photoFallbackText: { ...typography.caption, color: colors.textMuted },
  message: { ...typography.body, color: colors.text, lineHeight: 22, marginTop: spacing.sm },
  continueButton: {
    margin: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueLabel: { ...typography.heading, color: colors.surface },
});
