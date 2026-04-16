'use client'

import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { Button } from '@/components/ui/button'

interface FaceEnrollmentModalProps {
  studentId: string
  studentName: string
  onEnrollmentComplete: (faceData: any) => Promise<void> | void
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
  const [guidanceMessage, setGuidanceMessage] = useState<string>('Keep your face centered and look straight at the camera.')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const finishingRef = useRef(false)

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

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
      }

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
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
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        setError('Unable to initialize camera preview. Please reopen enrollment.')
        return
      }

      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraActive(true)
      setError(null)
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
      videoRef.current.srcObject = null
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
    finishingRef.current = false
    setGuidanceMessage('Hold still. We are collecting 5 high-quality face samples.')
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
          .withFaceDescriptors()
          .withFaceExpressions()

        frameCount++
        console.log(`[v0] Frame ${frameCount} - Detected ${detections.length} faces`)

        if (detections.length === 0) {
          setError('Face not visible. Please center your face in the frame.')
          setGuidanceMessage('No face detected. Clean your lens and look directly at the camera.')
          return
        }

        if (detections.length > 1) {
          setError('Multiple faces detected. Only one person should be in frame.')
          setGuidanceMessage('Only one person should be visible. Ask others to move out of frame.')
          return
        }

        const detection = detections[0]
        const confidence = detection.detection.score
        const box = detection.detection.box
        const frameArea = videoRef.current.videoWidth * videoRef.current.videoHeight
        const faceArea = box.width * box.height
        const ratio = frameArea > 0 ? faceArea / frameArea : 0
        const centerX = box.x + box.width / 2
        const centerY = box.y + box.height / 2
        const offsetX = Math.abs(centerX - videoRef.current.videoWidth / 2)
        const offsetY = Math.abs(centerY - videoRef.current.videoHeight / 2)
        const leftEye = detection.landmarks.getLeftEye()
        const rightEye = detection.landmarks.getRightEye()
        const leftEyeY = leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length
        const rightEyeY = rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length
        const tilt = Math.abs(leftEyeY - rightEyeY)
        console.log(`[v0] Face detected with confidence: ${confidence}`)

        if (ratio < 0.1) {
          setError('Face is too far. Please move closer to camera.')
          setGuidanceMessage('Move closer. Your face should fill more of the frame.')
          return
        }

        if (ratio > 0.58) {
          setError('Face is too close. Please move back a little.')
          setGuidanceMessage('Move slightly back so your full face is visible.')
          return
        }

        if (offsetX > videoRef.current.videoWidth * 0.2 || offsetY > videoRef.current.videoHeight * 0.2) {
          setError('Face is off-center. Please stay in the middle.')
          setGuidanceMessage('Center your face in the camera for faster capture.')
          return
        }

        if (tilt > 12) {
          setError('Head tilt detected. Please keep your face straight.')
          setGuidanceMessage('Keep your head straight and remove cap/face cover if possible.')
          return
        }

        if (confidence < 0.7) {
          setError(`Low quality detection (${(confidence * 100).toFixed(1)}%). Improve light or clean lens.`)
          setGuidanceMessage('Face not clear. Clean lens, remove cap, and look straight.')
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
          return newFrames
        })

        setError(null)
        setGuidanceMessage('Great. Hold still while we capture remaining samples.')

        // Draw detection on canvas
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        }
        canvasRef.current.width = displaySize.width
        canvasRef.current.height = displaySize.height
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

  useEffect(() => {
    if (!capturing || capturedFrames.length < 5 || finishingRef.current) {
      return
    }

    finishingRef.current = true
    setGuidanceMessage('Processing face samples...')
    void completeEnrollment(capturedFrames)
  }, [capturing, capturedFrames])

  // Complete enrollment with captured frames
  const completeEnrollment = async (frames: any[]) => {
    try {
      console.log('[face-enrollment] Starting enrollment completion with', frames.length, 'frames')
      setCapturing(false)
      setGuidanceMessage('Processing and saving face data...')
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
        detectionIntervalRef.current = null
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

      console.log('[face-enrollment] Face enrollment data prepared:', {
        studentId,
        frameCount: frames.length,
        avgScore: avgScore.toFixed(3),
      })

      console.log('[face-enrollment] Sending enrollment data to parent component')
      await onEnrollmentComplete(enrollmentData)
      
      console.log('[face-enrollment] Enrollment complete callback finished successfully')

      // Stop camera before showing success
      stopCamera()
      setSuccess(true)
    } catch (err) {
      console.error('[face-enrollment] Error completing enrollment:', err)
      setError('Error saving face data. Please try again.')
      finishingRef.current = false
      setCapturing(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-8 shadow-2xl">
          <p className="text-center text-sm font-semibold text-slate-700">Loading face recognition models...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
            <h2 className="mb-2 text-2xl font-semibold text-slate-800">Face Enrollment Complete</h2>
            <p className="mb-6 text-sm text-slate-600">Face data for {studentName} has been successfully saved.</p>
            <Button onClick={onCancel} className="w-full rounded-xl bg-[#2b5c9e] hover:bg-[#254f87]">
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#2b5c9e] to-[#3f78bf] px-6 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Face Enrollment</p>
            <h2 className="mt-1 text-2xl font-semibold">Enroll Face - {studentName}</h2>
          </div>
          <button onClick={onCancel} className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white" aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="p-6">
            <p className="mb-4 text-sm text-slate-600">
              Position your face in the camera frame. We&apos;ll capture 5 images for better recognition accuracy.
            </p>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!modelsLoaded && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Loading models... please wait
              </div>
            )}

            <div className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950" style={{ aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 h-full w-full ${cameraActive ? 'block' : 'hidden'}`}
              />
              {!cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/75 backdrop-blur">
                    Camera off
                  </div>
                </div>
              )}

              {capturing && (
                <div className="absolute inset-0 flex flex-col items-center justify-between p-4 pointer-events-none">
                  <div className="w-full max-w-sm rounded-2xl bg-slate-950/80 p-4 text-center text-white shadow-xl backdrop-blur">
                    <p className="mb-2 text-lg font-semibold">Face Recognition in Progress</p>
                    <p className="text-sm text-emerald-300">Frames captured: {capturedFrames.length} / 5</p>
                    <p className="mt-2 text-xs text-amber-200">{guidanceMessage}</p>
                  </div>
                  <div className="w-full max-w-sm rounded-2xl bg-slate-950/80 p-4 shadow-xl backdrop-blur">
                    <div className="flex gap-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-3 flex-1 rounded-full transition-all ${
                            i < capturedFrames.length ? 'bg-green-500 scale-105' : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-center text-xs text-white/80">
                      {capturedFrames.length === 5 ? 'Processing...' : 'Hold still...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/80 p-6 lg:border-t-0 lg:border-l">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Guidance</p>
                <p className="mt-2 text-sm text-slate-600">Keep your face centered, well lit, and look directly into the camera for five samples.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Capture Status</p>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-3 rounded-full ${i < capturedFrames.length ? 'bg-[#2b5c9e]' : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{capturedFrames.length} of 5 samples captured</p>
              </div>

              {!cameraActive ? (
                <Button onClick={startCamera} className="w-full rounded-xl bg-[#2b5c9e] hover:bg-[#254f87]" disabled={!modelsLoaded}>
                  Start Camera
                </Button>
              ) : !capturing ? (
                <div className="space-y-3">
                  <Button onClick={startCapturing} className="w-full rounded-xl bg-[#2b5c9e] hover:bg-[#254f87]" disabled={!modelsLoaded}>
                    Start Face Capture
                  </Button>
                  <Button onClick={stopCamera} variant="outline" className="w-full rounded-xl border-slate-200 bg-white">
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button onClick={stopCamera} variant="destructive" className="w-full rounded-xl">
                  Stop Capture
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
