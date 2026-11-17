import type { ReactNode, SVGProps } from 'react'

type IconName =
  | 'dashboard'
  | 'monitor'
  | 'library'
  | 'performance'
  | 'network'
  | 'tools'
  | 'arcade'
  | 'target'
  | 'clock'
  | 'crown'
  | 'bolt'
  | 'launch'
  | 'screenshot'
  | 'copy'
  | 'save'
  | 'zoomIn'
  | 'zoomOut'
  | 'settings'
  | 'refresh'
  | 'cpu'
  | 'memory'
  | 'windows'
  | 'spark'
  | 'arrow'
  | 'minimize'
  | 'maximize'
  | 'close'

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  library: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 6h13M8 3v17" /></>,
  performance: <><path d="M4 19V5m0 14h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
  network: <><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7M5.7 5.7a9 9 0 0 0 0 12.6m12.6-12.6a9 9 0 0 1 0 12.6" /></>,
  tools: <><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-2-2z" /><path d="m16 4 4 4" /></>,
  arcade: <><path d="M7 9h10a4 4 0 0 1 3.8 2.8l1 3.4a2.5 2.5 0 0 1-4.1 2.5L15 16h-6l-2.7 2.7a2.5 2.5 0 0 1-4.1-2.5l1-3.4A4 4 0 0 1 7 9Z" /><path d="M8 12v4m-2-2h4m7-.5h.01M18 15.5h.01" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /><path d="m16 8 5-5m-4 0h4v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  crown: <><path d="m3 8 5 4 4-7 4 7 5-4-2 12H5z" /><path d="M5 17h14" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7z" />,
  launch: <><path d="M12 15c3-2 5-5 5-10-5 0-8 2-10 5l-2 7z" /><path d="M10 14 6 18m2-8-4 1 3 3m6 0-1 4-3-3" /><circle cx="13" cy="8" r="1" /></>,
  screenshot: <><path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3" /><rect x="7" y="7" width="10" height="10" rx="1.5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  save: <><path d="M5 3h12l4 4v14H3V3z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></>,
  zoomIn: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5M10.8 7.8v6m-3-3h6" /></>,
  zoomOut: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5m-13.2-10.2h6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4.9 9A7.5 7.5 0 0 1 18 6l2 1m-15 10v-5h5" /><path d="M19.1 15A7.5 7.5 0 0 1 6 18l-2-1" /></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 9h6v6H9zM9 2v4m6-4v4m-6 12v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" /></>,
  memory: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10v4m4-4v4m4-4v4m4-4v4M7 3v3m5-3v3m5-3v3M7 18v3m5-3v3m5-3v3" /></>,
  windows: <><path d="M3 5.5 10 4v7H3zm8-1.7 10-1.6v8.8H11zM3 12h7v7l-7-1.5zm8 0h10v9.5l-10-1.6z" /></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  minimize: <path d="M5 12h14" />,
  maximize: <rect x="5" y="5" width="14" height="14" rx="1" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
}

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

export type { IconName }
