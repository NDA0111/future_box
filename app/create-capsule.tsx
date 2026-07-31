import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { TEMPLATE_PRESETS, TEMPLATE_TYPES } from '../src/constants/templates';
import { colors, radii, spacing, typography } from '../src/constants/theme';
import { createCapsule } from '../src/services/storage';
import { deletePhoto, pickAndSavePhoto } from '../src/services/photos';
import { Snackbar } from '../src/components/Snackbar';
import type { TemplateType } from '../src/types/capsule';

const TEMPLATE_ICONS: Record<TemplateType, string> = {
  free: '💌',
  goal: '🎯',
  memory: '📸',
  decision: '🤔',
};

type QuickOption = '1w' | '1m' | '1y';
const QUICK_OPTIONS: { key: QuickOption; label: string; addDays: number }[] = [
  { key: '1w', label: '1 tuần', addDays: 7 },
  { key: '1m', label: '1 tháng', addDays: 30 },
  { key: '1y', label: '1 năm', addDays: 365 },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateTime(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}, ${hh}:${min}`;
}

/**
 * Tạo hộp thời gian — gộp F1 (tạo capsule) + F9 (template) + F8 (ảnh) + F6 (openDate).
 * Presentation layer only (happy path): validate ngày tương lai ở đây vì đó là
 * feedback UX cốt lõi của F1 (screens.md), nhưng edge cases đầy đủ do agent-react hoàn thiện.
 */
export default function CreateCapsuleScreen() {
  const router = useRouter();

  const [templateType, setTemplateType] = useState<TemplateType>('free');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState(TEMPLATE_PRESETS.free.messagePlaceholder);
  const [messageTouched, setMessageTouched] = useState(false);
  const [reflectionQuestion, setReflectionQuestion] = useState(
    TEMPLATE_PRESETS.free.defaultReflectionQuestion ?? ''
  );
  const [reflectionTouched, setReflectionTouched] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [quickOption, setQuickOption] = useState<QuickOption | null>('1w');
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [pickerStep, setPickerStep] = useState<'date' | 'time' | null>(null);
  const [pendingPickedDate, setPendingPickedDate] = useState<Date | null>(null);

  const [dateError, setDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successOpenDate, setSuccessOpenDate] = useState<Date | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const contentFade = useRef(new Animated.Value(1)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(msg);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  }

  const previewOpenDate = useMemo(() => {
    if (customDate) return customDate;
    const quick = QUICK_OPTIONS.find((o) => o.key === quickOption);
    return quick ? addDays(new Date(), quick.addDays) : null;
  }, [customDate, quickOption]);

  const isFormDirty =
    title.trim().length > 0 || messageTouched || photoUri != null || customDate != null;

  function selectTemplate(next: TemplateType) {
    if (next === templateType) return;
    const preset = TEMPLATE_PRESETS[next];
    contentFade.setValue(0);
    setTemplateType(next);
    // Only overwrite fields the user hasn't touched yet (F9 AC: prefill is a
    // starting point, user edits freely afterwards without losing their edits
    // when just browsing templates).
    if (!messageTouched) setMessage(preset.messagePlaceholder);
    if (!reflectionTouched) setReflectionQuestion(preset.defaultReflectionQuestion ?? '');
    Animated.timing(contentFade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }

  async function handlePickPhoto() {
    const result = await pickAndSavePhoto();
    if (result.uri) {
      setPhotoUri(result.uri);
    } else if (result.permissionDenied) {
      showToast('Cần cấp quyền truy cập ảnh để đính kèm. Hộp vẫn được tạo, không có ảnh.');
    }
  }

  function handleRemovePhoto() {
    deletePhoto(photoUri);
    setPhotoUri(null);
  }

  function handleQuickOption(key: QuickOption) {
    setQuickOption(key);
    setCustomDate(null);
    setDateError(null);
  }

  function handleOpenCustomPicker() {
    setPendingPickedDate(customDate ?? previewOpenDate ?? new Date());
    setPickerStep('date');
  }

  function handleDateStepChange(_: unknown, selected?: Date) {
    if (Platform.OS === 'android') setPickerStep(null);
    if (!selected) {
      if (Platform.OS !== 'android') setPickerStep(null);
      return;
    }
    setPendingPickedDate(selected);
    if (Platform.OS === 'android') {
      // Android shows one native dialog per mode; chain date -> time.
      setPickerStep('time');
    }
  }

  function handleTimeStepChange(_: unknown, selected?: Date) {
    setPickerStep(null);
    if (!selected || !pendingPickedDate) return;
    const combined = new Date(pendingPickedDate);
    combined.setHours(selected.getHours(), selected.getMinutes());
    setCustomDate(combined);
    setQuickOption(null);
    setDateError(null);
  }

  function handleCancel() {
    if (isFormDirty) {
      setShowCancelConfirm(true);
      return;
    }
    router.back();
  }

  /**
   * Recomputes the quick-option open date from the real clock at call time
   * (design/flows/f1-create-capsule.md "Giả định": mốc nhanh tính lại tại thời
   * điểm bấm 'Khóa hộp'). `previewOpenDate` is only a memoized display value and
   * can go stale if the user leaves the form open or the system clock changes
   * between opening it and tapping submit — never use it to decide validity.
   */
  function computeOpenDateNow(): Date | null {
    if (customDate) return customDate;
    const quick = QUICK_OPTIONS.find((o) => o.key === quickOption);
    return quick ? addDays(new Date(), quick.addDays) : null;
  }

  async function handleSubmit() {
    const finalOpenDate = computeOpenDateNow();
    if (!finalOpenDate || finalOpenDate.getTime() <= Date.now()) {
      setDateError('Ngày mở phải ở tương lai');
      return;
    }

    setSubmitting(true);
    setDateError(null);
    try {
      const [capsule] = await Promise.all([
        createCapsule({
          title: title.trim(),
          message: message.trim(),
          photoUri,
          templateType,
          reflectionQuestion: reflectionQuestion.trim() || null,
          openDate: finalOpenDate.toISOString(),
        }),
        new Promise((resolve) => setTimeout(resolve, 300)), // min spinner time (screens.md)
      ]);
      // Use the capsule's actual persisted openDate (not the pre-submit preview)
      // so the confirmation always matches what was really saved.
      setSuccessOpenDate(new Date(capsule.openDate));
      setShowSuccess(true);
      setTimeout(() => router.replace({ pathname: '/', params: { openDate: capsule.openDate } }), 900);
    } catch (err) {
      setDateError(err instanceof Error ? err.message : 'Ngày mở phải ở tương lai');
      setSubmitting(false);
    }
  }

  const canSubmit = title.trim().length > 0 && message.trim().length > 0 && !submitting;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={handleCancel} hitSlop={12}>
          <Text style={styles.headerAction}>Hủy</Text>
        </Pressable>
        <Text style={typography.heading}>Tạo hộp mới</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Template Selector — F9 */}
        <View style={styles.templateGrid}>
          {TEMPLATE_TYPES.map((type) => {
            const selected = type === templateType;
            return (
              <Pressable
                key={type}
                onPress={() => selectTemplate(type)}
                style={[styles.templateCard, selected && styles.templateCardSelected]}
              >
                <Text style={styles.templateIcon}>{TEMPLATE_ICONS[type]}</Text>
                <Text style={[styles.templateLabel, selected && styles.templateLabelSelected]}>
                  {TEMPLATE_PRESETS[type].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Title */}
        <Text style={styles.fieldLabel}>Tiêu đề</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Tiêu đề ngắn cho hộp này..."
          placeholderTextColor={colors.textMuted}
          maxLength={60}
          style={styles.input}
        />

        {/* Message */}
        <Animated.View style={{ opacity: contentFade }}>
          <Text style={styles.fieldLabel}>Lời nhắn</Text>
          <TextInput
            value={message}
            onChangeText={(t) => {
              setMessage(t);
              setMessageTouched(true);
            }}
            placeholder={TEMPLATE_PRESETS[templateType].messagePlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, styles.messageInput]}
          />

          {/* Reflection question */}
          <Text style={styles.fieldLabel}>Câu hỏi cho tương lai (Yes/No)</Text>
          <TextInput
            value={reflectionQuestion}
            onChangeText={(t) => {
              setReflectionQuestion(t);
              setReflectionTouched(true);
            }}
            placeholder="Bỏ trống nếu không cần câu hỏi phản tư"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </Animated.View>

        {/* Photo picker — F8 */}
        <Text style={styles.fieldLabel}>Ảnh đính kèm (tùy chọn)</Text>
        {photoUri ? (
          <View style={styles.photoPreviewWrap}>
            <Animated.Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <Pressable onPress={handleRemovePhoto} style={styles.photoRemove} hitSlop={8}>
              <Text style={styles.photoRemoveLabel}>×</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handlePickPhoto} style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderIcon}>📷</Text>
            <Text style={styles.photoPlaceholderText}>Thêm ảnh (tùy chọn)</Text>
          </Pressable>
        )}

        {/* Date picker — F6 */}
        <Text style={styles.fieldLabel}>Ngày mở</Text>
        <View style={styles.quickRow}>
          {QUICK_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => handleQuickOption(opt.key)}
              style={[styles.quickChip, quickOption === opt.key && styles.quickChipSelected]}
            >
              <Text
                style={[styles.quickChipLabel, quickOption === opt.key && styles.quickChipLabelSelected]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={handleOpenCustomPicker} style={styles.quickChip}>
            <Text style={styles.quickChipLabel}>Chọn ngày khác...</Text>
          </Pressable>
        </View>
        {previewOpenDate && (
          <Text style={styles.dateSummary}>Mở vào: {formatDateTime(previewOpenDate)}</Text>
        )}
        {dateError && <Text style={styles.errorText}>{dateError}</Text>}

        {pickerStep === 'date' && (
          <DateTimePicker
            value={pendingPickedDate ?? new Date()}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleDateStepChange}
          />
        )}
        {pickerStep === 'time' && (
          <DateTimePicker
            value={pendingPickedDate ?? new Date()}
            mode="time"
            display="default"
            onChange={handleTimeStepChange}
          />
        )}
      </ScrollView>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
      >
        <Text style={styles.submitLabel}>{submitting ? 'Đang khóa...' : '🔒 Khóa hộp'}</Text>
      </Pressable>

      {showCancelConfirm && (
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <Text style={typography.heading}>Hủy và mất nội dung đang soạn?</Text>
            <View style={styles.confirmRow}>
              <Pressable onPress={() => setShowCancelConfirm(false)} style={styles.confirmSecondary}>
                <Text style={styles.confirmSecondaryLabel}>Tiếp tục soạn</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  // User discards the whole form — a picked photo is now orphaned
                  // in app storage since no capsule will reference it, so clean it up.
                  deletePhoto(photoUri);
                  router.back();
                }}
                style={styles.confirmPrimary}
              >
                <Text style={styles.confirmPrimaryLabel}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {showSuccess && successOpenDate && (
        <Snackbar message={`Hộp đã được khóa! Hẹn gặp lại vào ${formatDateTime(successOpenDate)}`} />
      )}
      {!showSuccess && toast && <Snackbar message={toast} />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerAction: { ...typography.body, color: colors.primaryDark, width: 40 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  templateCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  templateCardSelected: { borderColor: colors.primary, borderWidth: 2 },
  templateIcon: { fontSize: 24 },
  templateLabel: { ...typography.caption, color: colors.text },
  templateLabelSelected: { color: colors.primaryDark, fontWeight: '600' },
  fieldLabel: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  messageInput: { minHeight: 110, textAlignVertical: 'top' },
  photoPlaceholder: {
    height: 120,
    width: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoPlaceholderIcon: { fontSize: 28 },
  photoPlaceholderText: { ...typography.caption, color: colors.textMuted },
  photoPreviewWrap: { width: 120, height: 120 },
  photoPreview: { width: 120, height: 120, borderRadius: radii.md },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveLabel: { color: colors.surface, fontSize: 14, lineHeight: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  quickChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  quickChipLabel: { ...typography.caption, color: colors.text },
  quickChipLabelSelected: { color: colors.surface, fontWeight: '600' },
  dateSummary: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  submitButton: {
    margin: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: { backgroundColor: colors.surfaceMuted },
  submitLabel: { ...typography.heading, color: colors.surface },
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
  confirmDialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
  },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  confirmSecondary: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  confirmSecondaryLabel: { ...typography.body, color: colors.textMuted },
  confirmPrimary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
  },
  confirmPrimaryLabel: { ...typography.body, color: colors.surface, fontWeight: '600' },
});
