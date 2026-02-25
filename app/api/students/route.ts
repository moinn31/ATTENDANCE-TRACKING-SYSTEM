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

    // Get students - would query from database when schema is set up
    // For now, return mock data
    const students = [
      { id: '1', name: 'John Doe', email: 'john@example.com', enrollment_number: 'E001', face_enrolled: true },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com', enrollment_number: 'E002', face_enrolled: true },
    ]

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
    const { name, email, enrollment_number } = body

    if (!name || !email || !enrollment_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Would insert into database when schema is set up
    const newStudent = {
      id: Date.now().toString(),
      name,
      email,
      enrollment_number,
      face_enrolled: false,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({ data: newStudent }, { status: 201 })
  } catch (error) {
    console.error('[v0] Error creating student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
