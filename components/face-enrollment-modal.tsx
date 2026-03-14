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
      console.log('[v0] Starting enrollment completion with', frames.length, 'frames')
      setCapturing(false)
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

      console.log('[v0] Face enrollment data prepared:', {
        studentId,
        frameCount: frames.length,
        avgScore: avgScore.toFixed(3),
      })

      await onEnrollmentComplete(enrollmentData)

      // Stop camera before showing success
      stopCamera()
      setSuccess(true)
    } catch (err) {
      console.error('[v0] Error completing enrollment:', err)
      setError('Error saving face data. Please try again.')
      finishingRef.current = false
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${cameraActive ? 'block' : 'hidden'}`}
            />
            {!cameraActive && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                <p className="text-muted-foreground">Camera off</p>
              </div>
            )}

            {capturing && (
              <div className="absolute inset-0 flex flex-col items-center justify-between p-4 pointer-events-none">
                <div className="bg-black/80 rounded-lg p-4 text-center">
                  <p className="text-white text-lg font-bold mb-2">Face Recognition in Progress</p>
                  <p className="text-green-400 text-sm">Frames captured: {capturedFrames.length} / 5</p>
                  <p className="text-yellow-300 text-xs mt-2">{guidanceMessage}</p>
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
