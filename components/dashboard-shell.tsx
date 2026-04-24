'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronDown, LayoutDashboard, UserRound, BarChart3, Settings, Search, Users, Camera, Layers, Activity } from 'lucide-react'

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
  { href: '/tech-stack', label: 'Tech Stack', icon: Layers },
  { href: '/camera-check', label: 'Camera Check', icon: Camera },
  { href: '/system-status', label: 'System Status', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
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
            <div className="flex size-10 items-center justify-center rounded-full bg-white/15 text-lg font-semibold text-white">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-none">Attendance Tracking System</p>
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
                  <div className="flex size-10 items-center justify-center rounded-full bg-[#2b5c9e] text-white shadow-sm">
                    <Users className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold text-foreground">{title}</p>
                    {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
                  </div>
                </div>
              </div>

              <div className="ml-auto hidden max-w-md flex-1 items-center gap-3 lg:flex">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-11 rounded-full border-border/70 bg-white/75 pl-10 shadow-sm" placeholder="Search students, attendance, reports..." />
                </div>
                <Button variant="outline" className="h-11 rounded-full border-border/70 bg-white/75 px-4 shadow-sm">
                  <Bell className="size-4" />
                  <span className="sr-only">Notifications</span>
                </Button>
                <div className="flex items-center gap-3 rounded-full border border-border/70 bg-white/75 px-3 py-2 shadow-sm">
                  <Avatar className="size-9">
                    <AvatarImage src={profile.imageUrl} alt="Profile" />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-foreground">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">{profile.subTitle}</p>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
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