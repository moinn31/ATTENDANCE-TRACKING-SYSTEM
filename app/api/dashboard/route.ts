import pool from '@/lib/db.js'
import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'

const getLocalDate = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    verifyToken(request)

    const today = getLocalDate()

    // Run all queries in parallel for speed
    const [todayStats, weeklyTrend, totalStudents, recentRecords] = await Promise.all([
      // Today's attendance breakdown
      pool.query(`
        select
          count(*) filter (where status = 'present') as present_count,
          count(*) filter (where status = 'absent') as absent_count,
          count(*) filter (where status = 'late') as late_count,
          count(*) as total_records,
          round(avg(detected_confidence)::numeric, 1) as avg_confidence
        from public.attendance_records
        where date = $1
      `, [today]),

      // Last 7 days trend
      pool.query(`
        select
          date::text as date,
          count(*) filter (where status = 'present') as present,
          count(*) filter (where status = 'absent') as absent,
          count(*) filter (where status = 'late') as late
        from public.attendance_records
        where date >= (current_date - interval '6 days')
        group by date
        order by date asc
      `),

      // Total registered students
      pool.query('select count(*) as count from public.students'),

      // Last 5 attendance records with student names
      pool.query(`
        select
          ar.id,
          s.name as student_name,
          s.roll_number,
          ar.status,
          ar.detected_confidence as confidence,
          ar.timestamp,
          ar.class_name,
          ar.subject_name
        from public.attendance_records ar
        inner join public.students s on s.id = ar.student_id
        where ar.date = $1
        order by ar.timestamp desc
        limit 8
      `, [today]),
    ])

    const stats = todayStats.rows[0] || {}
    const totalStudentCount = parseInt(totalStudents.rows[0]?.count || '0', 10)
    const presentCount = parseInt(stats.present_count || '0', 10)
    const absentCount = parseInt(stats.absent_count || '0', 10)
    const lateCount = parseInt(stats.late_count || '0', 10)
    const scannedCount = presentCount + absentCount + lateCount
    const attendanceRate = totalStudentCount > 0 
      ? Math.round(((presentCount + lateCount) / totalStudentCount) * 100) 
      : 0

    return NextResponse.json({
      data: {
        today: {
          date: today,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          scanned: scannedCount,
          total_students: totalStudentCount,
          attendance_rate: attendanceRate,
          avg_confidence: parseFloat(stats.avg_confidence || '0'),
        },
        weekly_trend: weeklyTrend.rows.map((row: any) => ({
          date: row.date,
          present: parseInt(row.present, 10),
          absent: parseInt(row.absent, 10),
          late: parseInt(row.late, 10),
        })),
        recent_activity: recentRecords.rows.map((row: any) => ({
          id: row.id,
          student_name: row.student_name,
          roll_number: row.roll_number,
          status: row.status,
          confidence: row.confidence,
          time: row.timestamp,
          class_name: row.class_name,
          subject_name: row.subject_name,
        })),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('[Dashboard API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
