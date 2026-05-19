'use client'

import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { Button } from '@/components/ui/button'

// Number of high-quality samples to capture before finalizing enrollment.
// More samples = more robust averaged descriptor.
const ENROLLMENT_SAMPLE_COUNT = 7
const ENROLLMENT_MIN_CONFIDENCE = 0.80
const MIN_FACE_AREA = 12000 // Recommended value for controlled distance

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
  // SSD MobileNet v1 is used for enrollment instead of TinyFaceDetector because:
  //  - Enrollment is a one-time operation, so speed doesn't matter
  //  - SSD is significantly more accurate at detecting faces
  //  - Better detection → better face alignment → better descriptor quality
  // faceExpressionNet is NOT loaded — it was never used for matching.
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/'
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        setModelsLoaded(true)
        setLoading(false)
      } catch (err) {
        console.error('[enrollment] Error loading models:', err)
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
      console.error('[enrollment] Camera error:', err)
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

    console.log('[enrollment] Starting face capture process...')
    setCapturing(true)
    setCapturedFrames([])
    finishingRef.current = false
    setGuidanceMessage(`Hold still. We are collecting ${ENROLLMENT_SAMPLE_COUNT} high-quality face samples.`)
    setError(null)
    let frameCount = 0

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) {
        console.log('[enrollment] Video or canvas ref not available')
        return
      }

      try {
        // Use SSD MobileNet v1 for higher accuracy during enrollment.
        // minConfidence is set high to ensure only high-quality detections are captured.
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({
            minConfidence: ENROLLMENT_MIN_CONFIDENCE,
          }))
          .withFaceLandmarks()
          .withFaceDescriptors()

        frameCount++
        console.log(`[enrollment] Frame ${frameCount} - Detected ${detections.length} faces`)

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
        
        // Computed face area (width * height) as requested
        const faceArea = Math.round(box.width * box.height)
        const frameArea = videoRef.current.videoWidth * videoRef.current.videoHeight
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

        // Debug logging for developers
        console.log(`[enrollment] Face detection stats: area=${faceArea}, confidence=${confidence.toFixed(3)}, ratio=${ratio.toFixed(3)}`)

        // Distance check (Face Area filter)
        if (faceArea < MIN_FACE_AREA) {
          console.log(`[enrollment] Decision: REJECTED, Reason: Too small (area=${faceArea} < ${MIN_FACE_AREA})`)
          setError('Too Far – Move Closer')
          setGuidanceMessage('Please come closer to the camera to ensure high quality biometric capture.')
          return
        }

        if (ratio > 0.65) {
          console.log(`[enrollment] Decision: REJECTED, Reason: Too close (ratio=${ratio.toFixed(3)})`)
          setError('Too Close – Move Back')
          setGuidanceMessage('Move slightly back so your full face is visible.')
          return
        }

        if (offsetX > videoRef.current.videoWidth * 0.25 || offsetY > videoRef.current.videoHeight * 0.25) {
          console.log(`[enrollment] Decision: REJECTED, Reason: Off-center`)
          setError('Face Off-Center')
          setGuidanceMessage('Center your face in the camera frame.')
          return
        }

        if (tilt > 15) {
          console.log(`[enrollment] Decision: REJECTED, Reason: Head tilt (${tilt.toFixed(1)}deg)`)
          setError('Keep Head Straight')
          setGuidanceMessage('Keep your head straight and look directly at the camera.')
          return
        }

        if (confidence < ENROLLMENT_MIN_CONFIDENCE) {
          console.log(`[enrollment] Decision: REJECTED, Reason: Low confidence (${confidence.toFixed(3)})`)
          setError(`Low Visibility (${(confidence * 100).toFixed(0)}%)`)
          setGuidanceMessage('Face not clearly visible. Improve lighting or clean your camera lens.')
          return
        }

        console.log(`[enrollment] Decision: ACCEPTED, Reason: Valid face at optimal distance (area=${faceArea})`)


        // Validate descriptor is not corrupted (NaN or zero-vector)
        const descriptor = detection.descriptor
        let hasNaN = false
        let sumSq = 0
        for (let i = 0; i < descriptor.length; i++) {
          if (!Number.isFinite(descriptor[i])) {
            hasNaN = true
            break
          }
          sumSq += descriptor[i] * descriptor[i]
        }
        if (hasNaN || sumSq < 0.001) {
          console.warn('[enrollment] Skipping frame: descriptor is corrupted (NaN or zero-vector)')
          setError('Detection quality too low. Adjust lighting and try again.')
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
          timestamp: new Date().toISOString(),
        }

        setCapturedFrames((prev) => {
          const newFrames = [...prev, faceData]
          console.log(`[enrollment] Frame captured - Total frames: ${newFrames.length}/${ENROLLMENT_SAMPLE_COUNT}`)
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

            // "Enrolling Face..." badge
            const label = 'Enrolling Face...'
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
      } catch (err) {
        console.error('[enrollment] Detection error:', err)
        setError('Error processing face. Please try again.')
      }
    }, 350)  // Slightly slower interval for more stable SSD detection
  }

  useEffect(() => {
    if (!capturing || capturedFrames.length < ENROLLMENT_SAMPLE_COUNT || finishingRef.current) {
      return
    }

    finishingRef.current = true
    setGuidanceMessage('Processing face samples...')
    void completeEnrollment(capturedFrames)
  }, [capturing, capturedFrames])

  // Complete enrollment with captured frames
  const completeEnrollment = async (frames: any[]) => {
    try {
      console.log('[enrollment] Starting enrollment completion with', frames.length, 'frames')
      setCapturing(false)
      setGuidanceMessage('Processing and saving face data...')
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
        detectionIntervalRef.current = null
      }

      const descriptors = frames.map((f) => f.descriptor as Float32Array)
      const dimSize = descriptors[0].length

      // ---------------------------------------------------------------
      // Outlier rejection: compute pairwise cosine similarities and
      // discard any descriptor whose average similarity to others is
      // below 0.85 — this removes frames where the face was partially
      // occluded, poorly lit, or had motion blur.
      // ---------------------------------------------------------------
      const cosineSim = (a: Float32Array, b: Float32Array): number => {
        let dot = 0, normA = 0, normB = 0
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i]
          normA += a[i] * a[i]
          normB += b[i] * b[i]
        }
        if (normA === 0 || normB === 0) return 0
        return dot / (Math.sqrt(normA) * Math.sqrt(normB))
      }

      const avgSimilarities = descriptors.map((desc, i) => {
        let totalSim = 0
        let count = 0
        for (let j = 0; j < descriptors.length; j++) {
          if (i === j) continue
          totalSim += cosineSim(desc, descriptors[j])
          count++
        }
        return count > 0 ? totalSim / count : 0
      })

      // Keep descriptors whose average similarity to others is >= 0.85
      const filteredDescriptors = descriptors.filter((_, i) => avgSimilarities[i] >= 0.85)
      const usedDescriptors = filteredDescriptors.length >= 3 ? filteredDescriptors : descriptors

      console.log(`[enrollment] Outlier filter: ${descriptors.length} total, ${filteredDescriptors.length} passed, using ${usedDescriptors.length}`)

      // Average the descriptors, then L2-normalize.
      // Normalization is critical: averaging raw vectors shrinks the magnitude,
      // which breaks Euclidean distance thresholds in FaceMatcher.
      const avgDescriptor = new Float32Array(dimSize)
      for (let i = 0; i < dimSize; i++) {
        let sum = 0
        for (const descriptor of usedDescriptors) {
          sum += descriptor[i]
        }
        avgDescriptor[i] = sum / usedDescriptors.length
      }

      // L2-normalize so all enrolled vectors sit on the unit hypersphere
      let norm = 0
      for (let i = 0; i < avgDescriptor.length; i++) {
        norm += avgDescriptor[i] * avgDescriptor[i]
      }
      norm = Math.sqrt(norm)
      if (norm > 0) {
        for (let i = 0; i < avgDescriptor.length; i++) {
          avgDescriptor[i] /= norm
        }
      }

      // Final validation: ensure the averaged descriptor is not corrupted
      let hasInvalidValues = false
      for (let i = 0; i < avgDescriptor.length; i++) {
        if (!Number.isFinite(avgDescriptor[i])) {
          hasInvalidValues = true
          break
        }
      }
      if (hasInvalidValues) {
        throw new Error('Face descriptor computation produced invalid values. Please try again with better lighting.')
      }

      const avgScore = frames.reduce((sum, f) => sum + f.detection.score, 0) / frames.length
      
      const enrollmentData = {
        studentId,
        descriptor: Array.from(avgDescriptor),
        frameCount: frames.length,
        usedFrameCount: usedDescriptors.length,
        timestamp: new Date().toISOString(),
        metadata: {
          avgScore: avgScore,
          frameScores: frames.map((f) => f.detection.score),
          outliersRemoved: descriptors.length - usedDescriptors.length,
        },
      }

      console.log('[enrollment] Face enrollment data prepared:', {
        studentId,
        frameCount: frames.length,
        usedFrameCount: usedDescriptors.length,
        outliersRemoved: descriptors.length - usedDescriptors.length,
        avgScore: avgScore.toFixed(3),
        descriptorDim: avgDescriptor.length,
      })

      console.log('[enrollment] Sending enrollment data to parent component')
      await onEnrollmentComplete(enrollmentData)
      
      console.log('[enrollment] Enrollment complete callback finished successfully')

      // Stop camera before showing success
      stopCamera()
      setSuccess(true)
    } catch (err) {
      console.error('[enrollment] Error completing enrollment:', err)
      setError(err instanceof Error ? err.message : 'Error saving face data. Please try again.')
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
              Position your face in the camera frame. We&apos;ll capture {ENROLLMENT_SAMPLE_COUNT} images for better recognition accuracy.
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
                    <p className="text-sm text-emerald-300">Frames captured: {capturedFrames.length} / {ENROLLMENT_SAMPLE_COUNT}</p>
                    <p className="mt-2 text-xs text-amber-200">{guidanceMessage}</p>
                  </div>
                  <div className="w-full max-w-sm rounded-2xl bg-slate-950/80 p-4 shadow-xl backdrop-blur">
                    <div className="flex gap-2">
                      {Array.from({ length: ENROLLMENT_SAMPLE_COUNT }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-3 flex-1 rounded-full transition-all ${
                            i < capturedFrames.length ? 'bg-green-500 scale-105' : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-center text-xs text-white/80">
                      {capturedFrames.length === ENROLLMENT_SAMPLE_COUNT ? 'Processing...' : 'Hold still...'}
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
                <p className="mt-2 text-sm text-slate-600">Keep your face centered, well lit, and look directly into the camera for {ENROLLMENT_SAMPLE_COUNT} samples.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Capture Status</p>
                <div className="mt-3 grid grid-cols-7 gap-2">
                  {Array.from({ length: ENROLLMENT_SAMPLE_COUNT }).map((_, i) => (
                    <div key={i} className={`h-3 rounded-full ${i < capturedFrames.length ? 'bg-[#2b5c9e]' : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{capturedFrames.length} of {ENROLLMENT_SAMPLE_COUNT} samples captured</p>
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
