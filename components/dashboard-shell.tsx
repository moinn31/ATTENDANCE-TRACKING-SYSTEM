'use client'

import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, ChevronDown, LayoutDashboard, UserRound, BarChart3, Settings,
  Search, Users, Activity, LogOut, User, X
} from 'lucide-react'
import { Logo } from '@/components/logo'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NavigationItem {
  href: string
  label: string
  icon: any
  disabled?: boolean
}

const navigationItems: NavigationItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/scanner', label: 'Attendance', icon: UserRound },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/analytics', label: 'Reports', icon: BarChart3 },
  { href: '/system-status', label: 'System Status', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
]

// Searchable items for the global search
const searchableItems = [
  { label: 'Dashboard', href: '/', keywords: ['home', 'overview', 'main'] },
  { label: 'Scan Attendance', href: '/scanner', keywords: ['scan', 'camera', 'face', 'recognition', 'mark', 'present'] },
  { label: 'Students', href: '/students', keywords: ['student', 'roster', 'enroll', 'add', 'manage', 'face data'] },
  { label: 'Reports & Analytics', href: '/analytics', keywords: ['report', 'analytics', 'chart', 'graph', 'export', 'download', 'excel'] },
  { label: 'System Status', href: '/system-status', keywords: ['status', 'health', 'database', 'hdfs', 'service'] },
  { label: 'Settings', href: '/settings', keywords: ['settings', 'config', 'preferences', 'theme'] },
]

type DashboardShellProps = {
  title: string
  subtitle?: string
  children: ReactNode
  headerActions?: React.ReactNode
}

