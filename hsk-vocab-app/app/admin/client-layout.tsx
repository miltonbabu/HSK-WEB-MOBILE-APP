'use client'

import AdminLayout from '@/views/admin/AdminLayout'

export default function AdminClientLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}