// A made-up dressing room, shown by «شوف مثال» so the craftsman sees what he will get before uploading.
import { normalize } from '@/lib/takeoff';

export const SAMPLE = {
  model: normalize({
    kind: 'dressing', summary: 'دريسنج: دولاب جرار 3 ضلف + دولاب مفصلي ضلفتين + وحدة أدراج', quality: 'clear',
    units: [
      { name: 'دولاب جرار 240', type: 'wardrobe', count: 1, w: 240, h: 240, d: 60, mount: 'floor', plinth: true, doors: [{ kind: 'sliding', material: 'wood', count: 3 }], drawers: [{ count: 4, inner: true }], shelves_adjustable: 6, shelves_fixed: 2, dividers: 2, rails: [{ len: 78 }, { len: 78 }], handles: 'handle', confidence: 0.92 },
      { name: 'دولاب مفصلي 100', type: 'wardrobe', count: 1, w: 100, h: 220, d: 55, mount: 'floor', plinth: true, doors: [{ kind: 'hinged', material: 'wood', count: 2, h: 210, w: 49.5 }], shelves_adjustable: 3, shelves_fixed: 1, dividers: 0, rails: [{ len: 96 }], pullouts: [{ kind: 'trouser', count: 1 }], handles: 'handle', confidence: 0.9 },
      { name: 'وحدة أدراج 80', type: 'drawer_unit', count: 1, w: 80, h: 90, d: 50, mount: 'floor', plinth: true, drawers: [{ count: 4, inner: false }], handles: 'handle', confidence: 0.88 },
    ],
    questions: [], assumptions: ['سُمك الخشب 1.8 سم'],
  }),
  doubt: [] as string[], warnings: [] as string[], thumbs: [] as string[],
};
