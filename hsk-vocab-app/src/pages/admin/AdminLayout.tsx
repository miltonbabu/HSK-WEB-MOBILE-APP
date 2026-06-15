import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAdminStore } from '@/stores'
import { adminService } from '@/services/admin.service'
import { LayoutDashboard, Users, LogOut, Shield, BookOpen, Settings, Mail } from 'lucide-react'

const sidebarItems = [
  { path: '/admin', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { path: '/admin/vocabulary', label: 'Vocabulary', Icon: BookOpen },
  { path: '/admin/users', label: 'Users', Icon: Users },
  { path: '/admin/messages', label: 'Messages', Icon: Mail },
  { path: '/admin/settings', label: 'Settings', Icon: Settings },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { admin, checkAuth, logout } = useAdminStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (admin === null) {
      adminService.checkAuth().then((result) => {
        if (!result) navigate('/admin/login', { replace: true })
      })
    }
  }, [admin, navigate])

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-900 flex">
      <aside className="hidden md:flex flex-col w-56 bg-white dark:bg-ink-800 border-r border-ink-100 dark:border-ink-700 flex-shrink-0">
        <Link to="/admin" className="flex items-center gap-2.5 px-5 py-4 border-b border-ink-100 dark:border-ink-700">
          <Shield className="w-5 h-5 text-ink-700 dark:text-ink-300" />
          <span className="font-bold text-ink-900 dark:text-white tracking-tight text-sm">Admin Panel</span>
        </Link>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5">
          {sidebarItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white'
                    : 'text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-700/50'
                }`}
              >
                <item.Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-ink-100 dark:border-ink-700">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-ink-900 dark:bg-ink-600 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200 truncate">
              {admin?.username || 'Admin'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-ink-700 dark:text-ink-300" />
            <span className="font-bold text-ink-900 dark:text-white text-sm">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            {sidebarItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white'
                      : 'text-ink-500 dark:text-ink-400'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}