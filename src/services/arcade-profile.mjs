export const ARCADE_GAMES = ['space-shooter', 'runner', 'clicker', 'puzzle']

export const ARCADE_ACHIEVEMENTS = [
  { id: 'first-flight', title: 'Erster Start', description: 'Starte deine erste Runde.', icon: 'launch' },
  { id: 'score-500', title: 'Anfänger', description: 'Erreiche 500 Punkte in einer Runde.', icon: 'target' },
  { id: 'score-2000', title: 'Fortgeschritten', description: 'Erreiche 2.000 Punkte in einer Runde.', icon: 'bolt' },
  { id: 'score-5000', title: 'Profi', description: 'Erreiche 5.000 Punkte in einer Runde.', icon: 'crown' },
  { id: 'play-60', title: 'Arcade-Fan', description: 'Spiele insgesamt 60 Minuten.', icon: 'clock' },
]

const achievementIds = new Set(ARCADE_ACHIEVEMENTS.map((achievement) => achievement.id))
const storageKey = 'vcc.arcade.profile.v1'

export function createArcadeProfile() {
  return {
    highScore: 0,
    lastScore: null,
    roundsPlayed: 0,
    totalPlayTimeSeconds: 0,
    achievements: [],
    recentGames: [],
    soundVolume: 0.35,
  }
}

function isCounter(value) {
  return Number.isSafeInteger(value) && value >= 0
}

export function validateArcadeProfile(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Das Arcade-Profil hat ein ungültiges Format.')
  }
  const profile = value
  if (!isCounter(profile.highScore)
    || (profile.lastScore !== null && !isCounter(profile.lastScore))
    || !isCounter(profile.roundsPlayed)
    || !isCounter(profile.totalPlayTimeSeconds)
    || !Array.isArray(profile.achievements)
    || !Array.isArray(profile.recentGames)
    || typeof profile.soundVolume !== 'number'
    || !Number.isFinite(profile.soundVolume)
    || profile.soundVolume < 0
    || profile.soundVolume > 1) {
    throw new Error('Das Arcade-Profil enthält ungültige Werte.')
  }
  if (profile.achievements.some((id) => typeof id !== 'string' || !achievementIds.has(id))) {
    throw new Error('Das Arcade-Profil enthält einen unbekannten Erfolg.')
  }
  if (profile.recentGames.some((id) => typeof id !== 'string' || !ARCADE_GAMES.includes(id))) {
    throw new Error('Das Arcade-Profil enthält ein unbekanntes Spiel.')
  }
  return {
    highScore: profile.highScore,
    lastScore: profile.lastScore,
    roundsPlayed: profile.roundsPlayed,
    totalPlayTimeSeconds: profile.totalPlayTimeSeconds,
    achievements: [...new Set(profile.achievements)],
    recentGames: [...new Set(profile.recentGames)].slice(0, 8),
    soundVolume: profile.soundVolume,
  }
}

export function applyArcadeAchievements(profile) {
  const unlocked = new Set(profile.achievements)
  if (profile.roundsPlayed > 0) unlocked.add('first-flight')
  if (profile.highScore >= 500) unlocked.add('score-500')
  if (profile.highScore >= 2000) unlocked.add('score-2000')
  if (profile.highScore >= 5000) unlocked.add('score-5000')
  if (profile.totalPlayTimeSeconds >= 3600) unlocked.add('play-60')
  return { ...profile, achievements: [...unlocked] }
}

export function beginArcadeRound(profile) {
  const recentGames = ['space-shooter', ...profile.recentGames.filter((id) => id !== 'space-shooter')].slice(0, 8)
  return applyArcadeAchievements({ ...profile, roundsPlayed: profile.roundsPlayed + 1, recentGames })
}

export function addArcadePlayTime(profile, seconds) {
  if (!isCounter(seconds)) throw new Error('Die Arcade-Spielzeit muss eine positive ganze Zahl sein.')
  return applyArcadeAchievements({ ...profile, totalPlayTimeSeconds: profile.totalPlayTimeSeconds + seconds })
}

export function completeArcadeRound(profile, score, unsavedSeconds = 0) {
  if (!isCounter(score) || !isCounter(unsavedSeconds)) {
    throw new Error('Punktzahl und Spielzeit müssen positive ganze Zahlen sein.')
  }
  return applyArcadeAchievements({
    ...profile,
    highScore: Math.max(profile.highScore, score),
    lastScore: score,
    totalPlayTimeSeconds: profile.totalPlayTimeSeconds + unsavedSeconds,
  })
}

export function loadArcadeProfile(storage = window.localStorage) {
  let serialized
  try {
    serialized = storage.getItem(storageKey)
  } catch (error) {
    throw new Error('Das lokale Arcade-Profil konnte nicht gelesen werden.', { cause: error })
  }
  if (serialized === null) return createArcadeProfile()

  let parsed
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    throw new Error('Das lokale Arcade-Profil ist beschädigt und konnte nicht gelesen werden.', { cause: error })
  }
  return validateArcadeProfile(parsed)
}

export function saveArcadeProfile(profile, storage = window.localStorage) {
  const validated = validateArcadeProfile(profile)
  try {
    storage.setItem(storageKey, JSON.stringify(validated))
  } catch (error) {
    throw new Error('Das lokale Arcade-Profil konnte nicht gespeichert werden.', { cause: error })
  }
  return validated
}
