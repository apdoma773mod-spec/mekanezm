// One consistent line-icon set (24px grid, 1.75 stroke, round caps) for the admin screens.
const P: Record<string, string> = {
  products: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  sections: 'M3 7h18M3 12h18M3 17h18',
  works: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  look: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.8-.5-1.2-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01',
  banner: 'M3 5h18v14H3V5Zm0 11 5-5 4 4 3-3 6 6M15.5 9.5h.01',
  text: 'M4 6V4h16v2M12 4v16M9 20h6',
  reviews: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  pros: 'M14.7 6.3a4 4 0 0 0 5 5L21 21l-1 0-9.4-9.4a4 4 0 0 1-5-5l3 3 2-2-3-3a4 4 0 0 1 5 5',
  ship: 'M3 7h11v9H3V7Zm11 3h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  more: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.600 3h-4l-.4 2.7a7.600 7.600 0 0 0-2 1.200l-2.300-1-2 3.400 2 1.500a7.400 7.400 0 0 0 0 2.400l-2 1.500 2 3.400 2.300-1a7.600 7.600 0 0 0 2 1.200l.4 2.700h4l.4-2.700a7.600 7.600 0 0 0 2-1.200l2.300 1 2-3.400-2-1.500c.1-.4.100-.8.100-1.200Z',
};
export function Ico({ n, size = 20 }: { n: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] ?? P.more} /></svg>;
}
