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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Get attendance for specific date
    // Would query from database when schema is set up
    const attendance = [
      {
        id: '1',
        student_id: '1',
        student_name: 'John Doe',
        date,
        status: 'present',
        confidence: 96.5,
        marked_at: new Date().toISOString(),
      },
      {
        id: '2',
        student_id: '2',
        student_name: 'Jane Smith',
        date,
        status: 'present',
        confidence: 94.2,
        marked_at: new Date().toISOString(),
      },
    ]

    return NextResponse.json({ data: attendance })
  } catch (error) {
    console.error('[v0] Error fetching attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
    const { student_id, status, confidence, date } = body

    if (!student_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Would insert into database when schema is set up
    const record = {
      id: Date.now().toString(),
      student_id,
      date: date || new Date().toISOString().split('T')[0],
      status,
      confidence: confidence || 0,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
    }

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    console.error('[v0] Error marking attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
