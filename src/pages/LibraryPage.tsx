import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import type { GameEntry } from '../types/app'

interface LibraryPageProps {
  notifyError: (message: string) => void
}

interface GameDraft {
  id: string
  name: string
  description: string
  category: string
  executablePath: string
  coverData: string | null
  favorite: boolean
  lastLaunchedAt: string | null
}

const blankDraft = (): GameDraft => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  category: 'Sonstiges',
  executablePath: '',
  coverData: null,
  favorite: false,
  lastLaunchedAt: null,
})

export function LibraryPage({ notifyError }: LibraryPageProps) {
  const [games, setGames] = useState<GameEntry[]>([])
  const [draft, setDraft] = useState<GameDraft | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Alle')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadGames = async () => {
    try {
      setGames(await window.vcc.listGames())
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Spiele konnten nicht geladen werden.')
    }
  }

  useEffect(() => {
    void loadGames()
  }, [])

  const categories = useMemo(() => ['Alle', ...new Set(games.map((game) => game.category))], [games])
  const filteredGames = games.filter((game) =>
    (!favoritesOnly || game.favorite)
    && (category === 'Alle' || game.category === category)
    && `${game.name} ${game.description} ${game.category}`.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')),
  )

  const chooseExecutable = async () => {
    try {
      const path = await window.vcc.chooseExecutable()
      if (path) setDraft((current) => current && ({ ...current, executablePath: path, name: current.name || path.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || '' }))
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Dateiauswahl fehlgeschlagen.')
    }
  }

  const chooseCover = async () => {
    try {
      const coverData = await window.vcc.chooseCover()
      if (coverData) setDraft((current) => current && ({ ...current, coverData }))
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Cover konnte nicht geladen werden.')
    }
  }

  const saveDraft = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    setBusy(true)
    try {
      setGames(await window.vcc.saveGame(draft))
      setDraft(null)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Spiel konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const updateGame = async (game: GameEntry, patch: Partial<GameEntry>) => {
    try {
      setGames(await window.vcc.saveGame({ ...game, ...patch }))
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Spiel konnte nicht aktualisiert werden.')
    }
  }

  const launchGame = async (game: GameEntry) => {
    try {
      await window.vcc.launchGame(game.id)
      await loadGames()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Spiel konnte nicht gestartet werden.')
    }
  }

  const removeGame = async (game: GameEntry) => {
    if (!window.confirm(`„${game.name}“ aus der Bibliothek entfernen? Die Spieldateien bleiben unverändert.`)) return
    try {
      setGames(await window.vcc.removeGame(game.id))
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Spiel konnte nicht entfernt werden.')
    }
  }

  return (
    <>
      <PageIntro eyebrow="DEINE SAMMLUNG" title="Spielebibliothek" description={`${games.length} lokal gespeicherte ${games.length === 1 ? 'Spieleintrag' : 'Spieleinträge'} · Deine Dateien bleiben unverändert.`} action={<button className="primary-button" onClick={() => setDraft(blankDraft())}><span>+</span> Spiel hinzufügen</button>} />
      <section className="library-toolbar panel">
        <label className="search-field"><span>⌕</span><input aria-label="Spiele suchen" placeholder="Spiele durchsuchen …" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>SUCHEN</kbd></label>
        <select aria-label="Kategorie filtern" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select>
        <button className={`filter-button${favoritesOnly ? ' selected' : ''}`} onClick={() => setFavoritesOnly((value) => !value)}><span>★</span> Favoriten</button>
      </section>

      {filteredGames.length > 0 ? <section className="game-grid">{filteredGames.map((game) => <article className="game-card panel" key={game.id}>
        <div className="game-cover">{game.coverData ? <img src={game.coverData} alt={`Cover: ${game.name}`} /> : <div className="game-cover-fallback"><Icon name="library" /><span>VEXLOR</span></div>}<button className={`favorite-button${game.favorite ? ' active' : ''}`} aria-label={game.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'} onClick={() => void updateGame(game, { favorite: !game.favorite })}>★</button><span className="game-category">{game.category}</span></div>
        <div className="game-card-body"><h2 title={game.name}>{game.name}</h2><p>{game.description || 'Keine Beschreibung hinzugefügt.'}</p><div className="game-path" title={game.executablePath}><span>EXE</span>{game.executablePath}</div>
          <div className="game-card-actions"><button className="primary-button launch-button" onClick={() => void launchGame(game)}><span>▶</span> Starten</button><button className="subtle-button" onClick={() => setDraft({ ...game })} aria-label={`${game.name} bearbeiten`}>Bearbeiten</button><button className="danger-icon-button" onClick={() => void removeGame(game)} aria-label={`${game.name} entfernen`}>×</button></div>
          {game.lastLaunchedAt && <div className="last-played">Zuletzt gestartet · {new Date(game.lastLaunchedAt).toLocaleString('de-DE')}</div>}
        </div>
      </article>)}</section> : <section className="empty-state panel"><div className="empty-art"><span className="empty-art-ring" /><Icon name="library" /><span className="empty-art-plus">+</span></div><h2>{games.length === 0 ? 'Hier beginnt deine Sammlung.' : 'Keine passenden Spiele gefunden.'}</h2><p>{games.length === 0 ? 'Füge ein Spiel über seine ausführbare .exe-Datei hinzu. VCC verschiebt oder verändert keine Spieldateien.' : 'Passe Suche oder Filter an, um deine Spiele zu finden.'}</p>{games.length === 0 && <button className="primary-button" onClick={() => setDraft(blankDraft())}>Erstes Spiel hinzufügen</button>}</section>}

      {draft && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDraft(null) }}><form className="game-modal panel" onSubmit={(event) => void saveDraft(event)}><div className="modal-heading"><div><div className="section-kicker">LOKALE SPIELEDATEN</div><h2>{games.some((game) => game.id === draft.id) ? 'Spiel bearbeiten' : 'Spiel hinzufügen'}</h2></div><button type="button" className="close-button" onClick={() => setDraft(null)} aria-label="Schließen">×</button></div>
        <label className="form-label">Name<input required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Lieblingsspiel" /></label>
        <label className="form-label">Beschreibung<textarea maxLength={500} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Kurze Notiz (optional)" /></label>
        <div className="form-two-columns"><label className="form-label">Kategorie<input required list="game-categories" maxLength={40} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /><datalist id="game-categories"><option value="Action" /><option value="Adventure" /><option value="RPG" /><option value="Simulation" /><option value="Strategie" /><option value="Sonstiges" /></datalist></label><div className="form-label">Cover<button type="button" className="file-button" onClick={() => void chooseCover()}>{draft.coverData ? 'Cover ausgewählt' : 'Bild auswählen'}</button></div></div>
        <div className="form-label">Ausführbare Datei (.exe)<div className="file-input-row"><input required value={draft.executablePath} onChange={(event) => setDraft({ ...draft, executablePath: event.target.value })} placeholder="Dateipfad auswählen …" /><button type="button" className="subtle-button" onClick={() => void chooseExecutable()}>Durchsuchen</button></div></div>
        <label className="switch-row"><span><strong>Favorit</strong><small>Dieses Spiel im Favoritenfilter anzeigen.</small></span><input type="checkbox" checked={draft.favorite} onChange={(event) => setDraft({ ...draft, favorite: event.target.checked })} /></label>
        <div className="modal-actions"><button type="button" className="subtle-button" onClick={() => setDraft(null)}>Abbrechen</button><button className="primary-button" disabled={busy}>{busy ? 'Speichert …' : 'Lokal speichern'}</button></div>
      </form></div>}
    </>
  )
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <section className="page-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</div><h1>{title}</h1><p className="welcome-subtitle">{description}</p></div>{action}</section>
}
