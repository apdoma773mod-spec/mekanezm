export const NAV: [string, string, string][] = [
  ['dash','🏠','الرئيسية'],['prod','📦','المنتجات'],['post','🖼️','البوستات'],['img','✨','الصور الذكية'],
  ['vid','🎬','فيديو سهل'],['ed','✂️','مونتاج متقدم'],['inb','💬','الوارد'],['ai','🤖','الذكاء'],
  ['cal','📅','التقويم'],['theme','🎨','المظهر'],['set','⚙️','الإعدادات'],
];
export const THEMES: Record<string, Record<string, string>> = {
  gold: { '--bg':'#0B0B0C','--sf':'#141416','--tx':'#F3EFE6','--a1':'#F6DC8A','--a2':'#D4A537','--a3':'#8F6A1E' },
  blue: { '--bg':'#0A0E14','--sf':'#121821','--tx':'#E8F0FA','--a1':'#9CCBFF','--a2':'#3E8EDE','--a3':'#1E5A9C' },
  green:{ '--bg':'#0A0F0C','--sf':'#121A15','--tx':'#EAF5EC','--a1':'#A5EBB5','--a2':'#3FB362','--a3':'#1E7A3C' },
};
