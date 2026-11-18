import type { ReactElement } from 'react'

interface ArcadePageProps {
  gameSoundEnabled?: boolean
  gameSoundVolume?: number
}

declare function ArcadePage(props?: ArcadePageProps): ReactElement

export default ArcadePage
