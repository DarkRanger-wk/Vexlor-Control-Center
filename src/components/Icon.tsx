import type { ReactNode, SVGProps } from 'react'

type IconName =
  | 'dashboard'
  | 'monitor'
  | 'library'
  | 'performance'
  | 'network'
  | 'tools'
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
