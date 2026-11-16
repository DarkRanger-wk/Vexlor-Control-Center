import { Icon, type IconName } from './Icon'

interface SidebarProps {
  activeItem: string
  compact: boolean
  onSelect: (page: string) => void
}

const navigation: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'System Monitor', icon: 'monitor' },
  { label: 'Spielebibliothek', icon: 'library' },
  { label: 'Performance', icon: 'performance' },
  { label: 'Network Center', icon: 'network' },
  { label: 'Gaming Tools', icon: 'tools' },
  { label: 'Screenshot Tool', icon: 'screenshot' },
]

const preferences: { label: string; icon: IconName }[] = [
  { label: 'Anpassung', icon: 'spark' },
  { label: 'Einstellungen', icon: 'settings' },
  { label: 'Über Vexlor', icon: 'arrow' },
]

export function Sidebar({ activeItem, compact, onSelect }: SidebarProps) {
  return (
    <aside className={`sidebar${compact ? ' compact' : ''}`}>
      <button className="brand" onClick={() => onSelect('Dashboard')} aria-label="Vexlor Control Center Startseite">
        <span className="brand-mark"><span /></span>
        <span className="brand-copy"><strong>VEXLOR</strong><small>CONTROL CENTER</small></span>
      </button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="navigation" aria-label="Hauptnavigation">
        {navigation.map((item) => <NavItem key={item.label} item={item} activeItem={activeItem} onSelect={onSelect} />)}
      </nav>
      <div className="sidebar-label sidebar-section-label">PREFERENCES</div>
      <nav className="navigation" aria-label="Einstellungen und Informationen">
        {preferences.map((item) => <NavItem key={item.label} item={item} activeItem={activeItem} onSelect={onSelect} />)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status"><span className="status-orb" /><span>System lokal verbunden</span></div>
      <div className="sidebar-footer"><span className="sidebar-avatar">V</span><span className="sidebar-user"><strong>Lokales Profil</strong><small>Dieser PC</small></span><span className="local-lock" aria-label="Daten bleiben lokal">●</span></div>
    </aside>
  )
}

function NavItem({ item, activeItem, onSelect }: { item: { label: string; icon: IconName }; activeItem: string; onSelect: (page: string) => void }) {
  const active = item.label === activeItem
  return <button className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => onSelect(item.label)} title={item.label}><Icon name={item.icon} /><span>{item.label}</span>{active && <span className="nav-indicator" />}</button>
}
