import { useEffect, type RefObject, useRef, useState } from 'react';
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
import {
  deleteCapsule,
  getCapsule,
  markCapsuleOpened,
  saveReflectionAnswer,
} from '../../src/services/storage';
import { deriveStatus } from '../../src/utils/deriveStatus';
import { Snackbar } from '../../src/components/Snackbar';
import { DeleteConfirmModal } from '../../src/components/DeleteConfirmModal';
import type { ReflectionAnswer, TimeCapsule } from '../../src/types/capsule';
import { colors, radii, spacing, typography } from '../../src/constants/theme';

/**
 * Mở hộp (F4) + Câu hỏi phản tư (F5) + Xem lại hộp đã mở (F11) — one shared
 * route: a capsule that is `ready` plays the unbox moment once; a capsule
 * already `opened` renders the same content statically, no animation
 * (screens.md "Mở hộp" + "Xem lại hộp đã mở").
 *
 * Design decision (screens.md explicitly allows this): "Câu hỏi phản tư" is
 * described as its own screen, but screens.md's own note on "Xem lại hộp đã
 * mở" says agent-react may keep it as one route "nếu thuận tiện hơn cho điều
 * hướng, miễn giữ đúng hành vi". Embedding avoids passing the loaded capsule
 * back and forth across a nav round-trip, since this screen already holds
 * the record in state. The reflection UI is a `reflectionPhase` sub-state of
 * this same component instead of a separate file.
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
  // F5 — 'hidden': not asking (no question, or viewing content before "Tiếp
  // tục" is tapped). 'ask': showing the Yes/No question. 'yes'/'no': showing
  // the matching effect screen right after the user picks an answer.
  const [reflectionPhase, setReflectionPhase] = useState<'hidden' | 'ask' | 'yes' | 'no'>('hidden');
  const [reflectionSaveError, setReflectionSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // True only during the unbox reveal animation (tap -> confetti/scale ->
  // markCapsuleOpened resolves). Blocks delete in that narrow window so a
  // delete can't race markCapsuleOpened writing to an already-removed record.
  const [unboxing, setUnboxing] = useState(false);
  const confettiRef = useRef<ConfettiCannon>(null);
  const reflectionConfettiRef = useRef<ConfettiCannon>(null);
  const contentFade = useRef(new Animated.Value(0)).current;
  const boxScale = useRef(new Animated.Value(1)).current;
  const unboxingRef = useRef(false);
  const reflectionSubmittingRef = useRef(false);

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

  useEffect(() => {
    if (!deleteError) return;
    const timer = setTimeout(() => setDeleteError(null), 3000);
    return () => clearTimeout(timer);
  }, [deleteError]);

  async function handleUnbox() {
    // Guard against double-tap / duplicate invocation firing the animation
    // and markCapsuleOpened() twice (storage layer is idempotent, but the
    // animation itself is not).
    if (unboxingRef.current || revealed) return;
    unboxingRef.current = true;
    setUnboxing(true);
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
      // The delete button is guarded (disabled) while unboxing===true, so this
      // capsule can't have been deleted out from under us mid-animation; guard
      // is still checked here in case the screen navigated away in between.
      if (updated) setCapsule(updated);
      setRevealed(true);
      setUnboxing(false);
      Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  }

  function handleContinue() {
    // F5 decision point: only ask if there's a question AND it hasn't been
    // answered yet (screens.md "Câu hỏi phản tư" + F5 AC "lưu 1 lần").
    if (capsule && capsule.reflectionQuestion && capsule.reflectionAnswer == null) {
      setReflectionPhase('ask');
      return;
    }
    router.replace('/');
  }

  async function handleAnswer(answer: ReflectionAnswer) {
    // Guard against double-tap firing saveReflectionAnswer() twice before
    // reflectionPhase updates and the Yes/No buttons unmount (same pattern as
    // unboxingRef for handleUnbox).
    if (!capsule || reflectionSubmittingRef.current) return;
    reflectionSubmittingRef.current = true;
    // Optimistic update: show the matching effect immediately. Per
    // f5-reflection.md's error-handling row, a storage write failure here
    // must never block the emotional payoff — the effect plays regardless,
    // and a failed save is surfaced as a non-blocking Snackbar instead.
    setReflectionPhase(answer);
    if (answer === 'yes') reflectionConfettiRef.current?.start();
    try {
      const updated = await saveReflectionAnswer(id, answer);
      if (updated) setCapsule(updated);
    } catch {
      // Retry is skipped for MVP (writes are local MMKV, not network — a
      // failure here means a genuine local storage problem a silent retry
      // won't fix). Just warn; F4's openedAt is already persisted and does
      // not depend on this step.
      setReflectionSaveError('Không thể lưu câu trả lời, nhưng đừng lo — bạn vẫn có thể tiếp tục.');
    }
  }

  // F10 — deletes this capsule (any status) after confirmation, then returns
  // to Home; applies regardless of where the user is in the unbox/reflection
  // flow. Guarded against the unbox animation window by the trash button
  // being disabled while `unboxing` is true (see header render below); this
  // extra check covers it too in case the button is somehow triggered anyway.
  async function handleDelete() {
    if (unboxing) return;
    try {
      await deleteCapsule(id);
      router.replace('/');
    } catch {
      setShowDeleteConfirm(false);
      setDeleteError('Không thể xóa hộp. Vui lòng thử lại.');
    }
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
        <Pressable
          onPress={() => setShowDeleteConfirm(true)}
          disabled={unboxing}
          hitSlop={12}
        >
          <Text style={[styles.headerAction, unboxing && styles.headerActionDisabled]}>🗑</Text>
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
      ) : reflectionPhase !== 'hidden' ? (
        <>
          <ReflectionQuestionView
            question={capsule.reflectionQuestion ?? ''}
            phase={reflectionPhase}
            onAnswer={handleAnswer}
            onDone={() => router.replace('/')}
            confettiRef={reflectionConfettiRef}
          />
          {reflectionSaveError && <Snackbar message={reflectionSaveError} />}
        </>
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

            {/* F11 — xem lại hộp đã mở: nhúng câu hỏi + câu trả lời đã lưu,
                chỉ xem, không cho chọn lại (screens.md "Xem lại hộp đã mở" #4). */}
            {capsule.reflectionQuestion && capsule.reflectionAnswer != null && (
              <ReflectionReadOnly
                question={capsule.reflectionQuestion}
                answer={capsule.reflectionAnswer}
              />
            )}
          </ScrollView>

          <Pressable onPress={handleContinue} style={styles.continueButton}>
            <Text style={styles.continueLabel}>
              {capsule.reflectionQuestion && capsule.reflectionAnswer == null ? 'Tiếp tục' : 'Xong'}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {showDeleteConfirm && (
        <DeleteConfirmModal onCancel={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} />
      )}
      {deleteError && <Snackbar message={deleteError} />}
    </View>
  );
}

