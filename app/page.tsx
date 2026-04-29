'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users, GraduationCap, CheckCircle2, XCircle, TrendingUp,
  RefreshCcw, Activity
} from 'lucide-react'

interface DashboardData {
  today: {
    date: string
    present: number
    absent: number
    late: number
    scanned: number
    total_students: number
    attendance_rate: number
    avg_confidence: number
  }
  weekly_trend: Array<{ date: string; present: number; absent: number; late: number }>
  recent_activity: Array<{
    id: string
    student_name: string
    roll_number: string
    status: string
    confidence: number
    time: string
    class_name: string
    subject_name: string
  }>
}

export default function Home() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string>('')

  const fetchDashboard = useCallback(async () => {
    try {
      const token = window.localStorage.getItem('token')
      if (!token) {
        window.localStorage.removeItem('token')
        router.replace('/auth/login')
        return
      }

      const res = await fetch('/api/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.status === 401) {
        window.localStorage.removeItem('token')
        router.replace('/auth/login')
        return
      }

      if (res.ok) {
        const result = await res.json()
        setData(result.data)
        setLastRefresh(new Date().toLocaleTimeString())
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 15000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  const formatTime = (isoString: string) => {
    if (!isoString) return '-'
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    } catch { return '-' }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-500'
      case 'late': return 'bg-amber-500'
      case 'absent': return 'bg-red-500'
      default: return 'bg-slate-400'
    }
  }

  const statusBg = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'late': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'absent': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  const today = data?.today
  const maxBarValue = data?.weekly_trend
    ? Math.max(...data.weekly_trend.map(d => d.present + d.absent + d.late), 1)
    : 1

  return (
    <DashboardShell title="Dashboard" subtitle="Attendance overview and daily operations">
      <main className="space-y-5">

        {/* Live indicator + refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">
              Live — auto-refreshes every 15s
            </span>
            <span className="text-xs text-slate-400 ml-2">
              Last: {lastRefresh || '--:--:--'}
            </span>
          </div>
          <Button
            onClick={() => { setLoading(true); fetchDashboard() }}
            variant="outline"
            size="sm"
            className="rounded-xl gap-2"
            disabled={loading}
          >
            <RefreshCcw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stat Cards Row — 3 cards only */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Present Today */}
          <div className="glass-card border-emerald-200/70 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Present Today</p>
                <p className="mt-2 text-5xl font-bold text-slate-800">
                  {loading ? '...' : today?.present ?? 0}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                <CheckCircle2 className="size-6" />
              </div>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-100">
              <div
                className="h-2.5 rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${today ? Math.min((today.present / Math.max(today.total_students, 1)) * 100, 100) : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              of {today?.total_students ?? 0} total students
            </p>
          </div>

          {/* Absent */}
          <div className="glass-card border-red-200/70 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Absent Today</p>
                <p className="mt-2 text-5xl font-bold text-slate-800">
                  {loading ? '...' : today?.absent ?? 0}
                </p>
              </div>
              <div className="rounded-2xl bg-red-100 p-3 text-red-500">
                <XCircle className="size-6" />
              </div>
            </div>
            {today && today.total_students > 0 && (
              <div className="mt-4">
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full bg-red-400 transition-all duration-700"
                    style={{ width: `${Math.round((today.absent / Math.max(today.total_students, 1)) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-red-500 font-medium">
                  {Math.round((today.absent / Math.max(today.total_students, 1)) * 100)}% absence rate
                </p>
              </div>
            )}
          </div>

          {/* Attendance Rate */}
          <div className="glass-card border-blue-200/70 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Attendance Rate</p>
                <p className="mt-2 text-5xl font-bold text-slate-800">
                  {loading ? '...' : `${today?.attendance_rate ?? 0}%`}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
                <TrendingUp className="size-6" />
              </div>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-100">
              <div
                className="h-2.5 rounded-full bg-blue-500 transition-all duration-700"
                style={{ width: `${today?.attendance_rate ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {(today?.attendance_rate ?? 0) >= 80 ? '✓ Good attendance' : '⚠ Below target'}
            </p>
          </div>
        </section>

        {/* Main Content: Weekly Chart + Live Activity Feed */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
          {/* Weekly Attendance Chart */}
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Weekly Attendance Trend</h2>
              <Badge variant="outline" className="rounded-full border-blue-200 bg-white/80 text-slate-700">
                Last 7 Days
              </Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              {data?.weekly_trend && data.weekly_trend.length > 0 ? (
                <>
                  <div className="flex h-52 items-end gap-3">
                    {data.weekly_trend.map((day, index) => {
                      const total = day.present + day.absent + day.late
                      const presentPct = (day.present / maxBarValue) * 100
                      const absentPct = (day.absent / maxBarValue) * 100
                      const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })

                      return (
                        <div key={index} className="flex flex-1 flex-col items-center gap-2 group">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-600 font-medium">
                            {total}
                          </div>
                          <div className="flex w-full items-end gap-1" style={{ height: '160px' }}>
                            <div
                              className="flex-1 rounded-t-md bg-emerald-400 transition-all duration-500"
                              style={{ height: `${Math.max(presentPct, 4)}%` }}
                              title={`Present: ${day.present}`}
                            />
                            <div
                              className="flex-1 rounded-t-md bg-red-400 transition-all duration-500"
                              style={{ height: `${Math.max(absentPct, 4)}%` }}
                              title={`Absent: ${day.absent}`}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-slate-500">{dateLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-emerald-400" />Present</span>
                    <span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-red-400" />Absent</span>
                  </div>
                </>
              ) : (
                <div className="flex h-52 items-center justify-center text-slate-400">
                  <p>No attendance data this week yet. Mark attendance to see the chart!</p>
                </div>
              )}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Live Activity</h2>
              <div className="flex items-center gap-1.5">
                <Activity className="size-4 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Real-time</span>
              </div>
            </div>
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {data?.recent_activity && data.recent_activity.length > 0 ? (
                data.recent_activity.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 transition-all hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`size-2.5 rounded-full ${statusColor(record.status)}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{record.student_name}</p>
                        <p className="text-[11px] text-slate-400">{record.roll_number} • {formatTime(record.time)}</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusBg(record.status)}`}>
                      {record.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users className="size-8 mb-2 opacity-40" />
                  <p className="text-sm">No activity today yet</p>
                  <p className="text-xs mt-1">Mark attendance to see live updates</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Bottom Row: AI Confidence + Quick Navigate */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* AI Confidence Card */}
          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Face Recognition Quality</h2>
            <div className="flex items-center gap-6">
              <div className="relative h-28 w-28 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={
                      (today?.avg_confidence ?? 0) >= 90 ? '#10b981' :
                      (today?.avg_confidence ?? 0) >= 70 ? '#f59e0b' : '#ef4444'
                    }
                    strokeWidth="3"
                    strokeDasharray={`${today?.avg_confidence ?? 0}, 100`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-slate-800">
                    {today?.avg_confidence ?? 0}%
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  Average confidence score across all face detections today.
                </p>
                <p className="text-xs text-slate-400">
                  {(today?.avg_confidence ?? 0) >= 90
                    ? '✓ Excellent recognition quality'
                    : (today?.avg_confidence ?? 0) >= 70
                    ? '⚠ Acceptable quality — consider better lighting'
                    : today?.scanned
                    ? '✗ Low confidence — check camera setup'
                    : 'No scans today yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Navigate */}
          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Navigate</h2>
            <div className="grid grid-cols-2 gap-3">
              <a href="/scanner" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-[#2b5c9e] to-[#3b7dd8] px-4 py-3.5 text-white transition-all hover:shadow-lg hover:scale-[1.02]">
                <GraduationCap className="size-5" />
                <span className="text-sm font-medium">Scan Attendance</span>
              </a>
              <a href="/students" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3.5 text-slate-700 transition-all hover:shadow-lg hover:scale-[1.02]">
                <Users className="size-5" />
                <span className="text-sm font-medium">Students</span>
              </a>
              <a href="/analytics" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3.5 text-slate-700 transition-all hover:shadow-lg hover:scale-[1.02]">
                <TrendingUp className="size-5" />
                <span className="text-sm font-medium">Reports</span>
              </a>
              <a href="/system-status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3.5 text-slate-700 transition-all hover:shadow-lg hover:scale-[1.02]">
                <Activity className="size-5" />
                <span className="text-sm font-medium">System Status</span>
              </a>
            </div>
          </div>
        </section>

      </main>
    </DashboardShell>
  )
}
