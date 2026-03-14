import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: studentId } = await context.params
    const body = await request.json()
    const descriptor = body?.descriptor

    if (!studentId || !Array.isArray(descriptor) || descriptor.length === 0) {
      return NextResponse.json({ error: 'Invalid enrollment payload' }, { status: 400 })
    }

    const serialized = JSON.stringify(descriptor)

    const { error: deleteOldError } = await supabase
      .from('face_embeddings')
      .delete()
      .eq('student_id', studentId)

    if (deleteOldError) {
      return NextResponse.json({ error: deleteOldError.message }, { status: 500 })
    }

    const { error: insertError } = await supabase.from('face_embeddings').insert({
      student_id: studentId,
      embedding_vector: serialized,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error saving face enrollment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
