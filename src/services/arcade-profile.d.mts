import type { ArcadeGameId, ArcadeProfile } from '../types/app'

export const ARCADE_GAMES: ArcadeGameId[]
export function createArcadeProfile(): ArcadeProfile
export function validateArcadeProfile(value: unknown): ArcadeProfile
