import pool from '@/lib/db.js'
import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    verifyToken(req)

    // Run all queries in parallel for speed
    const [
      overviewResult,
      dailyResult,
      studentResult,
      confidenceResult,
      recentResult
    ] = await Promise.all([
      // Overview stats: total records, total students, overall attendance rate
      pool.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT student_id) as total_students,
          COUNT(*) FILTER (WHERE status = 'present') as total_present,
          COUNT(*) FILTER (WHERE status = 'absent') as total_absent,
          COUNT(*) FILTER (WHERE status = 'late') as total_late,
          ROUND(AVG(detected_confidence)::numeric, 1) as avg_confidence,
          COUNT(DISTINCT date) as total_days
        FROM public.attendance_records
      `),

      // Daily breakdown for the last 14 days
      pool.query(`
        SELECT 
          date::text as date,
          COUNT(*) FILTER (WHERE status = 'present') as present,
          COUNT(*) FILTER (WHERE status = 'absent') as absent,
          COUNT(*) FILTER (WHERE status = 'late') as late,
          COUNT(*) as total
        FROM public.attendance_records
        WHERE date >= (current_date - interval '14 days')
        GROUP BY date
        ORDER BY date ASC
      `),

      // Per-student metrics
      pool.query(`
        SELECT 
          s.name as student_name,
          s.roll_number,
          COUNT(ar.id) as total_records,
          COUNT(*) FILTER (WHERE ar.status = 'present') as present_count,
          COUNT(*) FILTER (WHERE ar.status = 'absent') as absent_count,
          ROUND(AVG(ar.detected_confidence)::numeric, 1) as avg_confidence,
          CASE WHEN COUNT(ar.id) > 0 THEN
            ROUND(
              (COUNT(*) FILTER (WHERE ar.status = 'present'))::numeric / COUNT(ar.id) * 100, 1
            )
          ELSE 0
          END as attendance_pct
        FROM public.students s
        LEFT JOIN public.attendance_records ar ON s.id = ar.student_id
        GROUP BY s.id, s.name, s.roll_number
        ORDER BY s.name ASC
      `),

      // Confidence distribution
      pool.query(`
        SELECT 
          CASE 
            WHEN detected_confidence >= 95 THEN '95-100%'
            WHEN detected_confidence >= 85 THEN '85-94%'
            WHEN detected_confidence >= 70 THEN '70-84%'
            ELSE 'Below 70%'
          END as bucket,
          COUNT(*) as count
        FROM public.attendance_records
        WHERE detected_confidence IS NOT NULL AND detected_confidence > 0
        GROUP BY bucket
        ORDER BY bucket DESC
      `),

      // Most recent 20 records
      pool.query(`
        SELECT 
          ar.id, s.name as student_name, s.roll_number, ar.status, 
          ar.detected_confidence as confidence, ar.timestamp as check_in_time,
          ar.class_name, ar.subject_name
        FROM public.attendance_records ar
        JOIN public.students s ON ar.student_id = s.id
        ORDER BY ar.timestamp DESC
        LIMIT 20
      `)
    ])

    const overview = overviewResult.rows[0]
    const totalRecords = parseInt(overview.total_records) || 0
    const totalPresent = parseInt(overview.total_present) || 0
    const attendanceRate = totalRecords > 0 
      ? Math.round((totalPresent / totalRecords) * 100 * 10) / 10 
      : 0

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total_records: totalRecords,
          total_students: parseInt(overview.total_students) || 0,
          total_present: totalPresent,
          total_absent: parseInt(overview.total_absent) || 0,
          total_late: parseInt(overview.total_late) || 0,
          avg_confidence: parseFloat(overview.avg_confidence) || 0,
          total_days: parseInt(overview.total_days) || 0,
          attendance_rate: attendanceRate,
        },
        daily_trend: dailyResult.rows.map((r: any) => ({
          date: r.date,
          present: parseInt(r.present),
          absent: parseInt(r.absent),
          late: parseInt(r.late),
          total: parseInt(r.total),
        })),
        students: studentResult.rows.map((r: any) => ({
          name: r.student_name,
          roll_number: r.roll_number,
          total: parseInt(r.total_records),
          present: parseInt(r.present_count),
          absent: parseInt(r.absent_count),
          confidence: parseFloat(r.avg_confidence) || 0,
          attendance_pct: parseFloat(r.attendance_pct) || 0,
        })),
        confidence_dist: confidenceResult.rows.map((r: any) => ({
          bucket: r.bucket,
          count: parseInt(r.count),
        })),
        recent: recentResult.rows.map((r: any) => ({
          id: r.id,
          student_name: r.student_name,
          roll_number: r.roll_number,
          status: r.status,
          confidence: r.confidence,
          time: r.check_in_time,
          class_name: r.class_name,
          subject_name: r.subject_name,
        })),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Reports API error:', error)
    return NextResponse.json(
      { error: 'Failed to load reports' },
      { status: 500 }
    )
  }
}
