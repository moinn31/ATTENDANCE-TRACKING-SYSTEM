import pool from '@/lib/db.js'
import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    verifyToken(request)

    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: 'Missing student id' }, { status: 400 })
    }

    await pool.query(
      `
        delete from public.students
        where id = $1
      `,
      [id],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error deleting student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