export function DashboardShell({ title, subtitle, children, headerActions }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const profile = {
    name: 'Admin',
    subTitle: 'Faculty',
    imageUrl: 'https://i.pravatar.cc/100?img=12',
  }

  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return searchableItems.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.keywords.some(k => k.includes(q))
    )
  }, [searchQuery])

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut: Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        const input = searchRef.current?.querySelector('input')
        input?.focus()
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // --- Notification State ---
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'System started successfully', time: 'Just now', read: false, type: 'success' as const },
    { id: 2, text: 'Hadoop HDFS connected', time: '2 min ago', read: false, type: 'info' as const },
    { id: 3, text: 'AI Service is online', time: '5 min ago', read: true, type: 'success' as const },
  ])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // Close notification on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Profile Dropdown State ---
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem('token')
    router.replace('/auth/login')
  }, [router])

  // Close profile on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const avatarFallback = useMemo(() => {
    const trimmed = profile.name.trim()
    if (!trimmed) {
      return 'AD'
    }

    const parts = trimmed.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }

    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase() || 'AD'
  }, [profile.name])

  useEffect(() => {
    const token = window.localStorage.getItem('token')
    if (!token) {
      window.localStorage.removeItem('token') // Ensure it's totally gone
      router.replace('/auth/login')
    }
  }, [router])

  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        collapsible="icon"
        className="border-r border-white/10"
        style={{
          ['--sidebar' as string]: '#2b5c9e',
          ['--sidebar-foreground' as string]: '#ffffff',
          ['--sidebar-primary' as string]: '#ffffff',
          ['--sidebar-primary-foreground' as string]: '#2b5c9e',
          ['--sidebar-accent' as string]: 'rgba(255,255,255,0.12)',
          ['--sidebar-accent-foreground' as string]: '#ffffff',
          ['--sidebar-border' as string]: 'rgba(255,255,255,0.16)',
          ['--sidebar-ring' as string]: 'rgba(255,255,255,0.35)',
        }}
      >
        <SidebarHeader className="px-4 pt-5">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
            <Logo className="size-10 flex-shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-none">Smart Attendance System</p>
              <p className="mt-1 text-xs text-white/70">Faculty dashboard</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 pb-3">
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/65">Overview</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => {
                  const active = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild={!item.disabled}
                        isActive={active}
                        className={cn(
                          'rounded-xl text-sm text-white/85 transition-colors hover:bg-white/12 hover:text-white',
                          active && 'bg-white text-[#2b5c9e] hover:bg-white hover:text-[#2b5c9e]',
                          item.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-white/70',
                        )}
                      >
                        {item.disabled ? (
                          <span className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </span>
                        ) : (
                          <Link href={item.href} className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-4 pb-5">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs font-medium text-white/70">Current session</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">Teacher account</p>
                <p className="truncate text-xs text-white/70">Face recognition enabled</p>
              </div>
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/15">Online</Badge>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <div className="min-h-svh">
          <header className="sticky top-0 z-20 border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0.7))] backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(12,18,35,0.88),rgba(12,18,35,0.7))]">
            <div className="flex items-center gap-3 px-4 py-3 md:px-6">
              <SidebarTrigger className="rounded-xl border border-border/70 bg-card/80 text-foreground shadow-sm md:hidden" />
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden items-center gap-2 md:flex">
                  <Logo className="size-10 flex-shrink-0 shadow-none border-none bg-transparent" />
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold text-foreground">{title}</p>
                    {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
                  </div>
                </div>
              </div>

              <div className="ml-auto hidden max-w-md flex-1 items-center gap-3 lg:flex">

                {/* ===== SEARCH ===== */}
                <div className="relative flex-1" ref={searchRef}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 rounded-full border-border/70 bg-white/75 pl-10 pr-16 shadow-sm"
                    placeholder="Search students, attendance, reports..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                    onFocus={() => setSearchOpen(true)}
                  />
                  <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                    Ctrl+K
                  </kbd>

                  {/* Search Results Dropdown */}
                  {searchOpen && searchQuery.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {searchResults.length > 0 ? (
                        <div className="py-2">
                          <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Navigate to</p>
                          {searchResults.map((item) => (
                            <button
                              key={item.href}
                              onClick={() => {
                                router.push(item.href)
                                setSearchQuery('')
                                setSearchOpen(false)
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Search className="size-4 text-slate-400" />
                              <span className="font-medium">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm text-slate-500">No results for &quot;{searchQuery}&quot;</p>
                          <p className="mt-1 text-xs text-slate-400">Try searching for pages like &quot;students&quot; or &quot;reports&quot;</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ===== NOTIFICATIONS ===== */}
                <div className="relative" ref={notifRef}>
                  <Button
                    variant="outline"
                    className="relative h-11 rounded-full border-border/70 bg-white/75 px-4 shadow-sm"
                    onClick={() => setNotifOpen(!notifOpen)}
                  >
                    <Bell className="size-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                        {unreadCount}
                      </span>
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>

                  {/* Notification Dropdown */}
                  {notifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={cn(
                                'flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors',
                                !notif.read && 'bg-blue-50/50'
                              )}
                            >
                              <div className={cn(
                                'mt-0.5 size-2 flex-shrink-0 rounded-full',
                                notif.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700">{notif.text}</p>
                                <p className="mt-0.5 text-xs text-slate-400">{notif.time}</p>
                              </div>
                              <button
                                onClick={() => dismissNotification(notif.id)}
                                className="flex-shrink-0 rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center">
                            <Bell className="mx-auto size-8 text-slate-200" />
                            <p className="mt-2 text-sm text-slate-400">All caught up!</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ===== PROFILE DROPDOWN ===== */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-3 rounded-full border border-border/70 bg-white/75 px-3 py-2 shadow-sm transition-all hover:shadow-md hover:bg-white"
                  >
                    <Avatar className="size-9">
                      <AvatarImage src={profile.imageUrl} alt="Profile" />
                      <AvatarFallback>{avatarFallback}</AvatarFallback>
                    </Avatar>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-foreground">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">{profile.subTitle}</p>
                    </div>
                    <ChevronDown className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200",
                      profileOpen && "rotate-180"
                    )} />
                  </button>

                  {/* Profile Dropdown Menu */}
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">{profile.name}</p>
                        <p className="text-xs text-slate-400">{profile.subTitle} Account</p>
                      </div>
                      <div className="py-1.5">
                        <button
                          onClick={() => { router.push('/settings'); setProfileOpen(false) }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <User className="size-4 text-slate-400" />
                          <span>Profile Settings</span>
                        </button>
                        <button
                          onClick={() => { router.push('/system-status'); setProfileOpen(false) }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Activity className="size-4 text-slate-400" />
                          <span>System Status</span>
                        </button>
                      </div>
                      <div className="border-t border-slate-100 py-1.5">
                        <button
                          onClick={() => { handleLogout(); setProfileOpen(false) }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                        >
                          <LogOut className="size-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {headerActions && <div className="ml-auto flex items-center gap-2 lg:hidden">{headerActions}</div>}
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}