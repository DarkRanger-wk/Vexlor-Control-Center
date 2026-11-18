import type { ReactElement } from 'react'
import type { AppSettings } from '../types/app'

interface CustomizationPageProps {
  settings: AppSettings
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>
  notifyError: (message: string) => void
  notifyInfo: (message: string) => void
}

declare function CustomizationPage(props: CustomizationPageProps): ReactElement

export default CustomizationPage
