'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DashboardShell } from '@/components/dashboard-shell'
import {
  Download, RefreshCcw, Users, CheckCircle2, XCircle,
  TrendingUp, Activity, BarChart3
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface ReportsData {
  overview: {
    total_records: number
    total_students: number
    total_present: number
    total_absent: number
    total_late: number
    avg_confidence: number
    total_days: number
    attendance_rate: number
  }
  daily_trend: Array<{ date: string; present: number; absent: number; late: number; total: number }>
  students: Array<{
    name: string
    roll_number: string
    total: number
    present: number
    absent: number
    confidence: number
    attendance_pct: number
  }>
  confidence_dist: Array<{ bucket: string; count: number }>
  recent: Array<{
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

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string>('')

  const fetchReports = useCallback(async () => {
    try {
      const token = window.localStorage.getItem('token')
      if (!token) { router.replace('/auth/login'); return }

      const res = await fetch('/api/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.status === 401) { router.replace('/auth/login'); return }

      if (res.ok) {
        const result = await res.json()
        setData(result.data)
        setLastRefresh(new Date().toLocaleTimeString())
      }
    } catch (err) {
      console.error('Reports fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchReports()
    const interval = setInterval(fetchReports, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [fetchReports])

  const exportToExcel = () => {
    if (!data) return

    // Summary sheet
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Smart Attendance System — Report'],
      [],
      ['Metric', 'Value'],
      ['Total Students', data.overview.total_students],
      ['Total Records', data.overview.total_records],
      ['Total Days', data.overview.total_days],
      ['Present Count', data.overview.total_present],
      ['Absent Count', data.overview.total_absent],
      ['Attendance Rate', `${data.overview.attendance_rate}%`],
      ['Avg AI Confidence', `${data.overview.avg_confidence}%`],
      ['Generated On', new Date().toLocaleString()],
    ])

    // Student performance sheet
    const studentSheet = XLSX.utils.json_to_sheet(
      data.students.map(s => ({
        Name: s.name,
        'Roll Number': s.roll_number,
        'Total Records': s.total,
        Present: s.present,
        Absent: s.absent,
        'Attendance %': `${s.attendance_pct}%`,
        'Avg Confidence': `${s.confidence}%`,
        Status: s.attendance_pct >= 85 ? 'Good' : s.attendance_pct >= 70 ? 'Fair' : 'Poor',
      }))
    )

    // Daily trend sheet
    const dailySheet = XLSX.utils.json_to_sheet(
      data.daily_trend.map(d => ({
        Date: new Date(d.date).toLocaleDateString(),
        Present: d.present,
        Absent: d.absent,
        Late: d.late,
        Total: d.total,
      }))
    )

    // Recent records sheet
    const recentSheet = XLSX.utils.json_to_sheet(
      data.recent.map(r => ({
        Student: r.student_name,
        'Roll Number': r.roll_number,
        Status: r.status,
        Confidence: `${r.confidence}%`,
        Time: new Date(r.time).toLocaleString(),
        Class: r.class_name || '-',
        Subject: r.subject_name || '-',
      }))
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
    XLSX.utils.book_append_sheet(workbook, studentSheet, 'Students')
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Trend')
    XLSX.utils.book_append_sheet(workbook, recentSheet, 'Recent Records')

    const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([workbookArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  if (loading && !data) {
    return (
      <DashboardShell title="Reports" subtitle="Analytics and trends">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <RefreshCcw className="size-8 text-slate-300 animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading reports from database...</p>
          </div>
        </div>
      </DashboardShell>
    )
  }

  const overview = data?.overview

  return (
    <DashboardShell title="Reports" subtitle="Analytics and trends">
      <main className="space-y-5">

        {/* Header with live indicator & export */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">
              Live Data — auto-refreshes every 30s
            </span>
            <span className="text-xs text-slate-400 ml-2">
              Last: {lastRefresh || '--:--:--'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => { setLoading(true); fetchReports() }}
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              disabled={loading}
            >
              <RefreshCcw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportToExcel} size="sm" className="rounded-xl bg-[#2b5c9e] hover:bg-[#254f87] gap-2">
              <Download className="size-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Overview Stat Cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Students</p>
                <p className="mt-2 text-3xl font-bold text-slate-800">{overview?.total_students ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-blue-100 p-2.5 text-blue-600">
                <Users className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">{overview?.total_days ?? 0} days tracked</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Present</p>
                <p className="mt-2 text-3xl font-bold text-emerald-600">{overview?.total_present ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">of {overview?.total_records ?? 0} total records</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Absent</p>
                <p className="mt-2 text-3xl font-bold text-red-500">{overview?.total_absent ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-red-100 p-2.5 text-red-500">
                <XCircle className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-red-400">
              {overview && overview.total_records > 0
                ? `${Math.round((overview.total_absent / overview.total_records) * 100)}% absence rate`
                : 'No data yet'}
            </p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Attendance Rate</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">{overview?.attendance_rate ?? 0}%</p>
              </div>
              <div className="rounded-2xl bg-blue-100 p-2.5 text-blue-600">
                <TrendingUp className="size-5" />
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-700"
                style={{ width: `${overview?.attendance_rate ?? 0}%` }}
              />
            </div>
          </div>
        </section>

        {/* Charts Row */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          {/* Daily Attendance Trend Bar Chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Daily Attendance Trend</h2>
              <Badge variant="outline" className="rounded-full border-blue-200 bg-white/80 text-slate-600">
                Last 14 Days
              </Badge>
            </div>
            {data?.daily_trend && data.daily_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.daily_trend.map(d => ({ ...d, date: formatDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="present" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-400">
                <p>No daily data available yet.</p>
              </div>
            )}
          </div>

          {/* AI Confidence Distribution Pie Chart */}
          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">AI Confidence Distribution</h2>
            {data?.confidence_dist && data.confidence_dist.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.confidence_dist}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="bucket"
                    >
                      {data.confidence_dist.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {data.confidence_dist.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-600">{item.bucket}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{item.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-400">
                <p>No confidence data yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Student Performance Table */}
        <section className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Student Performance</h2>
            <Badge variant="outline" className="rounded-full border-slate-200 bg-white/80 text-slate-600">
              {data?.students?.length ?? 0} students
            </Badge>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Roll No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Present</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Absent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.students && data.students.length > 0 ? (
                  data.students.map((student, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-800">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.roll_number}</td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-600">{student.present}</td>
                      <td className="px-4 py-3 text-sm font-medium text-red-500">{student.absent}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                student.attendance_pct >= 85 ? 'bg-emerald-500' :
                                student.attendance_pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${student.attendance_pct}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-700">{student.attendance_pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.confidence}%</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          student.attendance_pct >= 85
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : student.attendance_pct >= 70
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {student.attendance_pct >= 85 ? '✓ Good' : student.attendance_pct >= 70 ? '⚠ Fair' : '✗ At Risk'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      No student data available. Mark attendance to populate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Records */}
        <section className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Recent Attendance Records</h2>
            <div className="flex items-center gap-1.5">
              <Activity className="size-4 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Latest 20</span>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {data?.recent && data.recent.length > 0 ? (
              data.recent.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3 transition-all hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`size-2.5 rounded-full ${
                      record.status === 'present' ? 'bg-emerald-500' :
                      record.status === 'late' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{record.student_name}</p>
                      <p className="text-[11px] text-slate-400">
                        {record.roll_number} • {new Date(record.time).toLocaleString()} • {record.confidence}% confidence
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                    record.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    record.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {record.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <BarChart3 className="size-8 mb-2 opacity-40" />
                <p className="text-sm">No records yet</p>
              </div>
            )}
          </div>
        </section>

      </main>
    </DashboardShell>
  )
}
