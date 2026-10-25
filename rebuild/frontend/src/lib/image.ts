/** Shrinks a picked image so it can be stored inline in the settings (the old system kept base64 too). */
export function fileToDataUrl(file: File, maxSide: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('مقدرتش أقرا الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('الملف ده مش صورة'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG keeps logo transparency; photos (backgrounds) are smaller as JPEG.
        resolve(file.type === 'image/png' && maxSide <= 800 ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
