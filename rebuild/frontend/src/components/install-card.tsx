'use client';

import { useEffect, useState } from 'react';

/** «📱 ثبّت السيستم على الموبايل»: steps for iPhone/Android, and a note when it is already installed. */
export function InstallCard() {
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return (
    <div className="card" style={{ marginTop: 14 }} id="installCard">
      <h3>📱 ثبّت السيستم على الموبايل</h3>
      {standalone ? (
        <div style={{ color: 'var(--green)' }}>✔ السيستم متثبّت ومفتوح كتطبيق.</div>
      ) : (
        <div style={{ lineHeight: 2 }}>
          {ios ? (
            <>
              <b>على الآيفون (من Safari):</b>
              <br />١) دوس زرار المشاركة ⬆️ تحت.
              <br />٢) اختار «إضافة إلى الشاشة الرئيسية».
              <br />٣) دوس «إضافة». هتلاقي أيقونة «ميكانيزم» زي أي تطبيق وبتفتح بشاشة كاملة.
            </>
          ) : (
            <>
              <b>على الأندرويد (من Chrome):</b>
              <br />١) دوس القايمة ⋮ فوق.
              <br />٢) اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».
              <br />
              <b>على الآيفون:</b> من Safari، زرار المشاركة ← «إضافة إلى الشاشة الرئيسية».
            </>
          )}
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>ملحوظة: الإشعارات على الموبايل لسه بتيجي على الواتساب. إشعارات التطبيق نفسه محتاجة عنوان ثابت للسيستم، وده بيتحدد لما نختار الاستضافة.</div>
        </div>
      )}
    </div>
  );
}
