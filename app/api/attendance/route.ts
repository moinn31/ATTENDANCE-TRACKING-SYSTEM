import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type AttendanceRow = {
  id: string
  student_id: string
  date: string
  status: 'present' | 'absent' | 'late'
  class_name?: string | null
  subject_name?: string | null
  detected_confidence?: number | null
  confidence?: number | null
  timestamp?: string | null
  marked_at?: string | null
  created_at?: string | null
  students?: {
    name?: string | null
    roll_number?: string | null
    enrollment_number?: string | null
  } | null
}

const getLocalDate = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

const isMissingSessionColumnError = (error: unknown): boolean => {
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as { message: unknown }).message)
    : ''

  return /class_name|subject_name|schema cache|does not exist/i.test(message)
}

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
    const date = searchParams.get('date') || getLocalDate()
    const className = searchParams.get('className')
    const subjectName = searchParams.get('subjectName')

    let query = supabase
      .from('attendance_records')
      .select('id, student_id, date, status, class_name, subject_name, detected_confidence, timestamp, created_at, students(name, roll_number)')
      .eq('date', date)

    if (className) {
      query = query.eq('class_name', className)
    }

    if (subjectName) {
      query = query.eq('subject_name', subjectName)
    }

    const { data, error } = await query.order('timestamp', { ascending: false })

    if (error && isMissingSessionColumnError(error)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('attendance_records')
        .select('id, student_id, date, status, detected_confidence, timestamp, created_at, students(name, roll_number)')
        .eq('date', date)
        .order('timestamp', { ascending: false })

      if (legacyError) {
        return NextResponse.json({ error: legacyError.message }, { status: 500 })
      }

      const attendance = ((legacyData ?? []) as AttendanceRow[]).map((row) => ({
        id: row.id,
        student_id: row.student_id,
        student_name: row.students?.name ?? 'Unknown',
        roll_number: row.students?.roll_number ?? row.students?.enrollment_number ?? null,
        date: row.date,
        class_name: null,
        subject_name: null,
        status: row.status,
        confidence: row.detected_confidence ?? row.confidence ?? null,
        marked_at: row.timestamp ?? row.marked_at ?? row.created_at ?? null,
      }))

      return NextResponse.json({ data: attendance, legacySchema: true })
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const attendance = ((data ?? []) as AttendanceRow[]).map((row) => ({
      id: row.id,
      student_id: row.student_id,
      student_name: row.students?.name ?? 'Unknown',
      roll_number: row.students?.roll_number ?? row.students?.enrollment_number ?? null,
      date: row.date,
      class_name: row.class_name ?? null,
      subject_name: row.subject_name ?? null,
      status: row.status,
      confidence: row.detected_confidence ?? row.confidence ?? null,
      marked_at: row.timestamp ?? row.marked_at ?? row.created_at ?? null,
    }))

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
    const { student_id, status, confidence, date, class_name, subject_name } = body

    if (!student_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const attendanceDate = date || getLocalDate()

    let existingQuery = supabase
      .from('attendance_records')
      .select('id, status')
      .eq('student_id', student_id)
      .eq('date', attendanceDate)

    if (typeof class_name === 'string' && class_name.trim()) {
      existingQuery = existingQuery.eq('class_name', class_name.trim())
    } else {
      existingQuery = existingQuery.is('class_name', null)
    }

    if (typeof subject_name === 'string' && subject_name.trim()) {
      existingQuery = existingQuery.eq('subject_name', subject_name.trim())
    } else {
      existingQuery = existingQuery.is('subject_name', null)
    }

    let { data: existing, error: existingError } = await existingQuery.maybeSingle()

    if (existingError && isMissingSessionColumnError(existingError)) {
      ;({ data: existing, error: existingError } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('student_id', student_id)
        .eq('date', attendanceDate)
        .maybeSingle())
    }

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing) {
      const existingRow = existing as { id: string; status: 'present' | 'absent' | 'late' }

      if (existingRow.status === status) {
        return NextResponse.json({ data: existingRow, duplicate: true })
      }

      const updatePayload: Record<string, unknown> = {
        status,
        class_name: class_name ?? null,
        subject_name: subject_name ?? null,
        detected_confidence: confidence ?? 0,
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      let { data: updated, error: updateError } = await supabase
        .from('attendance_records')
        .update(updatePayload)
        .eq('id', existingRow.id)
        .select('*')
        .single()

      if (updateError && isMissingSessionColumnError(updateError)) {
        ;({ data: updated, error: updateError } = await supabase
          .from('attendance_records')
          .update({
            status,
            detected_confidence: confidence ?? 0,
            timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRow.id)
          .select('*')
          .single())
      }

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      const updatedRecord = {
        id: (updated as AttendanceRow).id,
        student_id,
        date: attendanceDate,
        status,
        confidence: confidence ?? 0,
        marked_by: user.id,
        marked_at: new Date().toISOString(),
      }

      return NextResponse.json({ data: updatedRecord, updated: true })
    }

    let { data: created, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        student_id,
        date: attendanceDate,
        status,
          class_name: class_name ?? null,
          subject_name: subject_name ?? null,
        detected_confidence: confidence ?? 0,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insertError && isMissingSessionColumnError(insertError)) {
      ;({ data: created, error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          student_id,
          date: attendanceDate,
          status,
          detected_confidence: confidence ?? 0,
          created_by: user.id,
        })
        .select('*')
        .single())
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const record = {
      id: (created as AttendanceRow).id,
      student_id,
      date: attendanceDate,
      status,
      confidence: confidence ?? 0,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
    }

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    console.error('[v0] Error marking attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const all = Boolean(body?.all)
    const date = typeof body?.date === 'string' ? body.date : null
    const className = typeof body?.class_name === 'string' ? body.class_name : null
    const subjectName = typeof body?.subject_name === 'string' ? body.subject_name : null

    let query = supabase.from('attendance_records').delete().eq('created_by', user.id)

    if (!all) {
      if (!date) {
        return NextResponse.json({ error: 'date is required when all is false' }, { status: 400 })
      }

      query = query.eq('date', date)

      if (className) {
        query = query.eq('class_name', className)
      }

      if (subjectName) {
        query = query.eq('subject_name', subjectName)
      }
    }

    let { error } = await query

    if (error && isMissingSessionColumnError(error) && !all) {
      let fallback = supabase
        .from('attendance_records')
        .delete()
        .eq('created_by', user.id)
        .eq('date', date)
      ;({ error } = await fallback)
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error clearing attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
