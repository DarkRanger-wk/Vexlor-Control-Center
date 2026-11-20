import { Icon, type IconName } from './Icon'

interface SidebarProps {
  activeItem: string
  compact: boolean
  username: string
  supportUnreadCount?: number
  iconOverrides?: Record<string, string>
  onSelect: (page: string) => void
}

const navigation: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'System Monitor', icon: 'monitor' },
  { label: 'Spielebibliothek', icon: 'library' },
  { label: 'Performance', icon: 'performance' },
  { label: 'Network Center', icon: 'network' },
  { label: 'Gaming Tools', icon: 'tools' },
  { label: 'Codes einlösen', icon: 'spark' },
  { label: 'Vexlor Arcade', icon: 'arcade' },
  { label: 'Support & Hilfe', icon: 'network' },
  { label: 'Screenshot Tool', icon: 'screenshot' },
]

const preferences: { label: string; icon: IconName }[] = [
  { label: 'Customization', icon: 'spark' },
  { label: 'Einstellungen', icon: 'settings' },
  { label: 'Vexlor Admin Panel', icon: 'settings' },
  { label: 'Über Vexlor', icon: 'arrow' },
]

const iconNames: IconName[] = [
  'dashboard', 'monitor', 'library', 'performance', 'network', 'tools', 'arcade', 'target',
  'clock', 'crown', 'bolt', 'launch', 'screenshot', 'copy', 'save', 'zoomIn', 'zoomOut',
  'settings', 'refresh', 'cpu', 'memory', 'windows', 'spark', 'arrow',
]

export function Sidebar({ activeItem, compact, username, supportUnreadCount = 0, iconOverrides = {}, onSelect }: SidebarProps) {
  const displayName = username.trim() || 'Lokales Profil'
  const avatar = username.trim() ? Array.from(username.trim())[0].toLocaleUpperCase('de-DE') : 'V'
  return (
    <aside className={`sidebar${compact ? ' compact' : ''}`}>
      <button className="brand" onClick={() => onSelect('Dashboard')} aria-label="Vexlor Control Center Startseite">
        <span className="brand-mark"><span /></span>
        <span className="brand-copy"><strong>VEXLOR</strong><small>CONTROL CENTER</small></span>
      </button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="navigation" aria-label="Hauptnavigation">
        {navigation.map((item) => <NavItem key={item.label} item={item} iconOverrides={iconOverrides} unread={item.label === 'Support & Hilfe' ? supportUnreadCount : 0} activeItem={activeItem} onSelect={onSelect} />)}
      </nav>
      <div className="sidebar-label sidebar-section-label">PREFERENCES</div>
      <nav className="navigation" aria-label="Einstellungen und Informationen">
        {preferences.map((item) => <NavItem key={item.label} item={item} iconOverrides={iconOverrides} activeItem={activeItem} onSelect={onSelect} />)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status"><span className="status-orb" /><span>System lokal verbunden</span></div>
      <div className="sidebar-footer"><span className="sidebar-avatar">{avatar}</span><span className="sidebar-user"><strong>{displayName}</strong><small>Dieser PC</small></span><span className="local-lock" aria-label="Daten bleiben lokal">●</span></div>
    </aside>
  )
}

function NavItem({ item, iconOverrides, unread = 0, activeItem, onSelect }: {
  item: { label: string; icon: IconName }
  iconOverrides: Record<string, string>
  unread?: number
  activeItem: string
  onSelect: (page: string) => void
}) {
  const active = item.label === activeItem
  const override = iconOverrides[item.label]
  const icon = iconNames.includes(override as IconName) ? override as IconName : item.icon
  return <button className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => onSelect(item.label)} title={item.label}><Icon name={icon} /><span>{item.label}</span>{unread > 0 && <span className="nav-unread" aria-label={`${unread} ungelesene Support-Antworten`}>{unread > 99 ? '99+' : unread}</span>}{active && <span className="nav-indicator" />}</button>
}
