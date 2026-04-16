import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth.js'

export async function POST(request: NextRequest) {
  try {
    verifyToken(request)

    const serviceUrl = process.env.FACE_RECOGNITION_SERVICE_URL

    if (!serviceUrl) {
      return NextResponse.json(
        {
          error: 'FACE_RECOGNITION_SERVICE_URL is not configured',
        },
        { status: 501 },
      )
    }

    const payload = await request.json()

    const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[recognition] proxy error:', error)
    return NextResponse.json({ error: 'Recognition service unavailable' }, { status: 500 })
  }
}
