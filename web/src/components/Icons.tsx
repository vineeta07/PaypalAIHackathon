import type { SVGProps } from 'react';
const base = (p: SVGProps<SVGSVGElement>) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p });
export const Logo = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} viewBox="0 0 32 32" stroke="none"><rect width="32" height="32" rx="9" fill="currentColor" /><path d="M9 17a7 7 0 0 1 12-5l2-2v6h-6l2-2a4 4 0 1 0 1 4h3a7 7 0 0 1-14-1z" fill="rgb(var(--card))" /></svg>);
export const Home = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>);
export const Heart = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>);
export const Store = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6" /></svg>);
export const List = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>);
export const Sun = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const Moon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>);
export const Check = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const Clock = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const Spark = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>);
export const Shield = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>);
export const Pause = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>);
export const Send = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>);
export const Refresh = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4" /></svg>);
export const Lock = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
export const Close = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const Globe = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" /></svg>);
export const Menu = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const Compass = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>);
export const Book = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19" /></svg>);
export const Arrow = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Chevron = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>);
export const Plus = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const Users = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></svg>);
export const Card2 = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></svg>);
export const Split = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 12h6l4-6h6M10 12l4 6h6M17 3l3 3-3 3M17 15l3 3-3 3" /></svg>);
export const Pen = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>);
export const Calendar = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>);

export function BakeArt({ kind, className = '' }: { kind: string; className?: string }) {
  const c = { cake: '#e8a0a8', cupcake: '#f3c98b', bread: '#d9a066', cookie: '#c98d5a' }[kind] || '#e8a0a8';
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden="true">
      <rect width="120" height="90" rx="14" fill="rgb(var(--warmsoft))" />
      {kind === 'cake' && (<g><rect x="30" y="42" width="60" height="30" rx="5" fill="#7a4a3a" /><rect x="30" y="38" width="60" height="12" rx="6" fill={c} /><path d="M34 50q6 6 12 0t12 0 12 0 12 0 6 0" stroke="#fff" strokeWidth="3" fill="none" /><rect x="58" y="22" width="4" height="16" rx="2" fill="#5b8def" /><ellipse cx="60" cy="19" rx="3" ry="5" fill="#f5b041" /></g>)}
      {kind === 'cupcake' && (<g><path d="M40 50h40l-6 24H46z" fill="#c0816a" /><path d="M38 50c0-14 10-22 22-22s22 8 22 22z" fill={c} /><circle cx="60" cy="27" r="5" fill="#d94f5c" /></g>)}
      {kind === 'bread' && (<g><ellipse cx="60" cy="52" rx="34" ry="20" fill={c} /><path d="M42 44l8 8M56 40l8 8M70 42l8 8" stroke="#8a5a2b" strokeWidth="3" strokeLinecap="round" /></g>)}
      {kind === 'cookie' && (<g><circle cx="48" cy="48" r="20" fill={c} /><circle cx="76" cy="52" r="17" fill="#d9a066" />{[[42, 42], [52, 52], [46, 56], [74, 46], [80, 58]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#5a3825" />)}</g>)}
    </svg>
  );
}
export function Avatar({ who, size = 40 }: { who: 'lender' | 'borrower' | 'customer'; size?: number }) {
  const bg = { lender: '#dfe5ef', borrower: '#f1e4cf', customer: '#dbe9e0' }[who];
  const fg = { lender: '#2d4670', borrower: '#7a4a12', customer: '#1f5a3c' }[who];
  const letter = { lender: 'M', borrower: 'R', customer: 'C' }[who];
  return (<svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill={bg} /><text x="20" y="26" textAnchor="middle" fontSize="17" fontWeight="700" fill={fg} fontFamily="Inter, sans-serif">{letter}</text></svg>);
}
