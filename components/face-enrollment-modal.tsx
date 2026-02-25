'use client'

import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { Button } from '@/components/ui/button'

interface FaceEnrollmentModalProps {
  studentId: string
  studentName: string
  onEnrollmentComplete: (faceData: any) => void
  onCancel: () => void
}

export default function FaceEnrollmentModal({
  studentId,
  studentName,
  onEnrollmentComplete,
  onCancel,
}: FaceEnrollmentModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [capturedFrames, setCapturedFrames] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
        setLoading(false)
      } catch (err) {
        console.error('[v0] Error loading models:', err)
        setError('Failed to load face recognition models')
        setLoading(false)
      }
    }

    loadModels()
  }, [])

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
        setError(null)
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
      setCapturing(false)
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
      }
    }
  }

  // Start capturing face frames
  const startCapturing = async () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current) return

    console.log('[v0] Starting face capture process...')
    setCapturing(true)
    setCapturedFrames([])
    setError(null)
    let frameCount = 0

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) {
        console.log('[v0] Video or canvas ref not available')
        return
      }

      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceRecognitions()
          .withFaceExpressions()

        frameCount++
        console.log(`[v0] Frame ${frameCount} - Detected ${detections.length} faces`)

        if (detections.length === 0) {
          setError('No face detected. Please position your face in the frame.')
          return
        }

        if (detections.length > 1) {
          setError('Multiple faces detected. Only one person should be in frame.')
          return
        }

        const detection = detections[0]
        const confidence = detection.detection.score
        console.log(`[v0] Face detected with confidence: ${confidence}`)

        if (confidence < 0.7) {
          setError(`Low quality detection (${(confidence * 100).toFixed(1)}%). Please ensure good lighting.`)
          return
        }

        // Capture frame with face descriptor
        const faceData = {
          descriptor: detection.descriptor,
          detection: {
            score: confidence,
            box: detection.detection.box,
          },
          landmarks: detection.landmarks,
          expressions: detection.expressions,
          timestamp: new Date().toISOString(),
        }

        setCapturedFrames((prev) => {
          const newFrames = [...prev, faceData]
          console.log(`[v0] Frame captured - Total frames: ${newFrames.length}/5`)
          
          // Stop after 5 successful captures
          if (newFrames.length >= 5) {
            console.log('[v0] All 5 frames captured! Completing enrollment...')
            completeEnrollment(newFrames)
          }
          return newFrames
        })

        setError(null)

        // Draw detection on canvas
        const displaySize = {
          width: videoRef.current.width,
          height: videoRef.current.height,
        }
        faceapi.matchDimensions(canvasRef.current, displaySize)
        const resizedDetections = faceapi.resizeResults(detections, displaySize)

        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections)
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections)
        }
      } catch (err) {
        console.error('[v0] Detection error:', err)
        setError('Error processing face. Please try again.')
      }
    }, 300)  // Check every 300ms for faster captures
  }

  // Complete enrollment with captured frames
  const completeEnrollment = async (frames: any[]) => {
    try {
      console.log('[v0] Starting enrollment completion with', frames.length, 'frames')
      setCapturing(false)
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
      }

      // Average the descriptors from all frames
      const descriptors = frames.map((f) => f.descriptor)
      const avgDescriptor = new Float32Array(descriptors[0].length)

      for (let i = 0; i < descriptors[0].length; i++) {
        let sum = 0
        for (const descriptor of descriptors) {
          sum += descriptor[i]
        }
        avgDescriptor[i] = sum / descriptors.length
      }

      const avgScore = frames.reduce((sum, f) => sum + f.detection.score, 0) / frames.length
      
      const enrollmentData = {
        studentId,
        descriptor: Array.from(avgDescriptor),
        frameCount: frames.length,
        timestamp: new Date().toISOString(),
        metadata: {
          avgScore: avgScore,
          frameScores: frames.map((f) => f.detection.score),
        },
      }

      console.log('[v0] Face enrollment data prepared:', {
        studentId,
        frameCount: frames.length,
        avgScore: avgScore.toFixed(3),
      })

      // Stop camera before showing success
      stopCamera()
      
      setSuccess(true)
      onEnrollmentComplete(enrollmentData)
    } catch (err) {
      console.error('[v0] Error completing enrollment:', err)
      setError('Error saving face data. Please try again.')
      setCapturing(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-8 max-w-md w-full mx-4">
          <p className="text-foreground text-center">Loading face recognition models...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Face Enrollment Complete</h2>
            <p className="text-muted-foreground mb-6">Face data for {studentName} has been successfully saved.</p>
            <Button onClick={onCancel} className="w-full">
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Enroll Face - {studentName}</h2>
          <p className="text-muted-foreground mb-6">
            Position your face in the camera frame. We'll capture 5 images for better recognition accuracy.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
              {error}
            </div>
          )}

          {!modelsLoaded && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-700 text-sm">
              Loading models... please wait
            </div>
          )}

          <div className="relative bg-black rounded-lg overflow-hidden mb-6" style={{ aspectRatio: '4/3' }}>
            {cameraActive && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
              </>
            )}
            {!cameraActive && (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-muted-foreground">Camera off</p>
              </div>
            )}

            {capturing && (
              <div className="absolute inset-0 flex flex-col items-center justify-between p-4 pointer-events-none">
                <div className="bg-black/80 rounded-lg p-4 text-center">
                  <p className="text-white text-lg font-bold mb-2">Face Recognition in Progress</p>
                  <p className="text-green-400 text-sm">Frames captured: {capturedFrames.length} / 5</p>
                </div>
                <div className="bg-black/80 rounded-lg p-4 w-full max-w-xs">
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-3 flex-1 rounded-full transition-all ${
                          i < capturedFrames.length
                            ? 'bg-green-500 scale-105'
                            : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-white text-xs text-center mt-2">
                    {capturedFrames.length === 5 ? '✓ Processing...' : 'Hold still...'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {!cameraActive ? (
              <Button onClick={startCamera} className="w-full" disabled={!modelsLoaded}>
                Start Camera
              </Button>
            ) : !capturing ? (
              <>
                <Button onClick={startCapturing} className="w-full" disabled={!modelsLoaded}>
                  Start Face Capture
                </Button>
                <Button onClick={stopCamera} variant="outline" className="w-full">
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={stopCamera} variant="destructive" className="w-full">
                Stop Capture
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
