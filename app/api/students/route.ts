import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type StudentRow = {
  id: string
  name: string
  roll_number?: string | null
  enrollment_number?: string | null
}

type FaceEmbeddingRow = {
  student_id: string
  embedding_vector: string
  created_at?: string | null
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
    const includeEmbeddings = searchParams.get('includeEmbeddings') === 'true'

    const { data: studentRows, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 })
    }

    const rows = (studentRows ?? []) as StudentRow[]

    const { data: embeddingRows, error: embeddingsError } = await supabase
      .from('face_embeddings')
      .select('student_id, embedding_vector, created_at')
      .order('created_at', { ascending: false })

    if (embeddingsError) {
      return NextResponse.json({ error: embeddingsError.message }, { status: 500 })
    }

    const latestByStudent = new Map<string, FaceEmbeddingRow>()
    for (const embedding of (embeddingRows ?? []) as FaceEmbeddingRow[]) {
      if (!latestByStudent.has(embedding.student_id)) {
        latestByStudent.set(embedding.student_id, embedding)
      }
    }

    const students = rows.map((row) => {
      const latestEmbedding = latestByStudent.get(row.id)
      const rollNumber = row.roll_number ?? row.enrollment_number ?? null

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
    console.error('[v0] Error fetching students:', error)
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
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const rollNumber = typeof body?.roll_number === 'string' ? body.roll_number.trim() : ''

    if (!name || !rollNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: createdStudent, error: createError } = await supabase
      .from('students')
      .insert({
        name,
        roll_number: rollNumber,
      })
      .select('*')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const row = createdStudent as StudentRow
    const newStudent = {
      id: row.id,
      name: row.name,
      roll_number: row.roll_number ?? row.enrollment_number ?? null,
      face_enrolled: false,
    }

    return NextResponse.json({ data: newStudent }, { status: 201 })
  } catch (error) {
    console.error('[v0] Error creating student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
