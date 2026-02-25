'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'

interface AttendanceTrendData {
  date: string
  present: number
  absent: number
  late: number
}

interface StudentPerformanceData {
  name: string
  attendance: number
  confidence: number
}

interface FaceConfidenceData {
  range: string
  count: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export function AttendanceTrendChart({ data }: { data: AttendanceTrendData[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Weekly Attendance Trend</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" stroke="var(--color-muted-foreground)" />
          <YAxis stroke="var(--color-muted-foreground)" />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
          <Bar dataKey="present" fill="#10b981" name="Present" radius={[8, 8, 0, 0]} />
          <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[8, 8, 0, 0]} />
          <Bar dataKey="late" fill="#f59e0b" name="Late" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AttendanceRateChart({ data }: { data: Array<{ date: string; rate: number }> }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Attendance Rate Trend</h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" stroke="var(--color-muted-foreground)" />
          <YAxis stroke="var(--color-muted-foreground)" domain={[0, 100]} />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
            }}
            formatter={(value) => `${value}%`}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRate)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FaceConfidenceDistribution({ data }: { data: FaceConfidenceData[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Face Recognition Confidence</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={({ range, count }) => `${range}: ${count}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="count"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${value} detections`, 'Count']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StudentPerformanceChart({ data }: { data: StudentPerformanceData[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Top Performers</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" stroke="var(--color-muted-foreground)" domain={[0, 100]} />
          <YAxis dataKey="name" type="category" stroke="var(--color-muted-foreground)" width={100} />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
            }}
            formatter={(value) => `${value}%`}
          />
          <Legend />
          <Bar dataKey="attendance" fill="#10b981" name="Attendance %" radius={[0, 8, 8, 0]} />
          <Bar dataKey="confidence" fill="#3b82f6" name="Avg Confidence %" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SystemAccuracyMetrics({
  totalDetections,
  successfulMatches,
  falsePositives,
  avgConfidence,
}: {
  totalDetections: number
  successfulMatches: number
  falsePositives: number
  avgConfidence: number
}) {
  const accuracy = totalDetections > 0 ? ((successfulMatches / totalDetections) * 100).toFixed(1) : 0
  const falsePositiveRate =
    totalDetections > 0 ? ((falsePositives / totalDetections) * 100).toFixed(1) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">Total Detections</p>
        <p className="text-3xl font-bold text-foreground">{totalDetections}</p>
        <p className="text-xs text-muted-foreground mt-2">Face scans</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">Match Accuracy</p>
        <p className="text-3xl font-bold text-foreground">{accuracy}%</p>
        <p className="text-xs text-muted-foreground mt-2">Recognition rate</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">False Positive Rate</p>
        <p className="text-3xl font-bold text-foreground">{falsePositiveRate}%</p>
        <p className="text-xs text-muted-foreground mt-2">Error rate</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">Avg Confidence</p>
        <p className="text-3xl font-bold text-foreground">{avgConfidence.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground mt-2">Detection quality</p>
      </div>
    </div>
  )
}

export function AttendanceStatsSummary({
  totalStudents,
  presentCount,
  absentCount,
  lateCount,
}: {
  totalStudents: number
  presentCount: number
  absentCount: number
  lateCount: number
}) {
  const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">Total Students</p>
        <p className="text-3xl font-bold text-foreground">{totalStudents}</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">Present</p>
        <p className="text-3xl font-bold text-green-600">{presentCount}</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">Absent</p>
        <p className="text-3xl font-bold text-red-600">{absentCount}</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm mb-1">Late</p>
        <p className="text-3xl font-bold text-yellow-600">{lateCount}</p>
      </div>
    </div>
  )
}
