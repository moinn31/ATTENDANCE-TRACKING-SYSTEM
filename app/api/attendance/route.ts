import pool from '@/lib/db.js'
import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'
import { saveToHadoop } from '@/lib/hadoop.js'

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
}

const getLocalDate = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    verifyToken(request)

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getLocalDate()
    const className = searchParams.get('className')
    const subjectName = searchParams.get('subjectName')

    const filters: string[] = ['ar.date = $1']
    const values: unknown[] = [date]

    if (className) {
      values.push(className)
      filters.push(`ar.class_name = $${values.length}`)
    }

    if (subjectName) {
      values.push(subjectName)
      filters.push(`ar.subject_name = $${values.length}`)
    }

    const { rows } = await pool.query<AttendanceRow & { student_name: string; roll_number: string | null }>(
      `
        select
          ar.id,
          ar.student_id,
          ar.date,
          ar.status,
          ar.class_name,
          ar.subject_name,
          ar.detected_confidence,
          ar.timestamp,
          ar.created_at,
          s.name as student_name,
          s.roll_number
        from public.attendance_records ar
        inner join public.students s on s.id = ar.student_id
        where ${filters.join(' and ')}
        order by ar.timestamp desc
      `,
      values,
    )

    const attendance = rows.map((row) => ({
      id: row.id,
      student_id: row.student_id,
      student_name: row.student_name ?? 'Unknown',
      roll_number: row.roll_number ?? null,
      date: row.date,
      class_name: row.class_name ?? null,
      subject_name: row.subject_name ?? null,
      status: row.status,
      confidence: row.detected_confidence ?? row.confidence ?? null,
      marked_at: row.timestamp ?? row.marked_at ?? row.created_at ?? null,
    }))

    return NextResponse.json({ data: attendance })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error fetching attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    verifyToken(request)

    const body = await request.json()
    const { student_id, status, confidence, date, class_name, subject_name } = body

    if (!student_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const attendanceDate = typeof date === 'string' && date.trim() ? date.trim() : getLocalDate()
    const normalizedClassName = typeof class_name === 'string' && class_name.trim() ? class_name.trim() : null
    const normalizedSubjectName = typeof subject_name === 'string' && subject_name.trim() ? subject_name.trim() : null
    const createdByUid = typeof body?.created_by_uid === 'string' && body.created_by_uid.trim() ? body.created_by_uid.trim() : 'system'

    const { rows: existingRows } = await pool.query<{ id: string; status: 'present' | 'absent' | 'late' }>(
      `
        select id, status
        from public.attendance_records
        where student_id = $1
          and date = $2
          and (
            ($3::text is null and class_name is null) or class_name = $3
          )
          and (
            ($4::text is null and subject_name is null) or subject_name = $4
          )
        limit 1
      `,
      [student_id, attendanceDate, normalizedClassName, normalizedSubjectName],
    )

    const existing = existingRows[0]

    if (existing) {
      if (existing.status === status) {
        return NextResponse.json({ data: existing, duplicate: true })
      }

      await pool.query(
        `
          update public.attendance_records
          set
            status = $2,
            class_name = $3,
            subject_name = $4,
            detected_confidence = $5,
            timestamp = now(),
            updated_at = now(),
            created_by_uid = $6
          where id = $1
        `,
        [existing.id, status, normalizedClassName, normalizedSubjectName, confidence ?? 0, createdByUid],
      )
      
      // Save to Hadoop in background
      saveToHadoop({ student_id, status, confidence, date: attendanceDate, class_name: normalizedClassName, subject_name: normalizedSubjectName }).catch(console.error);

      return NextResponse.json({
        data: {
          id: existing.id,
          student_id,
          date: attendanceDate,
          status,
          confidence: confidence ?? 0,
          marked_by: createdByUid,
          marked_at: new Date().toISOString(),
        },
        updated: true,
      })
    }

    const { rows } = await pool.query<{ id: string }>(
      `
        insert into public.attendance_records (
          student_id,
          date,
          status,
          class_name,
          subject_name,
          detected_confidence,
          created_by_uid
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `,
      [student_id, attendanceDate, status, normalizedClassName, normalizedSubjectName, confidence ?? 0, createdByUid],
    )

    // Save to Hadoop in background
    saveToHadoop({ student_id, status, confidence, date: attendanceDate, class_name: normalizedClassName, subject_name: normalizedSubjectName }).catch(console.error);

    return NextResponse.json(
      {
        data: {
          id: rows[0].id,
          student_id,
          date: attendanceDate,
          status,
          confidence: confidence ?? 0,
          marked_by: createdByUid,
          marked_at: new Date().toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error marking attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    verifyToken(request)

    const body = await request.json().catch(() => ({}))
    const all = Boolean(body?.all)
    const date = typeof body?.date === 'string' ? body.date : null
    const className = typeof body?.class_name === 'string' ? body.class_name.trim() : null
    const subjectName = typeof body?.subject_name === 'string' ? body.subject_name.trim() : null

    if (all) {
      await pool.query('delete from public.attendance_records')
      return NextResponse.json({ success: true })
    }

    if (!date) {
      return NextResponse.json({ error: 'date is required when all is false' }, { status: 400 })
    }

    await pool.query(
      `
        delete from public.attendance_records
        where date = $1
          and ($2::text is null or class_name = $2)
          and ($3::text is null or subject_name = $3)
      `,
      [date, className, subjectName],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error clearing attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}