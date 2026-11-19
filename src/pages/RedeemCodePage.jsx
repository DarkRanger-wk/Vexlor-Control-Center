import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import '../styles/redeem.css'

export default function RedeemCodePage() {
  const [code, setCode] = useState('')
  const [history, setHistory] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vcc-code-redemptions') ?? '[]')
      if (Array.isArray(saved)) setHistory(saved.slice(0, 20))
    } catch {
      setHistory([])
    }
  }, [])

  const redeem = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      let installId = localStorage.getItem('vcc-install-id')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(installId ?? '')) {
        installId = crypto.randomUUID()
        localStorage.setItem('vcc-install-id', installId)
      }
      const response = await fetch('https://infos-vcc.pages.dev/api/codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), installId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Code konnte nicht eingelöst werden.')
      const entry = { code: code.trim(), reward: body.reward, redeemedAt: new Date().toISOString() }
      const next = [entry, ...history].slice(0, 20)
      setHistory(next)
      localStorage.setItem('vcc-code-redemptions', JSON.stringify(next))
      setMessage(`Code erfolgreich eingelöst. Belohnung: ${body.reward.type}${body.reward.value ? ` – ${body.reward.value}` : ''}`)
      setCode('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code konnte nicht eingelöst werden.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="redeem-page">
    <header className="redeem-header"><div><div className="eyebrow"><span className="eyebrow-line" /> VEXLOR BELOHNUNGEN</div><h1>Code <span>einlösen</span></h1><p>Einlösungen werden serverseitig geprüft und durch das festgelegte Gesamteinlösungslimit begrenzt.</p></div></header>
    <div className="redeem-layout">
      <form className="redeem-card panel" onSubmit={redeem}>
        <div className="redeem-icon"><Icon name="spark" /></div>
        <label htmlFor="redeem-code">Einlösecode</label>
        <input id="redeem-code" value={code} maxLength={128} placeholder="VEXLOR-XXXX-XXXX" onChange={(event) => setCode(event.target.value)} disabled={loading} />
        {message && <div className="redeem-message" role="status">{message}</div>}
        {error && <div className="redeem-error" role="alert">{error}</div>}
        <button className="primary-button" type="submit" disabled={loading || code.trim().length < 4}>{loading ? 'Wird geprüft …' : 'Code einlösen'}</button>
      </form>
      <section className="redeem-history panel"><div className="panel-heading"><div><div className="section-kicker">DEIN VERLAUF</div><h2>Letzte Einlösungen</h2></div><span className="count-pill">{history.length}</span></div>{history.length ? <div className="redeem-history-list">{history.map((entry, index) => <div key={`${entry.redeemedAt}-${index}`}><span><Icon name="spark" /></span><div><strong>{entry.reward.type}{entry.reward.value ? ` – ${entry.reward.value}` : ''}</strong><small>{new Date(entry.redeemedAt).toLocaleString('de-DE')}</small></div></div>)}</div> : <div className="redeem-empty"><Icon name="screenshot" /><p>Du hast noch keine Codes eingelöst.</p></div>}</section>
    </div>
  </div>
}
