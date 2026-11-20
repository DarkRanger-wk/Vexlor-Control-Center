import type { ReactElement } from 'react'

interface AdminTicketMailboxProps {
  notifyInfo: (message: string) => void
}

declare function AdminTicketMailbox(props: AdminTicketMailboxProps): ReactElement
export default AdminTicketMailbox
