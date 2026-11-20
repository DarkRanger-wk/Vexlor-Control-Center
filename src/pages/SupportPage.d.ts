import type { ReactElement } from 'react'

interface SupportPageProps {
  username: string
  notifyInfo: (message: string) => void
}

declare function SupportPage(props: SupportPageProps): ReactElement
export default SupportPage
