'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isMissingSessionError } from '@/lib/supabase/auth-errors'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DashboardShell } from '@/components/dashboard-shell'
import { BarChart3, CalendarDays, Clock3, Clock10, GraduationCap, LogOut, Users, Database, Brain, Cloud } from 'lucide-react'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        
        if (error && !isMissingSessionError(error.message)) {
          console.error('Auth error:', error.message)
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          router.replace('/auth/login')
          return
        }

        setUser(user)
        setLoading(false)

        if (!user) {
          router.replace('/auth/login')
        }
      } catch (error) {
        console.error('Failed to get user:', error)
        await supabase.auth.signOut()
        setUser(null)
        setLoading(false)
        router.replace('/auth/login')
      }
    }

    void getUser()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardShell title="Dashboard" subtitle="Attendance overview and daily operations">
      <main className="space-y-5">
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="glass-card border-blue-200/70 p-5 xl:col-span-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Present Today</p>
                <p className="mt-2 text-4xl font-semibold text-slate-800">56</p>
              </div>
              <div className="rounded-2xl bg-red-100 p-3 text-red-500">
                <Users className="size-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-red-500">
              <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold">3 Absent</span>
            </div>
            <div className="mt-4 h-3 rounded-full bg-red-100">
              <div className="h-3 w-[82%] rounded-full bg-red-400" />
            </div>
          </div>

          <div className="glass-card border-blue-200/70 p-5 xl:col-span-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">On Time</p>
                <p className="mt-2 text-4xl font-semibold text-slate-800">84%</p>
              </div>
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-500">
                <Clock3 className="size-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
              <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold">12 Late</span>
            </div>
            <div className="mt-4 h-3 rounded-full bg-slate-100">
              <div className="h-3 w-[68%] rounded-full bg-amber-400" />
            </div>
          </div>

          <div className="glass-card border-blue-200/70 p-5 xl:col-span-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Check-Ins</p>
                <p className="mt-2 text-4xl font-semibold text-slate-800">124</p>
              </div>
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-600">
                <CalendarDays className="size-5" />
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Avg.</span> 9:12 AM
            </div>
          </div>

          <div className="glass-card border-blue-200/70 p-5 xl:col-span-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Time Worked</p>
                <p className="mt-2 text-4xl font-semibold text-slate-800">7h45m</p>
              </div>
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
                <Clock10 className="size-5" />
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Avg.</span> 7h 20m
            </div>
          </div>

          <div className="glass-card flex items-center justify-center overflow-hidden border-blue-200/70 p-5 xl:col-span-1">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 via-white to-blue-50 p-4">
              <div className="relative h-36 w-36 rounded-full bg-[conic-gradient(#5bb85d_0_30%,#f4a34f_30%_55%,#4f83cc_55%_80%,#e5e7eb_80%_100%)] shadow-lg">
                <div className="absolute inset-10 rounded-full bg-white shadow-inner" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700"><Database className="size-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-800">BDA</p>
                <p className="text-xs text-slate-500">Data analysis and reporting</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">Use analytics dashboards, trends, and exports to understand attendance patterns at class, subject, and student level.</p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Brain className="size-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-800">AI</p>
                <p className="text-xs text-slate-500">Face recognition and detection</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">Capture face descriptors, improve enrollment, and support intelligent attendance matching with confidence scoring.</p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Cloud className="size-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Cloud Computing</p>
                <p className="text-xs text-slate-500">Supabase, serverless APIs, deployment ready</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">Authentication, APIs, and storage already fit a cloud-first workflow for classroom or institution use.</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Attendance Overview</h2>
              <Badge variant="outline" className="rounded-full border-blue-200 bg-white/80 text-slate-700">
                This Month
              </Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <div className="flex h-64 items-end gap-2">
                {[
                  34, 37, 27, 25, 31, 46, 32, 49, 41, 53, 44, 40, 36, 47, 43, 54, 47, 46, 41, 52, 49, 58, 45, 46, 52, 43, 57, 51, 61, 48,
                ].map((value, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full items-end gap-1">
                      <div className="h-1/2 flex-1 rounded-t-md bg-sky-200" style={{ height: `${Math.max(value - 10, 10)}%` }} />
                      <div className="h-1/2 flex-1 rounded-t-md bg-amber-300" style={{ height: `${Math.max(value - 20, 8)}%` }} />
                      <div className="h-1/2 flex-1 rounded-t-md bg-green-500" style={{ height: `${Math.max(value, 12)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{index + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-green-500" />Present</span>
                <span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-amber-400" />Late</span>
                <span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-sky-400" />Absent</span>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass-card p-5">
              <h2 className="text-lg font-semibold text-slate-800">Team Status</h2>
              <div className="mt-4 grid grid-cols-4 gap-3 text-center">
                {[
                  { label: 'On Time', value: 45, color: 'bg-green-500', text: 'text-green-600' },
                  { label: 'Late', value: 8, color: 'bg-amber-400', text: 'text-amber-600' },
                  { label: 'Absent', value: 3, color: 'bg-red-500', text: 'text-red-600' },
                  { label: 'Working Remote', value: 5, color: 'bg-blue-500', text: 'text-blue-600' },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white ${item.color}`}>
                      {item.value}
                    </div>
                    <p className={`text-xs font-semibold ${item.text}`}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="text-lg font-semibold text-slate-800">Today&apos;s Absentees</h2>
              <div className="mt-4 space-y-3">
                {[
                  { name: 'Lisa Brown', reason: 'Sick Leave', img: 'LB' },
                  { name: 'Michael Carter', reason: 'Personal Leave', img: 'MC' },
                  { name: 'Emma Wilson', reason: 'No Call / No Show', img: 'EW' },
                ].map((person) => (
                  <div key={person.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                        {person.img}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{person.name}</p>
                        <p className="text-xs text-slate-500">Student</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{person.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="glass-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Recent Check-Ins</h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Check-In</th>
                    <th className="px-4 py-3 font-medium">Check-Out</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'David Smith', in: '08:45 AM', out: '05:30 PM', status: 'On Time', tone: 'bg-green-500' },
                    { name: 'Sarah Lee', in: '09:20 AM', out: '06:10 PM', status: 'Late', tone: 'bg-amber-500' },
                    { name: 'Mark Johnson', in: 'Remote', out: '-', status: 'Working Remote', tone: 'bg-blue-500' },
                  ].map((row) => (
                    <tr key={row.name} className="border-b border-slate-200 last:border-0">
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.in}</td>
                      <td className="px-4 py-3 text-slate-600">{row.out}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white ${row.tone}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass-card p-5">
              <h2 className="text-lg font-semibold text-slate-800">Upcoming Holidays</h2>
              <div className="mt-4 space-y-3">
                {[
                  { date: 'May 30', title: 'Memorial Day' },
                  { date: 'Jun 15', title: 'Company Outing' },
                  { date: 'Jul 04', title: 'Independence Day' },
                ].map((item) => (
                  <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <BarChart3 className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.date}</p>
                      <p className="text-xs text-slate-500">{item.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="text-lg font-semibold text-slate-800">Quick Actions</h2>
              <div className="mt-4 grid gap-3">
                <Button asChild className="justify-start rounded-2xl bg-[#2b5c9e] px-4 py-6 text-left shadow-sm hover:bg-[#254f87]">
                  <a href="/scanner" className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-white/15">
                      <GraduationCap className="size-5" />
                    </div>
                    <span>Open Attendance Scanner</span>
                  </a>
                </Button>
                <Button asChild variant="outline" className="justify-start rounded-2xl border-slate-200 bg-white/80 px-4 py-6 text-left">
                  <a href="/students" className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                      <Users className="size-5" />
                    </div>
                    <span>Manage Students</span>
                  </a>
                </Button>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Session</h2>
                <Button onClick={handleLogout} variant="ghost" className="rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  <LogOut className="mr-2 size-4" />
                  Logout
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <p className="text-xs text-slate-500">Database</p>
                  <p className="mt-1 font-semibold text-slate-800">Connected</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <p className="text-xs text-slate-500">Face AI</p>
                  <p className="mt-1 font-semibold text-slate-800">Ready</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
