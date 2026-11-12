'use client';

import { useState, type CSSProperties } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from './ui/toast';

/**
 * ✨ زرار «اكتب الوصف» الموحّد — نفسه في كل شاشة بتجهّز منتج (تفاصيل وصور، انشره ع الموقع، إدارة الموقع).
 * السيرفر بيكتب وصف ومواصفات من الاسم والمعلومات المؤكدة وأول صورة، وبيشيل أي رقم مش مذكور (مفيش اختراع مقاسات).
 */
export interface AiDesc {
  description: string;
  specs: { k: string; v: string }[];
}
export interface AiDescInput {
  name: string;
  cat?: string;
  /** معلومات مؤكدة بنص حر: الماركة، التشطيب، المقاس، مواصفات مكتوبة… */
  hint?: string;
  /** أول صورة للمنتج (لينك أو نسبي) */
  image_url?: string;
}

/** بيجمّع المعلومات المؤكدة في نص واحد وبيشيل الفاضي */
export const hintOf = (o: Record<string, string | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v!.trim()}`)
    .join('، ');

export function AiDescribeButton({
  build,
  onDone,
  id,
  style,
}: {
  /** بيرجّع المدخلات، أو نص خطأ لو ناقص حاجة (مثلاً الاسم) */
  build: () => AiDescInput | string;
  onDone: (r: AiDesc) => void;
  id?: string;
  style?: CSSProperties;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="secondary"
      id={id}
      disabled={busy}
      style={{ padding: '4px 10px', fontSize: 13, width: 'auto', ...style }}
      onClick={async () => {
        const input = build();
        if (typeof input === 'string') return toast(input, 'bad');
        setBusy(true);
        try {
          const r = await api.post<AiDesc>('/ai/describe-product', { name: input.name, cat: input.cat ?? '', hint: input.hint ?? '', image_url: input.image_url ?? '' });
          onDone({ description: r.description, specs: r.specs ?? [] });
        } catch (e) {
          toast(`الوصف ماتكتبش: ${errorMessage(e)}`, 'bad');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? '⏳ بيكتب…' : '✨ اكتب الوصف'}
    </button>
  );
}
