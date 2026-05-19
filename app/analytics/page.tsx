'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DashboardShell } from '@/components/dashboard-shell'
import { Users, UserCheck, UserX, Clock, CalendarDays, BrainCircuit, Activity, Cpu, Download, RefreshCcw, TrendingUp, BarChart3, AlertTriangle, Target, CheckCircle2, XCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, ComposedChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart
} from 'recharts'
import { useAuth } from '@/hooks/use-auth'

// Define interfaces matching our APIs
interface PredictiveData {
  prediction: {
    next_day_expected_rate: number
    forecast: Array<{ date: string; predicted_rate: number }>
    confidence_interval: string
    model_used: string
  }
  risk_analysis: {
    at_risk_count: number
    students: Array<{
      name: string
      roll_number: string
      historical_rate: number
      recent_rate: number
      risk_factor: string
      risk_reason: string
    }>
  }
  time_intelligence: {
    peak_hours: Array<{ hour: string; volume: number }>
  }
  behavioral_insights: {
    day_of_week: Array<{ day: string; rate: number }>
  }
  model_metrics: {
    confidence_trend: Array<{ date: string; confidence: number }>
  }
}

interface ReportsData {
  overview: any
  daily_trend: any[]
  students: any[]
  confidence_dist: any[]
  recent: any[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const [data, setData] = useState<ReportsData | null>(null)
  const [bdaData, setBdaData] = useState<PredictiveData | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'bda' | 'standard'>('bda')

  const fetchAllData = useCallback(async () => {
    try {
      const [resReports, resBda] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/analytics/predictive')
      ])

      if (resReports.status === 401 || resBda.status === 401) {
        router.replace('/auth/login')
        return
      }

      if (resReports.ok && resBda.ok) {
        const resultReports = await resReports.json()
        const resultBda = await resBda.json()
        
        setData(resultReports.data)
        setBdaData(resultBda.data)
        setLastRefresh(new Date().toLocaleTimeString())
      }
    } catch (err) {
      console.error('Data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!authLoading) {
      fetchAllData()
      const interval = setInterval(fetchAllData, 45000) // Refresh every 45s
      return () => clearInterval(interval)
    }
  }, [fetchAllData, authLoading])

