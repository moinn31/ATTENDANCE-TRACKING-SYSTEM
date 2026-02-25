import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'daily'
    const days = parseInt(searchParams.get('days') || '7')

    // Generate mock analytics data
    const analyticsData = generateMockAnalytics(type, days)

    return NextResponse.json({ data: analyticsData })
  } catch (error) {
    console.error('[v0] Error fetching analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateMockAnalytics(type: string, days: number) {
  const today = new Date()
  const data: any[] = []

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    if (type === 'daily') {
      data.push({
        date: dateStr,
        total_students: 30,
        present: 26,
        absent: 3,
        late: 1,
        attendance_rate: 86.7,
        avg_confidence: 94.2,
      })
    } else if (type === 'hourly') {
      for (let hour = 8; hour < 18; hour++) {
        data.push({
          date: dateStr,
          hour,
          detections: Math.floor(Math.random() * 30),
          successful_matches: Math.floor(Math.random() * 28),
          avg_confidence: 90 + Math.random() * 10,
        })
      }
    }
  }

  return data
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { student_id, start_date, end_date } = body

    if (!student_id) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 })
    }

    // Generate student-specific analytics
    const studentAnalytics = {
      student_id,
      period: {
        start: start_date,
        end: end_date,
      },
      total_classes: 20,
      attended: 17,
      absent: 2,
      late: 1,
      attendance_rate: 85,
      avg_confidence: 93.5,
      trend: 'improving',
    }

    return NextResponse.json({ data: studentAnalytics })
  } catch (error) {
    console.error('[v0] Error generating student analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
