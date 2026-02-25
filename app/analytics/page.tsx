'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
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
  faceMetrics: Array<{ confidence: number; count: number }>
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [router, supabase.auth])

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
  }, [loading])

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading analytics...</p>
      </div>
    )
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-1">Attendance Rate</p>
            <p className="text-3xl font-bold text-foreground">{analytics.attendanceRate}%</p>
            <p className="text-xs text-muted-foreground mt-2">Current week</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-1">Total Classes</p>
            <p className="text-3xl font-bold text-foreground">{analytics.totalDays}</p>
            <p className="text-xs text-muted-foreground mt-2">This semester</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-1">Avg Face Confidence</p>
            <p className="text-3xl font-bold text-foreground">{analytics.averageConfidence}%</p>
            <p className="text-xs text-muted-foreground mt-2">Recognition quality</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-1">System Accuracy</p>
            <p className="text-3xl font-bold text-foreground">{analytics.systemAccuracy}%</p>
            <p className="text-xs text-muted-foreground mt-2">Detection rate</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Attendance Chart */}
          <div className="bg-card border border-border rounded-lg p-6">
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
          <div className="bg-card border border-border rounded-lg p-6">
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
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Student Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
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
      </div>
    </main>
  )
}