  const exportToExcel = async () => {
    if (!data) return
    const XLSX = await import('xlsx')

    // Same export logic as before
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Advanced Analytics & Big Data Report'],
      ['Generated On', new Date().toLocaleString()],
      [],
      ['Metric', 'Value'],
      ['Total Students', data.overview.total_students],
      ['Total Records', data.overview.total_records],
      ['Total Days', data.overview.total_days],
      ['Attendance Rate', `${data.overview.attendance_rate}%`],
      ['Avg AI Confidence', `${data.overview.avg_confidence}%`],
      ['Predicted Next Day Rate', `${bdaData?.prediction.next_day_expected_rate}%`]
    ])

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bda-analytics-report-${new Date().toISOString().slice(0, 10)}.xlsx`
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
      <DashboardShell title="Big Data Analytics" subtitle="AI-driven insights & predictive reporting">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <BrainCircuit className="size-12 text-[#2b5c9e] animate-pulse" />
          <div className="text-center space-y-1">
            <h3 className="text-lg font-semibold text-slate-800">Processing Big Data...</h3>
            <p className="text-sm text-slate-500">Running ML models & generating insights</p>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Big Data Analytics" subtitle="AI-driven insights & predictive reporting">
      <main className="space-y-6 pb-6">

        {/* Action Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">
              Live BDA Engine Online
            </span>
            <span className="text-xs text-slate-400 ml-2 hidden sm:inline-block">
              Last synced: {lastRefresh}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => { setLoading(true); fetchAllData() }}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none rounded-xl gap-2 h-10"
              disabled={loading}
            >
              <RefreshCcw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={exportToExcel} size="sm" className="flex-1 sm:flex-none rounded-xl bg-[#2b5c9e] hover:bg-[#254f87] gap-2 h-10">
              <Download className="size-4" />
              <span>Export</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex p-1 space-x-1 bg-slate-100/80 backdrop-blur rounded-2xl max-w-sm">
          <button
            onClick={() => setActiveTab('bda')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'bda' ? 'bg-white text-[#2b5c9e] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BrainCircuit className="size-4" />
            Predictive AI
          </button>
          <button
            onClick={() => setActiveTab('standard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'standard' ? 'bg-white text-[#2b5c9e] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="size-4" />
            Historical
          </button>
        </div>

        {/* Tab Content: BDA & Predictive Analytics */}
        {activeTab === 'bda' && bdaData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Predictive Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-6 bg-gradient-to-br from-[#2b5c9e]/5 to-blue-500/5 border-blue-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                    <Target className="size-5" />
                  </div>
                  <h3 className="font-semibold text-slate-800">Predicted Tomorrow</h3>
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-bold text-slate-800">{bdaData.prediction.next_day_expected_rate}%</p>
                  <p className="text-sm text-slate-500 mb-1">{bdaData.prediction.confidence_interval}</p>
                </div>
                <p className="mt-3 text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  <BrainCircuit className="size-3.5 text-blue-500" />
                  Powered by {bdaData.prediction.model_used}
                </p>
              </div>

              <div className="glass-card p-6 bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-red-100 rounded-xl text-red-600">
                    <AlertTriangle className="size-5" />
                  </div>
                  <h3 className="font-semibold text-slate-800">At-Risk Students</h3>
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-bold text-slate-800">{bdaData.risk_analysis.at_risk_count}</p>
                  <p className="text-sm text-red-500 font-medium mb-1">Require Intervention</p>
                </div>
                <p className="mt-3 text-xs text-slate-500 font-medium">
                  Detected sudden drops in historical attendance patterns
                </p>
              </div>

              <div className="glass-card p-6 border-slate-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                    <Clock className="size-5" />
                  </div>
                  <h3 className="font-semibold text-slate-800">Peak Traffic Hour</h3>
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-bold text-slate-800">
                    {bdaData.time_intelligence.peak_hours.length > 0 
                      ? bdaData.time_intelligence.peak_hours.reduce((max, obj) => obj.volume > max.volume ? obj : max, bdaData.time_intelligence.peak_hours[0]).hour
                      : 'N/A'
                    }
                  </p>
                </div>
                <p className="mt-3 text-xs text-slate-500 font-medium">
                  Highest volume of facial recognition scans
                </p>
              </div>
            </div>

            {/* AI Forecast Chart */}
            <div className="glass-card p-5 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">5-Day AI Attendance Forecast</h2>
                  <p className="text-sm text-slate-500">Projected attendance rates based on real-time rolling algorithms</p>
                </div>
                <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 px-3 py-1 text-xs">
                  ML Enabled
                </Badge>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bdaData.prediction.forecast.map(d => ({ ...d, date: formatDate(d.date) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      itemStyle={{ fontWeight: 600 }}
                      formatter={(value: any) => [`${value}%`, 'Predicted Rate']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="predicted_rate" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorRate)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Behavioral Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              {/* Day of Week Analysis */}
              <div className="glass-card p-5 md:p-6 border-indigo-100">
                <div className="flex items-center gap-3 mb-6">
                  <CalendarDays className="size-5 text-indigo-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Attendance by Day of Week</h2>
                    <p className="text-xs text-slate-500">Identifying weekly drop-off patterns</p>
                  </div>
                </div>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bdaData.behavioral_insights.day_of_week} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                        formatter={(value: any) => [`${value}%`, 'Avg Attendance']}
                      />
                      <Bar 
                        dataKey="rate" 
                        fill="#8b5cf6" 
                        radius={[6, 6, 0, 0]} 
                        barSize={32}
                        animationDuration={1500}
                      >
                        {bdaData.behavioral_insights.day_of_week.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.rate < 75 ? '#ef4444' : (entry.rate > 90 ? '#10b981' : '#8b5cf6')} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI Confidence Trend */}
              <div className="glass-card p-5 md:p-6 border-sky-100">
                <div className="flex items-center gap-3 mb-6">
                  <Cpu className="size-5 text-sky-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">AI Confidence Trend</h2>
                    <p className="text-xs text-slate-500">Average face recognition accuracy over 14 days</p>
                  </div>
                </div>
                <div className="h-[260px] w-full">
                  {bdaData.model_metrics.confidence_trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={bdaData.model_metrics.confidence_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 5', 100]} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                          formatter={(value: any) => [`${value}%`, 'Avg Confidence']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="confidence" 
                          stroke="#0ea5e9" 
                          strokeWidth={3}
                          dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4, stroke: '#fff' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          animationDuration={1500}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">
                      Not enough data to plot confidence trend.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* At Risk Table */}
            <div className="glass-card p-5 md:p-6 border-red-100">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="size-5 text-red-500" />
                <h2 className="text-lg font-semibold text-slate-800">At-Risk Intervention List</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Historical Avg</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Recent (7d)</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Risk Level</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Pattern Detected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bdaData.risk_analysis.students.map((student, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-sm text-slate-800">{student.name}</p>
                          <p className="text-[11px] text-slate-500">{student.roll_number}</p>
                        </td>
                        <td className="py-3 text-sm font-medium text-slate-700">{student.historical_rate}%</td>
                        <td className="py-3">
                          <span className="text-sm font-bold text-red-500">{student.recent_rate}%</span>
                          <span className="text-xs text-slate-400 ml-2 block sm:inline">({student.recent_rate - student.historical_rate}%)</span>
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className={`${student.risk_factor === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                            {student.risk_factor}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-slate-500 font-medium hidden md:table-cell">
                          {student.risk_reason}
                        </td>
                      </tr>
                    ))}
                    {bdaData.risk_analysis.students.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                          No at-risk patterns detected by the AI model.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab Content: Standard Historical Reports */}
        {activeTab === 'standard' && data && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Overview Stat Cards */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
              <div className="glass-card p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">Total Students</p>
                    <p className="mt-1 md:mt-2 text-2xl md:text-3xl font-bold text-slate-800">{data.overview?.total_students ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-600 hidden sm:block">
                    <Users className="size-5" />
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">Total Present</p>
                    <p className="mt-1 md:mt-2 text-2xl md:text-3xl font-bold text-emerald-600">{data.overview?.total_present ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600 hidden sm:block">
                    <CheckCircle2 className="size-5" />
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">Total Absent</p>
                    <p className="mt-1 md:mt-2 text-2xl md:text-3xl font-bold text-red-500">{data.overview?.total_absent ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-red-100 p-2 text-red-500 hidden sm:block">
                    <XCircle className="size-5" />
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">Attendance Rate</p>
                    <p className="mt-1 md:mt-2 text-2xl md:text-3xl font-bold text-blue-600">{data.overview?.attendance_rate ?? 0}%</p>
                  </div>
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-600 hidden sm:block">
                    <TrendingUp className="size-5" />
                  </div>
                </div>
              </div>
            </section>

            {/* Historical Charts */}
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-800">14-Day Retrospective</h2>
                </div>
                {data.daily_trend && data.daily_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={data.daily_trend.map(d => ({ ...d, date: formatDate(d.date) }))} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="present" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line type="monotone" dataKey="total" stroke="#f59e0b" name="Total Scans" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">No daily data available.</div>
                )}
              </div>

              <div className="glass-card p-5">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">AI Recognition Accuracy</h2>
                {data.confidence_dist && data.confidence_dist.length > 0 ? (
                  <div className="flex flex-col items-center justify-center h-full pb-6">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={data.confidence_dist}
                          cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                          paddingAngle={2} dataKey="count" nameKey="bucket"
                        >
                          {data.confidence_dist.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full mt-4 space-y-2 px-2">
                      {data.confidence_dist.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] md:text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-slate-600 font-medium">{item.bucket} confidence</span>
                          </div>
                          <span className="font-bold text-slate-800">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">No confidence data.</div>
                )}
              </div>
            </section>

            {/* All Students Attendance Table */}
            <div className="glass-card p-5 md:p-6 border-slate-200/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Overall Student Attendance</h2>
                  <p className="text-sm text-slate-500">Comprehensive attendance percentages for all enrolled students</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Enrollment No.</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Total Scans</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase">Attendance %</th>
                      <th className="pb-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.students && data.students.map((student, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 pr-4 font-semibold text-sm text-slate-800">{student.name}</td>
                        <td className="py-3 text-sm text-slate-500 font-mono">{student.roll_number || 'N/A'}</td>
                        <td className="py-3 text-sm text-slate-700">{student.total}</td>
                        <td className="py-3">
                          <span className={`font-bold ${student.attendance_pct >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {student.attendance_pct}%
                          </span>
                        </td>
                        <td className="py-3 hidden md:table-cell">
                          <Badge variant="outline" className={`${student.attendance_pct >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {student.attendance_pct >= 75 ? 'Good' : 'At Risk'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {(!data.students || data.students.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                          No student records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </DashboardShell>
  )
}
