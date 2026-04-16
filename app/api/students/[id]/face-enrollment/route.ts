import pool from '@/lib/db.js'
import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    verifyToken(request)

    const { id: studentId } = await context.params
    const body = await request.json()
    const descriptor = body?.descriptor

    if (!studentId || !Array.isArray(descriptor) || descriptor.length === 0) {
      return NextResponse.json({ error: 'Invalid enrollment payload' }, { status: 400 })
    }

    const serialized = JSON.stringify(descriptor)

    await pool.query(
      `
        delete from public.face_embeddings
        where student_id = $1
      `,
      [studentId],
    )

    await pool.query(
      `
        insert into public.face_embeddings (student_id, embedding_vector)
        values ($1, $2)
      `,
      [studentId, serialized],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error saving face enrollment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
