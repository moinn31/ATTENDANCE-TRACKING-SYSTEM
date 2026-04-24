import pool from '@/lib/db.js'
import { verifyToken } from '@/lib/auth.js'
import { NextRequest, NextResponse } from 'next/server'

type StudentRow = {
  id: string
  name: string
  roll_number?: string | null
}

type FaceEmbeddingRow = {
  student_id: string
  embedding_vector: unknown
  created_at?: string | null
}

type PgErrorLike = {
  code?: string
  message?: string
}

const isPgErrorLike = (value: unknown): value is PgErrorLike => {
  return typeof value === 'object' && value !== null
}

const normalizeEmbeddingVector = (rawValue: unknown): number[] | null => {
  if (rawValue == null) return null

  const toNumericArray = (value: unknown): number[] => {
    if (Array.isArray(value)) {
      return value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    }

    // Handle Buffer (Postgres bytea returns Buffer)
    if (Buffer.isBuffer(value)) {
      try {
        const str = value.toString('utf8')
        const parsed = JSON.parse(str)
        return toNumericArray(parsed)
      } catch {
        return []
      }
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return toNumericArray(parsed)
      } catch {
        return []
      }
    }

    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([key]) => /^\d+$/.test(key))
        .sort((left, right) => Number(left[0]) - Number(right[0]))

      if (entries.length > 0) {
        return entries
          .map(([, entryValue]) => Number(entryValue))
          .filter((entryValue) => Number.isFinite(entryValue))
      }
    }

    return []
  }

  const normalized = toNumericArray(rawValue)
  return normalized.length > 0 ? normalized : null
}

export async function GET(request: NextRequest) {
  try {
    verifyToken(request)

    const { searchParams } = new URL(request.url)
    const includeEmbeddings = searchParams.get('includeEmbeddings') === 'true'

    if (!includeEmbeddings) {
      // Fast path for Students page: count enrollments without fetching vectors
      const result = await (pool as any).query(`
        select 
          s.id, s.name, s.roll_number,
          exists(select 1 from public.face_embeddings f where f.student_id = s.id) as face_enrolled
        from public.students s
        order by s.created_at desc
      `)
      return NextResponse.json({ data: result.rows })
    }

    // Fetches students joined with their latest embedding vector (if any)
    const result = await (pool as any).query(`
      select 
        s.id, s.name, s.roll_number,
        f.embedding_vector
      from public.students s
      left join (
        select distinct on (student_id) student_id, embedding_vector
        from public.face_embeddings
        order by student_id, created_at desc
      ) f on s.id = f.student_id
      order by s.created_at desc
    `)

    const students = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      roll_number: row.roll_number ?? null,
      face_enrolled: Boolean(row.embedding_vector),
      embedding_vector: normalizeEmbeddingVector(row.embedding_vector),
    }))

    return NextResponse.json({ data: students })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error fetching students:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    verifyToken(request)

    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const rollNumber = typeof body?.roll_number === 'string' ? body.roll_number.trim() : ''

    if (!name || !rollNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { rows } = await (pool as any).query(
      `
        insert into public.students (name, roll_number)
        values ($1, $2)
        returning id, name, roll_number
      `,
      [name, rollNumber],
    )

    const row = rows[0] as any
    const newStudent = {
      id: row.id,
      name: row.name,
      roll_number: row.roll_number ?? null,
      face_enrolled: false,
    }

    return NextResponse.json({ data: newStudent }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[v0] Error creating student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
