// One authored stroke icon set (1.6px, round caps) so controls never fall back to glyphs.
type Name = 'next' | 'prev' | 'pause' | 'motion'

const paths: Record<Name, string> = {
  next: 'M5 12h13M13 6l6 6-6 6',
  prev: 'M19 12H6M11 6l-6 6 6 6',
  pause: 'M8 5v14M16 5v14',
  motion: 'M3 12c3-5 6-5 9 0s6 5 9 0',
}

export function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  )
}
