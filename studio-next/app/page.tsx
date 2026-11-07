import './studio.css';
import StudioApp from '@/components/StudioApp';

export const metadata = { title: 'استوديو ميكانيزم' };

export default function Page() {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&family=Cairo:wght@400;600;700;900&family=Changa:wght@500;800&family=Tajawal:wght@400;700;900&family=Reem+Kufi:wght@500;700&family=El+Messiri:wght@500;700&family=Lalezar&family=Marhey:wght@500;700&display=swap" />
      <StudioApp />
    </>
  );
}
