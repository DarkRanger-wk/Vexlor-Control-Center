import type { ReactElement } from 'react'

interface AdminPageProps {
  notifyError: (message: string) => void
  notifyInfo: (message: string) => void
}

declare function AdminPage(props: AdminPageProps): ReactElement
export default AdminPage
