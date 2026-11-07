'use client';

import { useEffect, useRef, useState } from 'react';
import type { StaffDto } from '@mk/shared';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useAddFace, useDeleteFace, useFacePhotos } from '@/lib/camera-queries';
import { fileToDataUrl } from '@/lib/image';

const STATE = { pending: '⏳ مستنية الجسر', ready: '✅ جاهزة', noface: '❌ مفيش وش واضح' } as const;

/** 📸 صور الوش: 2–5 صور واضحة للعامل (من الموبايل أو كاميرا الكمبيوتر) عشان الكاميرات تعرفه. */
export function FacesModal({ s, onClose }: { s: StaffDto; onClose: () => void }) {
  const toast = useToast();
  const q = useFacePhotos(s.id);
  const add = useAddFace();
  const del = useDeleteFace();
  const file = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<MediaStream | null>(null);

  useEffect(() => () => cam?.getTracks().forEach((t) => t.stop()), [cam]);
  useEffect(() => {
    if (cam && video.current) video.current.srcObject = cam;
  }, [cam]);

  const save = async (photo: string) => {
    try {
      await add.mutateAsync({ staffId: s.id, photo });
      toast('✔ الصورة اتضافت');
    } catch (e) {
      toast(`ماتضافتش: ${errorMessage(e)}`, 'bad');
    }
  };
  const pick = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      try {
        await save(await fileToDataUrl(f, 1000));
      } catch (e) {
        toast(errorMessage(e), 'bad');
      }
    }
    if (file.current) file.current.value = '';
  };
  const openCam = async () => {
    try {
      setCam(await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } } }));
    } catch {
      toast('الكاميرا مش متاحة — اختار صورة من الجهاز', 'bad');
    }
  };
  const closeCam = () => {
    cam?.getTracks().forEach((t) => t.stop());
    setCam(null);
  };
  const shot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    await save(c.toDataURL('image/jpeg', 0.85));
  };
  const photos = q.data ?? [];

  return (
    <Modal title={`📸 صور الوش — ${s.name}`} onClose={onClose} wide>
      <p style={{ margin: '0 0 10px', color: '#7b8a90' }}>
        صوّره 2 لـ 5 صور واضحة: وشه قدام الكاميرا، إضاءة كويسة، من غير نضارة شمس أو كمامة، وواحدة بزاوية خفيفة. الجسر بيحسبها لوحده في دقيقة تقريبًا.
      </p>
      <div className="fc-grid" id="faceGrid">
        {photos.map((p) => (
          <div key={p.id} className="fc-item">
            <img src={p.photo} alt="" />
            <small>{STATE[p.status]}</small>
            <button type="button" className="secondary" onClick={() => del.mutate(p.id)}>
              🗑️ مسح
            </button>
          </div>
        ))}
        {!photos.length && <div className="empty">لسه مفيش صور</div>}
      </div>
      {cam && (
        <div style={{ textAlign: 'center', margin: '10px 0' }}>
          <video ref={video} autoPlay playsInline muted style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 12 }} />
          <div>
            <button type="button" className="primary" id="faceShot" onClick={shot}>
              📷 التقط
            </button>{' '}
            <button type="button" className="secondary" onClick={closeCam}>
              اقفل الكاميرا
            </button>
          </div>
        </div>
      )}
      <div className="modal-foot">
        <input ref={file} id="faceFile" type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
        <button type="button" className="primary" onClick={() => file.current?.click()}>
          📱 صورة من الموبايل / الجهاز
        </button>
        <button type="button" className="secondary" onClick={openCam} disabled={!!cam}>
          💻 كاميرا الكمبيوتر
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          تمام
        </button>
      </div>
    </Modal>
  );
}
