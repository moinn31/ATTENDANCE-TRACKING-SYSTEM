'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import * as faceapi from 'face-api.js'

interface DetectedStudent {
  id: string
  name: string
  confidence: number
  timestamp: string
}

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([])
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/'
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ])
        setModelsLoaded(true)
      } catch (err) {
        console.error('[v0] Error loading models:', err)
        setError('Failed to load face recognition models')
      }
    }

    loadModels()
  }, [])

  // Check authentication
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [router, supabase.auth])

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err) {
      console.error('[v0] Camera error:', err)
      setError('Failed to access camera. Please check permissions.')
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      setCameraActive(false)
    }
  }

  // Detect faces in video
  const detectFaces = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return

    setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceRecognitions()
          .withFaceExpressions()

        const displaySize = {
          width: videoRef.current.width,
          height: videoRef.current.height,
        }
        faceapi.matchDimensions(canvasRef.current, displaySize)
        const resizedDetections = faceapi.resizeResults(detections, displaySize)

        // Simulate attendance marking
        detections.forEach((detection, index) => {
          const newStudent: DetectedStudent = {
            id: `student-${index}`,
            name: `Student ${index + 1}`,
            confidence: Math.round(detection.detection.score * 100),
            timestamp: new Date().toLocaleTimeString(),
          }

          setDetectedStudents((prev) => {
            const exists = prev.find((s) => s.name === newStudent.name)
            if (!exists) {
              return [...prev, newStudent]
            }
            return prev
          })
        })

        // Draw detections
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections)
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections)
        }
      }
    }, 100)
  }

  // Mark attendance
  const markAttendance = async (student: DetectedStudent) => {
    try {
      // This will be connected to the database when schema is set up
      console.log('[v0] Marking attendance for:', student)
    } catch (err) {
      console.error('[v0] Error marking attendance:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Attendance Scanner</h1>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            {error}
          </div>
        )}

        {!modelsLoaded && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-700">
            Loading face recognition models...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Camera Section */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {cameraActive ? (
                <div className="relative bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full"
                    onPlay={() => modelsLoaded && detectFaces()}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">Camera off. Click start to begin.</p>
                </div>
              )}

              <div className="p-4 flex gap-2">
                {!cameraActive ? (
                  <Button onClick={startCamera} className="flex-1" disabled={!modelsLoaded}>
                    Start Camera
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="destructive" className="flex-1">
                    Stop Camera
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Detected Students */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Detected Students</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {detectedStudents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No students detected yet</p>
              ) : (
                detectedStudents.map((student, index) => (
                  <div key={index} className="p-3 bg-background border border-border rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-foreground">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.timestamp}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{student.confidence}%</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => markAttendance(student)}
                      className="w-full"
                    >
                      Mark Attendance
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
