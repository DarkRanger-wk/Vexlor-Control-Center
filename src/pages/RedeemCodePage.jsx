import { useEffect, useState } from 'react'
import packageJson from '../../package.json'
import { Icon } from '../components/Icon'
import { applyThemeToValues, themePresets } from '../services/customization.mjs'
import '../styles/redeem.css'

const apiBaseUrl = 'https://infos-vcc.pages.dev'
const equippableRewardTypes = new Set(['badge', 'profile_badge', 'frame', 'profile_frame', 'profile_color', 'color', 'theme'])

async function loadPublicCollection(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, { headers: { Accept: 'application/json' } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Inhalte konnten nicht geladen werden.')
  return body
}

async function loadOwnedRewards() {
  const response = await window.vcc.ticketRequest('/api/codes/rewards')
  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.body.error || 'Belohnungen konnten nicht geladen werden.')
  }
  return response.body
}

function rewardTitle(code) {
  if (code.rewardType === 'premium') return `Premium · ${Math.max(1, Math.round(Number(code.rewardValue) / 86400))} Tage`
  const labels = {
    badge: 'Profilabzeichen',
    profile_badge: 'Profilabzeichen',
    frame: 'Profilrahmen',
    profile_frame: 'Profilrahmen',
    profile_color: 'Profilfarbe',
    color: 'Profilfarbe',
    theme: `Design · ${themePresets.find((theme) => theme.id === code.rewardValue)?.name ?? code.rewardValue}`,
    beta_access: 'Beta-Zugang',
    feature: 'Feature',
  }
  return `${labels[code.rewardType] ?? code.rewardType}${code.rewardValue ? ` · ${code.rewardValue}` : ''}`
}

function rewardFromInventory(reward) {
  return {
    id: reward.id,
    type: reward.reward_type,
    value: reward.reward_value,
    name: reward.display_name,
    equipped: Boolean(reward.equipped),
    createdAt: reward.created_at,
  }
}

function statusLabel(status) {
  return ({ active: 'Aktiv', expired: 'Abgelaufen', redeemed: 'Aufgebraucht' })[status] ?? status
}

