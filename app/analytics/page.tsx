'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DashboardShell } from '@/components/dashboard-shell'
import { Download, Database, Brain, Cloud } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  LineChart,
  Line,
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

interface AnalyticsData {
  attendanceRate: number
  totalDays: number
  averageConfidence: number
  systemAccuracy: number
  dailyData: Array<{ date: string; present: number; absent: number; late: number }>
  studentMetrics: Array<{ name: string; attendance: number; confidence: number }>
  faceMetrics: Array<{ confidence: string; count: number }>
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch analytics
  useEffect(() => {
    if (!loading) {
      // Mock analytics data until database is set up
      const mockAnalytics: AnalyticsData = {
        attendanceRate: 87.5,
        totalDays: 20,
        averageConfidence: 94.2,
        systemAccuracy: 96.8,
        dailyData: [
          { date: 'Mon', present: 28, absent: 2, late: 1 },
          { date: 'Tue', present: 29, absent: 1, late: 1 },
          { date: 'Wed', present: 27, absent: 2, late: 2 },
          { date: 'Thu', present: 30, absent: 0, late: 1 },
          { date: 'Fri', present: 26, absent: 3, late: 2 },
        ],
        studentMetrics: [
          { name: 'John Doe', attendance: 95, confidence: 96 },
          { name: 'Jane Smith', attendance: 92, confidence: 95 },
          { name: 'Bob Johnson', attendance: 78, confidence: 88 },
          { name: 'Alice Brown', attendance: 88, confidence: 93 },
          { name: 'Charlie Wilson', attendance: 85, confidence: 94 },
        ],
        faceMetrics: [
          { confidence: '90-95%', count: 120 },
          { confidence: '95-98%', count: 280 },
          { confidence: '98%+', count: 420 },
        ],
      }
      setAnalytics(mockAnalytics)
    }
  }, [])

  const exportAnalytics = () => {
    if (!analytics) return

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Metric', 'Value'],
      ['Attendance Rate', `${analytics.attendanceRate}%`],
      ['Total Classes', analytics.totalDays],
      ['Avg Face Confidence', `${analytics.averageConfidence}%`],
      ['System Accuracy', `${analytics.systemAccuracy}%`],
      ['Generated On', new Date().toLocaleString()],
    ])

    const studentSheet = XLSX.utils.json_to_sheet(
      analytics.studentMetrics.map((student) => ({
        Name: student.name,
        Attendance: `${student.attendance}%`,
        Confidence: `${student.confidence}%`,
      })),
    )

    const dailySheet = XLSX.utils.json_to_sheet(analytics.dailyData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
    XLSX.utils.book_append_sheet(workbook, studentSheet, 'Students')
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Trend')

    const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-analysis-${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading analytics...</p>
      </div>
    )
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  return (
    <DashboardShell title="Reports" subtitle="Analytics and trends">
      <main className="space-y-6">
        <section className="glass-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Insights & Trends</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">Analytics Dashboard</h1>
              <p className="mt-2 text-sm text-muted-foreground">Track attendance quality, confidence distribution, and student performance at a glance.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportAnalytics} className="rounded-xl bg-[#2b5c9e] hover:bg-[#254f87]">
                <Download className="mr-2 size-4" />
                Download Analysis Excel
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700"><Database className="size-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Big Data</p>
                <p className="text-xs text-muted-foreground">Attendance trends, summaries, and exports</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">Monthly, weekly, and student-level analysis can be exported for offline review or dashboard reporting.</p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Brain className="size-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-800">AI</p>
                <p className="text-xs text-muted-foreground">Face recognition and confidence scoring</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">The recognition flow uses face embeddings and confidence values to support robust attendance decisions.</p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Cloud className="size-5" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Cloud Computing</p>
                <p className="text-xs text-muted-foreground">PostgreSQL storage and serverless APIs</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">Authentication, storage, and analysis endpoints are structured for cloud deployment and team access.</p>
          </div>
        </section>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-6">
            <p className="text-muted-foreground text-sm mb-1">Attendance Rate</p>
            <p className="text-3xl font-bold text-foreground">{analytics.attendanceRate}%</p>
            <p className="text-xs text-muted-foreground mt-2">Current week</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-muted-foreground text-sm mb-1">Total Classes</p>
            <p className="text-3xl font-bold text-foreground">{analytics.totalDays}</p>
            <p className="text-xs text-muted-foreground mt-2">This semester</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-muted-foreground text-sm mb-1">Avg Face Confidence</p>
            <p className="text-3xl font-bold text-foreground">{analytics.averageConfidence}%</p>
            <p className="text-xs text-muted-foreground mt-2">Recognition quality</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-muted-foreground text-sm mb-1">System Accuracy</p>
            <p className="text-3xl font-bold text-foreground">{analytics.systemAccuracy}%</p>
            <p className="text-xs text-muted-foreground mt-2">Detection rate</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Attendance Chart */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Daily Attendance</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
                <Legend />
                <Bar dataKey="present" fill="#10b981" name="Present" />
                <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                <Bar dataKey="late" fill="#f59e0b" name="Late" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Face Confidence Distribution */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Face Recognition Confidence</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.faceMetrics}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, count }) => `${name}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.faceMetrics.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Performance */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Student Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/60 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Student Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Attendance Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Avg Confidence</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analytics.studentMetrics.map((student, index) => (
                  <tr key={index} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 text-foreground">{student.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${student.attendance}%` }}
                          />
                        </div>
                        <span className="font-medium text-foreground">{student.attendance}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{student.confidence}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        student.attendance >= 85 
                          ? 'bg-green-100 text-green-800' 
                          : student.attendance >= 70
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {student.attendance >= 85 ? '✓ Good' : student.attendance >= 70 ? '⚠ Fair' : '✗ Poor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </DashboardShell>
  )
}
