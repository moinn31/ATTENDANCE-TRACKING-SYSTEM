import pool from '@/lib/db.js'
import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    verifyToken(request)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'daily'
    const days = Number.parseInt(searchParams.get('days') || '7', 10)

    const analyticsData = await generateAnalytics(type, Number.isFinite(days) ? days : 7)

    return NextResponse.json({ data: analyticsData })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error fetching analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    verifyToken(request)

    const body = await request.json()
    const { student_id, start_date, end_date } = body

    if (!student_id) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 })
    }

    const studentAnalytics = await generateStudentAnalytics(student_id, start_date, end_date)

    return NextResponse.json({ data: studentAnalytics })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error generating student analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateAnalytics(type: string, days: number) {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - Math.max(days - 1, 0))

  const { rows } = await pool.query<{
    date: string
    status: 'present' | 'absent' | 'late'
    detected_confidence: number | null
  }>(
    `
      select
        date::text as date,
        status,
        detected_confidence
      from public.attendance_records
      where date >= $1::date
      order by date desc, timestamp desc
    `,
    [startDate.toISOString().split('T')[0]],
  )

  const groupedByDate = new Map<string, { present: number; absent: number; late: number; confidences: number[] }>()

  for (const row of rows) {
    const bucket = groupedByDate.get(row.date) ?? { present: 0, absent: 0, late: 0, confidences: [] }
    bucket[row.status] += 1
    if (typeof row.detected_confidence === 'number') {
      bucket.confidences.push(Number(row.detected_confidence))
    }
    groupedByDate.set(row.date, bucket)
  }

  const data: Array<Record<string, unknown>> = []

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const bucket = groupedByDate.get(dateStr) ?? { present: 0, absent: 0, late: 0, confidences: [] }
    const total = bucket.present + bucket.absent + bucket.late
    const averageConfidence = bucket.confidences.length
      ? bucket.confidences.reduce((sum, value) => sum + value, 0) / bucket.confidences.length
      : 0

    if (type === 'daily') {
      data.push({
        date: dateStr,
        total_students: total,
        present: bucket.present,
        absent: bucket.absent,
        late: bucket.late,
        attendance_rate: total ? Number(((bucket.present / total) * 100).toFixed(1)) : 0,
        avg_confidence: Number(averageConfidence.toFixed(1)),
      })
    } else {
      for (let hour = 8; hour < 18; hour++) {
        data.push({
          date: dateStr,
          hour,
          detections: total,
          successful_matches: bucket.present,
          avg_confidence: Number(averageConfidence.toFixed(1)),
        })
      }
    }
  }

  return data
}

async function generateStudentAnalytics(studentId: string, startDate?: string, endDate?: string) {
  const { rows } = await pool.query<{
    status: 'present' | 'absent' | 'late'
    detected_confidence: number | null
  }>(
    `
      select
        status,
        detected_confidence
      from public.attendance_records
      where student_id = $1
        and ($2::date is null or date >= $2::date)
        and ($3::date is null or date <= $3::date)
    `,
    [studentId, startDate || null, endDate || null],
  )

  const totalClasses = rows.length
  const attended = rows.filter((row) => row.status === 'present').length
  const absent = rows.filter((row) => row.status === 'absent').length
  const late = rows.filter((row) => row.status === 'late').length
  const avgConfidence = rows.length
    ? rows.reduce((sum, row) => sum + (Number(row.detected_confidence) || 0), 0) / rows.length
    : 0

  return {
    student_id: studentId,
    period: {
      start: startDate ?? null,
      end: endDate ?? null,
    },
    total_classes: totalClasses,
    attended,
    absent,
    late,
    attendance_rate: totalClasses ? Number(((attended / totalClasses) * 100).toFixed(1)) : 0,
    avg_confidence: Number(avgConfidence.toFixed(1)),
    trend: attended >= absent ? 'improving' : 'needs_attention',
  }
}