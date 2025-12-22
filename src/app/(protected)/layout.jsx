import AuthGuard from '@/contexts/AuthGuard'

export default function ProtectedLayout({ children }) {
  return (
    <AuthGuard>
      {children}
    </AuthGuard>
  )
}