export default function RedeemCodePage() {
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [rewards, setRewards] = useState([])
  const [premiumUntil, setPremiumUntil] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [rewardError, setRewardError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPage, setLoadingPage] = useState(true)
  const [equipping, setEquipping] = useState('')
  const [appSettings, setAppSettings] = useState(null)

  useEffect(() => {
    let active = true
    window.vcc.getSettings().then((settings) => {
      if (active) setAppSettings(settings)
    }).catch((caught) => {
      if (active) setRewardError(caught instanceof Error ? caught.message : 'App-Einstellungen konnten nicht geladen werden.')
    })
    return () => { active = false }
  }, [])

  const saveRewardAccent = async (accent) => {
    if (!appSettings?.customization?.values?.colors) return false
    const customization = {
      ...appSettings.customization,
      values: {
        ...appSettings.customization.values,
        colors: { ...appSettings.customization.values.colors, accent },
      },
    }
    const saved = await window.vcc.saveSettings({ customization })
    setAppSettings(saved)
    window.dispatchEvent(new CustomEvent('vcc-settings-updated', { detail: saved }))
    return true
  }

  useEffect(() => {
    const activeColor = rewards.find((item) => item.equipped && ['profile_color', 'color'].includes(item.type))?.value
    const currentColors = appSettings?.customization?.values?.colors
    if (!activeColor || !currentColors || currentColors.accent === activeColor) return
    void saveRewardAccent(activeColor).catch((caught) => {
      setRewardError(caught instanceof Error ? caught.message : 'Die Profilfarbe konnte nicht gespeichert werden.')
    })
  }, [rewards, appSettings])

  useEffect(() => {
    let active = true
    const loadPage = async () => {
      try {
        const [codeData, announcementData] = await Promise.all([
          loadPublicCollection('/api/codes'),
          loadPublicCollection('/api/announcements'),
        ])
        if (!active) return
        setCodes(codeData.codes ?? [])
        setAnnouncements((announcementData.announcements ?? []).filter((item) => item.kind === 'code'))
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Codes konnten nicht geladen werden.')
      } finally {
        if (active) setLoadingPage(false)
      }

      try {
        const rewardData = await loadOwnedRewards()
        if (!active) return
        setRewards((rewardData.rewards ?? []).map(rewardFromInventory))
        setPremiumUntil(rewardData.premiumUntil ?? null)
      } catch (caught) {
        if (active) setRewardError(caught instanceof Error ? caught.message : 'Belohnungen konnten nicht geladen werden.')
      }
    }
    void loadPage()
    return () => { active = false }
  }, [])

  const refreshRewards = async () => {
    const rewardData = await loadOwnedRewards()
    setRewards((rewardData.rewards ?? []).map(rewardFromInventory))
    setPremiumUntil(rewardData.premiumUntil ?? null)
    setRewardError('')
  }

  const redeem = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await window.vcc.ticketRequest('/api/codes/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      })
      if (response.status < 200 || response.status >= 300) {
        throw new Error(response.body.error || 'Code konnte nicht eingelöst werden.')
      }
      const reward = response.body.reward
      setMessage(`Code erfolgreich eingelöst. Freigeschaltet: ${reward.name || rewardTitle({ rewardType: reward.type, rewardValue: reward.value })}.`)
      setCode('')
      await Promise.all([
        loadPublicCollection('/api/codes').then((body) => setCodes(body.codes ?? [])),
        refreshRewards(),
      ])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code konnte nicht eingelöst werden.')
    } finally {
      setLoading(false)
    }
  }

  const equipReward = async (reward) => {
    setEquipping(reward.id)
    setError('')
    setRewardError('')
    try {
      let nextThemeValues
      if (reward.type === 'theme' && !appSettings?.customization?.values) {
        throw new Error('Das App-Design ist noch nicht verfügbar.')
      }
      if (reward.type === 'theme' && reward.equipped) {
        const previous = localStorage.getItem('vcc-reward-theme-restore')
        if (!previous) throw new Error('Das vorherige Design konnte nicht wiederhergestellt werden.')
        nextThemeValues = JSON.parse(previous)
        if (!nextThemeValues || typeof nextThemeValues !== 'object'
          || !nextThemeValues.colors || !nextThemeValues.layout || !nextThemeValues.background) {
          throw new Error('Das gespeicherte Design zur Wiederherstellung ist ungültig.')
        }
      } else if (reward.type === 'theme') {
        const theme = themePresets.find((item) => item.id === reward.value)
        if (!theme) throw new Error('Das freigeschaltete Design ist nicht verfügbar.')
        nextThemeValues = applyThemeToValues(appSettings.customization.values, theme)
      }
      const response = await window.vcc.ticketRequest('/api/codes/rewards', {
        method: 'POST',
        body: JSON.stringify({ action: reward.equipped ? 'unequip' : 'equip', rewardId: reward.id }),
      })
      if (response.status < 200 || response.status >= 300) {
        throw new Error(response.body.error || 'Belohnung konnte nicht angelegt werden.')
      }
      const nextRewards = (response.body.rewards ?? []).map(rewardFromInventory)
      setRewards(nextRewards)
      if (['profile_color', 'color'].includes(reward.type) && appSettings?.customization?.values?.colors) {
        const colorIsBeingEquipped = !reward.equipped
        let nextAccent = nextRewards.find((item) => item.equipped && ['profile_color', 'color'].includes(item.type))?.value
        if (colorIsBeingEquipped && !rewards.some((item) => item.equipped && ['profile_color', 'color'].includes(item.type))) {
          localStorage.setItem('vcc-profile-color-restore', appSettings.customization.values.colors.accent)
        } else if (!nextAccent) {
          nextAccent = localStorage.getItem('vcc-profile-color-restore') || appSettings.accent || '#428BFF'
          localStorage.removeItem('vcc-profile-color-restore')
        }
        const saved = await saveRewardAccent(nextAccent)
        if (!saved) throw new Error('Die Profilfarbe konnte nicht in den App-Einstellungen gespeichert werden.')
      }
      if (reward.type === 'theme') {
        if (!reward.equipped) {
          if (!rewards.some((item) => item.type === 'theme' && item.equipped)) {
            localStorage.setItem('vcc-reward-theme-restore', JSON.stringify(appSettings?.customization?.values))
          }
        } else {
          localStorage.removeItem('vcc-reward-theme-restore')
        }
        const customization = { ...appSettings.customization, values: nextThemeValues }
        const saved = await window.vcc.saveSettings({ customization })
        setAppSettings(saved)
        window.dispatchEvent(new CustomEvent('vcc-settings-updated', { detail: saved }))
      }
    } catch (caught) {
      setRewardError(caught instanceof Error ? caught.message : 'Belohnung konnte nicht angelegt werden.')
    } finally {
      setEquipping('')
    }
  }

  const equippedColor = rewards.find((item) => item.equipped && ['profile_color', 'color'].includes(item.type))?.value

  return <div className="redeem-page" style={equippedColor ? { '--reward-accent': equippedColor } : undefined}>
    <header className="redeem-header">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" /> VEXLOR BELOHNUNGEN</div>
        <h1>Codes &amp; <span>Belohnungen</span></h1>
        <p>Aktuelle öffentliche Codes, Ankündigungen und alle Belohnungen, die du freigeschaltet hast.</p>
        <div className="redeem-version-pill">VCC-Version {packageJson.version}</div>
      </div>
    </header>

    {error && <div className="redeem-error" role="alert">{error}</div>}
    {message && <div className="redeem-message" role="status">{message}</div>}

    <div className="redeem-layout">
      <form className="redeem-card panel" onSubmit={redeem}>
        <div className="redeem-icon"><Icon name="spark" /></div>
        <div className="section-kicker">CODE EINLÖSEN</div>
        <label htmlFor="redeem-code">Öffentlichen Einlösecode eingeben</label>
        <input id="redeem-code" value={code} maxLength={128} placeholder="VEXLOR-XXXX-XXXX" onChange={(event) => setCode(event.target.value)} disabled={loading} autoComplete="off" />
        <p>Jeder Code kann pro App-Installation einmal verwendet werden. Die Prüfung und Freischaltung erfolgen sicher auf dem Server.</p>
        <button className="primary-button" type="submit" disabled={loading || code.trim().length < 4}>{loading ? 'Wird geprüft …' : 'Code einlösen'}</button>
      </form>

      <section className="redeem-rewards panel">
        <div className="panel-heading"><div><div className="section-kicker">DEIN PROFIL</div><h2>Freigeschaltete Belohnungen</h2></div><span className="count-pill">{rewards.length}</span></div>
        {premiumUntil && premiumUntil * 1000 > Date.now() && <div className="redeem-premium-status"><Icon name="crown" /> Premium aktiv bis {new Date(premiumUntil * 1000).toLocaleDateString('de-DE')}</div>}
        {rewardError && <div className="redeem-error" role="alert">{rewardError}</div>}
        {rewards.length ? <div className="redeem-reward-list">{rewards.map((reward) => {
          const canEquip = equippableRewardTypes.has(reward.type)
          return <article className={`redeem-reward-item ${reward.equipped ? 'equipped' : ''}`} key={reward.id} style={reward.equipped && ['profile_color', 'color'].includes(reward.type) ? { '--item-accent': reward.value } : undefined}>
            <span className="redeem-reward-mark"><Icon name={reward.type === 'premium' ? 'crown' : 'spark'} /></span>
            <div><strong>{reward.name}</strong><small>{new Date(reward.createdAt * 1000).toLocaleDateString('de-DE')}{reward.equipped ? ' · Ausgerüstet' : ''}</small></div>
            {canEquip && <button className="admin-secondary-button" type="button" disabled={Boolean(equipping)} onClick={() => void equipReward(reward)}>{equipping === reward.id ? '…' : reward.equipped ? 'Ablegen' : 'Anlegen'}</button>}
          </article>
        })}</div> : <div className="redeem-empty"><Icon name="spark" /><p>Hier erscheinen deine eingelösten Belohnungen.</p></div>}
      </section>
    </div>

    <section className="redeem-announcements panel">
      <div className="panel-heading"><div><div className="section-kicker">NEUIGKEITEN</div><h2>Code-Ankündigungen</h2></div><span className="count-pill">{announcements.length}</span></div>
      {announcements.length ? <div className="redeem-announcement-list">{announcements.map((item) => <article key={item.id}><span className="redeem-announcement-icon"><Icon name="spark" /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at * 1000).toLocaleDateString('de-DE')}</small></div></article>)}</div> : <p className="redeem-muted">{loadingPage ? 'Ankündigungen werden geladen …' : 'Aktuell gibt es keine Code-Ankündigungen.'}</p>}
    </section>

    <section className="redeem-catalog panel">
      <div className="panel-heading"><div><div className="section-kicker">ÖFFENTLICHE CODES</div><h2>Verfügbare Codes</h2></div><span className="count-pill">{codes.length}</span></div>
      {loadingPage && <p className="redeem-muted">Codes werden geladen …</p>}
      {!loadingPage && codes.length === 0 && <p className="redeem-muted">Es sind derzeit keine öffentlichen Codes vorhanden.</p>}
      {codes.length > 0 && <div className="redeem-code-grid">{codes.map((item) => <article className="redeem-code-item" key={item.id}>
        <div className="redeem-code-heading"><div><strong>{item.name}</strong><code>{item.code}</code></div><span className={`redeem-code-status ${item.status}`}>{statusLabel(item.status)}</span></div>
        <div className="redeem-code-reward">{rewardTitle(item)}</div>
        {item.description && <p>{item.description}</p>}
        <div className="redeem-code-footer"><small>{item.expiresAt ? `Ablauf: ${new Date(item.expiresAt * 1000).toLocaleDateString('de-DE')}` : 'Kein Ablaufdatum'}{item.status === 'active' ? ` · ${item.remaining} verfügbar` : ''}</small>{item.status === 'active' && <button type="button" onClick={() => setCode(item.code)}>Code verwenden</button>}</div>
      </article>)}</div>}
    </section>
  </div>
}
