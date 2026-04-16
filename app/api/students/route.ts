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
  embedding_vector: string
  created_at?: string | null
}

export async function GET(request: NextRequest) {
  try {
    verifyToken(request)

    const { searchParams } = new URL(request.url)
    const includeEmbeddings = searchParams.get('includeEmbeddings') === 'true'

    // Always fetch embeddings to calculate face_enrolled status
    const [studentsResult, embeddingsResult] = await Promise.all([
      pool.query(
        `
          select
            id,
            name,
            roll_number,
            created_at
          from public.students
          order by created_at desc
        `,
      ),
      pool.query(
        `
          select
            student_id,
            embedding_vector,
            created_at
          from public.face_embeddings
          order by created_at desc
        `,
      ),
    ])

    const rows = studentsResult.rows as StudentRow[]
    const embeddingRows = embeddingsResult.rows as FaceEmbeddingRow[]

    const latestByStudent = new Map<string, FaceEmbeddingRow>()
    for (const embedding of embeddingRows) {
      if (!latestByStudent.has(embedding.student_id)) {
        latestByStudent.set(embedding.student_id, embedding)
      }
    }

    const students = rows.map((row) => {
      const latestEmbedding = latestByStudent.get(row.id)
      const rollNumber = row.roll_number ?? null

      return {
        id: row.id,
        name: row.name,
        roll_number: rollNumber,
        face_enrolled: Boolean(latestEmbedding),
        embedding_vector: includeEmbeddings ? latestEmbedding?.embedding_vector ?? null : undefined,
      }
    })

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

    const { rows } = await pool.query<StudentRow>(
      `
        insert into public.students (name, roll_number)
        values ($1, $2)
        returning id, name, roll_number
      `,
      [name, rollNumber],
    )

    const row = rows[0]
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