/** F5 — Yes/No question, then the matching Yes/No effect screen (screens.md
 * "Câu hỏi phản tư" #1-3b). Buttons disable immediately on tap to avoid a
 * double-tap re-saving/overwriting the answer. */
function ReflectionQuestionView({
  question,
  phase,
  onAnswer,
  onDone,
  confettiRef,
}: {
  question: string;
  phase: 'ask' | 'yes' | 'no';
  onAnswer: (answer: ReflectionAnswer) => void;
  onDone: () => void;
  confettiRef: RefObject<ConfettiCannon | null>;
}) {
  if (phase === 'ask') {
    return (
      <View style={styles.reflectWrap}>
        <Text style={styles.reflectQuestion}>{question}</Text>
        <View style={styles.reflectButtons}>
          <Pressable
            onPress={() => onAnswer('yes')}
            style={[styles.reflectButton, styles.reflectButtonYes]}
          >
            <Text style={styles.reflectButtonLabel}>Yes</Text>
          </Pressable>
          <Pressable
            onPress={() => onAnswer('no')}
            style={[styles.reflectButton, styles.reflectButtonNo]}
          >
            <Text style={[styles.reflectButtonLabel, styles.reflectButtonNoLabel]}>No</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.reflectWrap}>
      <ConfettiCannon
        ref={confettiRef}
        count={100}
        origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
        fadeOut
        autoStart={false}
      />
      <Text style={styles.reflectResultEmoji}>{phase === 'yes' ? '🎉' : '💛'}</Text>
      <Text style={styles.reflectResultText}>
        {phase === 'yes'
          ? 'Tuyệt vời! Chúc mừng bạn 🎉'
          : 'Không sao cả, mỗi hành trình đều có nhịp riêng. Tiếp tục cố gắng nhé!'}
      </Text>
      <Pressable onPress={onDone} style={styles.continueButton}>
        <Text style={styles.continueLabel}>Về trang chủ</Text>
      </Pressable>
    </View>
  );
}

/** F11 read-only mode: same question, the previously chosen answer shown
 * selected/highlighted, the other muted, neither tappable. */
function ReflectionReadOnly({
  question,
  answer,
}: {
  question: string;
  answer: ReflectionAnswer;
}) {
  return (
    <View style={styles.reflectReadOnly}>
      <Text style={styles.reflectReadOnlyQuestion}>{question}</Text>
      <View style={styles.reflectButtons}>
        <View
          style={[
            styles.reflectButton,
            styles.reflectButtonYes,
            answer !== 'yes' && styles.reflectButtonMuted,
          ]}
        >
          <Text style={styles.reflectButtonLabel}>Yes</Text>
        </View>
        <View
          style={[
            styles.reflectButton,
            styles.reflectButtonNo,
            answer !== 'no' && styles.reflectButtonMuted,
          ]}
        >
          <Text style={[styles.reflectButtonLabel, styles.reflectButtonNoLabel]}>No</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerAction: { ...typography.body, color: colors.primaryDark },
  headerActionDisabled: { opacity: 0.4 },
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
  reflectWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  reflectQuestion: { ...typography.title, color: colors.text, textAlign: 'center' },
  reflectButtons: { flexDirection: 'row', gap: spacing.md },
  reflectButton: {
    minWidth: 120,
    minHeight: 44,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reflectButtonYes: { backgroundColor: colors.accent },
  reflectButtonNo: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  reflectButtonLabel: { ...typography.heading, color: colors.surface },
  reflectButtonNoLabel: { color: colors.text },
  reflectButtonMuted: { opacity: 0.4 },
  reflectResultEmoji: { fontSize: 72 },
  reflectResultText: { ...typography.body, color: colors.text, textAlign: 'center' },
  reflectReadOnly: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  reflectReadOnlyQuestion: { ...typography.heading, color: colors.text, textAlign: 'center' },
});
