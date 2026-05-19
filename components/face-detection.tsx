'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as faceapi from 'face-api.js'

interface DetectionResult {
  studentId: string
  name: string
  confidence: number
  timestamp: Date
  embedding?: number[]
}

interface FaceDetectionProps {
  onDetection?: (result: DetectionResult) => void
  onError?: (error: string) => void
  modelsLoaded?: boolean
}

export const useFaceDetection = ({
  onDetection,
  onError,
  modelsLoaded = false,
}: FaceDetectionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraStream(stream)
        setIsRunning(true)
      }
    } catch (error) {
      console.error('[v0] Camera error:', error)
      onError?.('Failed to access camera. Check permissions and ensure HTTPS.')
      setIsRunning(false)
    }
  }, [onError])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
    }
    setIsRunning(false)
  }, [cameraStream])

  // Perform face detection
  const performDetection = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return

    try {
      const video = videoRef.current
      const canvas = canvasRef.current

      // Detect faces
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withFaceExpressions()

      if (!detections || detections.length === 0) {
        return
      }

      // Setup canvas
      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      }
      faceapi.matchDimensions(canvas, displaySize)
      const resizedDetections = faceapi.resizeResults(detections, displaySize)

      // Draw detections on canvas
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        resizedDetections.forEach((det) => {
          const box = det.detection.box
          const BOX_PADDING = 4
          const bx = box.x - BOX_PADDING
          const by = box.y - BOX_PADDING
          const bw = box.width + BOX_PADDING * 2
          const bh = box.height + BOX_PADDING * 2

          // Green glow box
          ctx.save()
          ctx.shadowColor = 'rgba(34, 197, 94, 0.8)'
          ctx.shadowBlur = 18
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 3
          ctx.strokeRect(bx, by, bw, bh)
          ctx.restore()

          // Corner accents
          const cLen = Math.min(28, bw * 0.22)
          ctx.strokeStyle = '#4ade80'
          ctx.lineWidth = 4
          ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(bx, by + cLen); ctx.lineTo(bx, by); ctx.lineTo(bx + cLen, by); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(bx + bw - cLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cLen); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(bx, by + bh - cLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cLen, by + bh); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(bx + bw - cLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cLen); ctx.stroke()

          // "Face Detected" badge
          const label = 'Face Detected'
          ctx.font = 'bold 16px system-ui, sans-serif'
          const labelWidth = ctx.measureText(label).width
          const badgeW = labelWidth + 24
          const badgeH = 32
          const badgeX = bx
          const badgeY = by - badgeH - 6

          // Pill background
          ctx.save()
          ctx.shadowColor = 'rgba(34, 197, 94, 0.5)'
          ctx.shadowBlur = 12
          ctx.fillStyle = 'rgba(21, 128, 61, 0.92)'
          const r = 10
          ctx.beginPath()
          ctx.moveTo(badgeX + r, badgeY)
          ctx.lineTo(badgeX + badgeW - r, badgeY)
          ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r)
          ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r)
          ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH)
          ctx.lineTo(badgeX + r, badgeY + badgeH)
          ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r)
          ctx.lineTo(badgeX, badgeY + r)
          ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY)
          ctx.closePath()
          ctx.fill()
          ctx.restore()

          // Text
          ctx.fillStyle = '#ffffff'
          ctx.fillText(label, badgeX + 12, badgeY + 21)
        })
      }

      // Process each detected face
      detections.forEach((detection, index) => {
        const confidence = Math.round(detection.detection.score * 100)
        const embedding = detection.descriptor
          ? Array.from(detection.descriptor).slice(0, 128)
          : undefined

        // Emit detection result
        onDetection?.({
          studentId: `detection-${index}`,
          name: `Face ${index + 1}`,
          confidence,
          timestamp: new Date(),
          embedding,
        })
      })
    } catch (error) {
      console.error('[v0] Detection error:', error)
      onError?.('Face detection failed. Try adjusting lighting.')
    }
  }, [modelsLoaded, onDetection, onError])

  // Start detection loop
  const startDetection = useCallback(async () => {
    if (!modelsLoaded) {
      onError?.('Face models not loaded yet')
      return
    }

    await startCamera()

    // Start continuous detection
    detectionIntervalRef.current = setInterval(performDetection, 100)
  }, [modelsLoaded, startCamera, performDetection, onError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    canvasRef,
    isRunning,
    startDetection,
    stopCamera,
  }
}

// Canvas overlay component
export function FaceDetectionOverlay({ videoRef, canvasRef }: any) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'scaleX(-1)' }}
      />
    </div>
  )
}

// Component to load face-api models
export async function loadFaceModels(): Promise<boolean> {
  try {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/'

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ])

    return true
  } catch (error) {
    console.error('[v0] Error loading face models:', error)
    return false
  }
}
