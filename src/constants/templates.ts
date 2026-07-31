import type { TemplateType } from '../types/capsule';

/**
 * Static presets (schema.md decision: templates are code constants, not a DB table).
 * Used only to prefill the create-capsule form (F9); once a capsule is created, the
 * prefilled values are copied into `message`/`reflectionQuestion` on the record itself.
 */
export interface TemplatePreset {
  label: string;
  messagePlaceholder: string;
  defaultReflectionQuestion: string | null;
}

export const TEMPLATE_PRESETS: Record<TemplateType, TemplatePreset> = {
  free: {
    label: 'Lời nhắn tự do',
    messagePlaceholder: 'Hôm nay bạn muốn nói gì với chính mình trong tương lai?',
    defaultReflectionQuestion: null,
  },
  goal: {
    label: 'Mục tiêu',
    messagePlaceholder: 'Mục tiêu bạn đang đặt ra là gì? Vì sao nó quan trọng với bạn?',
    defaultReflectionQuestion: 'Bạn đã đạt được mục tiêu này chưa?',
  },
  memory: {
    label: 'Kỷ niệm',
    messagePlaceholder: 'Kể lại khoảnh khắc đáng nhớ này, kèm theo một tấm ảnh nếu muốn.',
    defaultReflectionQuestion: 'Kỷ niệm này vẫn khiến bạn mỉm cười chứ?',
  },
  decision: {
    label: 'Quyết định',
    messagePlaceholder: 'Bạn đang đứng trước quyết định gì? Lý do bạn chọn như vậy?',
    defaultReflectionQuestion: 'Bạn có hài lòng với quyết định này không?',
  },
};

export const TEMPLATE_TYPES: TemplateType[] = ['free', 'goal', 'memory', 'decision'];
