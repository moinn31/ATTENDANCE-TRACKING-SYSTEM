'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as faceapi from 'face-api.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DashboardShell } from '@/components/dashboard-shell'
import {
  analyzeAttendanceVideo,
  type EnrolledFace,
  type VideoFramePreview,
  type VideoRecognitionMatch,
} from '@/lib/attendance-video'
import { useAuth } from '@/hooks/use-auth'

interface DetectedStudent {
  id: string
  name: string
  roll_number?: string | null
  confidence: number
  timestamp: string
}

interface EnrolledStudent {
  id: string
  name: string
  roll_number: string | null
  descriptor: Float32Array
}

interface StudentRosterEntry {
  id: string
  name: string
  roll_number?: string | null
}

const DETECTOR_INPUT_SIZE = 640
const DETECTOR_SCORE_THRESHOLD = 0.40
const FACE_MATCH_DISTANCE_THRESHOLD = 0.75
const REQUIRED_CONFIRMATION_FRAMES = 1
const VIDEO_TARGET_FPS = 30
const MIN_FACE_AREA = 10000 // Only scan students who are close to the camera

const formatVideoTimestamp = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(safe % 60).padStart(2, '0')
  return `${minutes}:${secs}`
}

const getPreferredRecorderMimeType = () => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return ''
  }

  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || ''
}

export default function ScannerPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const previewPresentRef = useRef<Set<string>>(new Set())
  const candidateVotesRef = useRef<Map<string, number>>(new Map())
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null)
  const enrolledByIdRef = useRef<Map<string, EnrolledStudent>>(new Map())
  const detectionInFlightRef = useRef(false)
  // Refs that mirror state so the detection interval (stale closure) always reads current values
  const sessionActiveRef = useRef(false)
  const modelsLoadedRef = useRef(false)

  const [loading] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [isProcessingVideo, setIsProcessingVideo] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [className, setClassName] = useState('Class A')
  const [subjectName, setSubjectName] = useState('Mathematics')
  const [attendanceDate, setAttendanceDate] = useState('')

  const [allStudents, setAllStudents] = useState<StudentRosterEntry[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([])
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([])
  const [previewPresentIds, setPreviewPresentIds] = useState<string[]>([])
  const [attendanceSaved, setAttendanceSaved] = useState(false)
  const [scanCompleted, setScanCompleted] = useState(false)

  const [scanStatus, setScanStatus] = useState('Ready to scan')
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const renderProcessedFramePreview = (frame: VideoFramePreview) => {
    const previewCanvas = canvasRef.current
    if (!previewCanvas) {
      return
    }

    if (previewCanvas.width !== frame.canvas.width || previewCanvas.height !== frame.canvas.height) {
      previewCanvas.width = frame.canvas.width
      previewCanvas.height = frame.canvas.height
    }

    const context = previewCanvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      return
    }

    context.drawImage(frame.canvas, 0, 0, previewCanvas.width, previewCanvas.height)

    if (frame.processedFrames % 15 === 0 || frame.processedFrames === frame.totalFrames) {
      setLastScanAt(`Frame ${frame.processedFrames}/${frame.totalFrames} @ ${formatVideoTimestamp(frame.timeSeconds)}`)
    }
  }

  const getLocalDate = () => {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return local.toISOString().split('T')[0]
  }

  useEffect(() => {
    setAttendanceDate(getLocalDate())
  }, [])

  const parseDescriptor = (rawValue: unknown): Float32Array | null => {
    if (rawValue == null) return null

    const toNumericArray = (value: unknown): number[] => {
      if (Array.isArray(value)) {
        return value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
      }

      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          return toNumericArray(parsed)
        } catch {
          return []
        }
      }

      if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value as Record<string, unknown>)
          .filter(([key]) => /^\d+$/.test(key))
          .sort((left, right) => Number(left[0]) - Number(right[0]))

        if (entries.length > 0) {
          return entries
            .map(([, entryValue]) => Number(entryValue))
            .filter((entryValue) => Number.isFinite(entryValue))
        }
      }

      return []
    }

    const numeric = toNumericArray(rawValue)
    if (numeric.length === 0) return null
    return new Float32Array(numeric)
  }

  const distanceToConfidence = (distance: number): number => {
    // Map Euclidean distance [0, 1] → confidence [100, 0] linearly
    return Math.max(0, Math.min(100, Math.round((1 - distance) * 100)))
  }

  const stopCamera = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    setCameraActive(false)
  }

  const startCamera = async (): Promise<boolean> => {
    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API not supported on this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.')
      return false
    }

    try {
      // For mobile: request permissions explicitly
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: { ideal: 'environment' }, // Back camera for mobile
        },
        audio: false,
      }

      console.log('[scanner] Requesting camera access with constraints:', constraints)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }

      videoRef.current.srcObject = stream
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((err) => {
          console.error('[scanner] Error playing video:', err)
        })
      }
      setCameraActive(true)
      setError(null)
      return true
    } catch (err) {
      console.error('[scanner] Primary camera error:', err)

      // Fallback 1: Try front camera
      try {
        console.log('[scanner] Trying front camera fallback')
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, min: 15 },
            facingMode: 'user', // Front camera
          },
          audio: false,
        })

        if (!videoRef.current) {
          fallbackStream.getTracks().forEach((track) => track.stop())
          return false
        }

        videoRef.current.srcObject = fallbackStream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.error('[scanner] Error playing fallback video:', err)
          })
        }
        setCameraActive(true)
        setError(null)
        return true
      } catch (fallbackErr) {
        console.error('[scanner] Front camera fallback failed:', fallbackErr)

        // Fallback 2: Try generic camera without facingMode
        try {
          console.log('[scanner] Trying generic camera fallback')
          const genericStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, min: 15 },
            },
            audio: false,
          })

          if (!videoRef.current) {
            genericStream.getTracks().forEach((track) => track.stop())
            return false
          }

          videoRef.current.srcObject = genericStream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch((err) => {
              console.error('[scanner] Error playing generic video:', err)
            })
          }
          setCameraActive(true)
          setError(null)
          return true
        } catch (genericErr) {
          console.error('[scanner] All camera attempts failed:', genericErr)
          const errorMessage = getDetailedCameraErrorMessage(err, fallbackErr, genericErr)
          setError(errorMessage)
          return false
        }
      }
    }
  }

  const getDetailedCameraErrorMessage = (err: any, fallbackErr: any, genericErr: any) => {
    const errStr = JSON.stringify(err)?.toLowerCase() || ''
    const isMobile = /android|iphone|ipad|ipod|mobile|webos|blackberry|windows phone/i.test(
      navigator.userAgent
    )

    if (errStr.includes('permission') || fallbackErr?.toString().includes('NotAllowedError')) {
      return '🔒 Camera permission denied. Please check your phone settings: Settings > Apps > This App > Permissions > Camera > Allow.'
    }
    if (errStr.includes('notfound') || fallbackErr?.toString().includes('NotFoundError')) {
      return '📷 No camera found on this device. Please use a device with a camera.'
    }
    if (errStr.includes('notsupported') || fallbackErr?.toString().includes('NotSupportedError')) {
      return '⚠️ Camera not supported in this browser. Try: Chrome, Firefox, Safari, or Edge.'
    }
    if (errStr.includes('secure') || fallbackErr?.toString().includes('secure')) {
      return '🔐 HTTPS or localhost required for camera access. Please access via HTTPS.'
    }
    if (isMobile) {
      return '📱 Camera access failed on mobile. Please: 1) Check app permissions, 2) Try a different browser (Chrome recommended), 3) Refresh the page.'
    }
    return '❌ Failed to access camera. Make sure your browser has permission to use the camera and try again.'
  }

  const fetchStudents = async (): Promise<EnrolledStudent[]> => {
    try {
      const response = await fetch('/api/students?includeEmbeddings=true', {
        cache: 'no-store',
      })

      let payload: any = {}
      try {
        payload = await response.json()
      } catch {
        payload = {}
      }

      if (!response.ok) {
        if (response.status === 401) {
          router.replace('/auth/login')
          return []
        }
        throw new Error(payload.error || 'Failed to fetch students')
      }

      const rows = payload.data || []
      setAllStudents(rows)

      const enrolled: EnrolledStudent[] = rows
        .map((row: any) => {
          const descriptor = parseDescriptor(row.embedding_vector)
          if (!descriptor) return null
          
          if (descriptor.length !== 128) {
            console.warn(`[scanner] Rejecting student ${row.name}: incompatible dimension ${descriptor.length} (128 required)`)
            return null
          }

          return {
            id: row.id,
            name: row.name,
            roll_number: row.roll_number ?? null,
            descriptor,
          }
        })
        .filter((row: EnrolledStudent | null): row is EnrolledStudent => Boolean(row))

      console.log(`[scanner] Loaded ${enrolled.length} valid 128-d students out of ${rows.length} total records.`)
      setEnrolledStudents(enrolled)
      return enrolled
    } catch (err) {
      console.error('[scanner] students fetch error', err)
      if (err instanceof TypeError) {
        setError('Unable to reach the server. Check your connection and ensure the app is still running.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch students')
      }
      return []
    }
  }

  const refreshStudents = async () => {
    return await fetchStudents()
  }

  const processDetections = async () => {
    if (detectionInFlightRef.current) {
      return
    }

    // Use refs (not state) so the setInterval callback always sees current values
    if (!sessionActiveRef.current || !modelsLoadedRef.current) {
      return
    }

    if (!videoRef.current || !canvasRef.current) {
      return
    }

    if (enrolledByIdRef.current.size === 0) {
      setScanStatus('No enrolled faces found. Please enroll student faces first on the Students page.')
      return
    }

    const faceMatcher = faceMatcherRef.current
    if (!faceMatcher) {
      setScanStatus('Building face matcher — please wait a moment...')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    detectionInFlightRef.current = true

    try {
      // Snapshot initial dimensions so we can avoid calling resize on transient zero sizes.
      const initialWidth = video.videoWidth
      const initialHeight = video.videoHeight

      // Higher inputSize helps detect smaller faces farther from the camera.
      const detections = await faceapi
        .detectAllFaces(
          video,
          new faceapi.SsdMobilenetv1Options({
            minConfidence: DETECTOR_SCORE_THRESHOLD,
          }),
        )
        .withFaceLandmarks()
        .withFaceDescriptors()

      // Camera/session state may change while awaiting detection.
      if (!sessionActiveRef.current || !videoRef.current || !canvasRef.current) {
        return
      }

      setLastScanAt(new Date().toLocaleTimeString())

      const currentWidth = video.videoWidth > 0 ? video.videoWidth : initialWidth
      const currentHeight = video.videoHeight > 0 ? video.videoHeight : initialHeight

      if (currentWidth <= 0 || currentHeight <= 0) {
        return
      }

      const displaySize = { width: currentWidth, height: currentHeight }
      canvas.width = displaySize.width
      canvas.height = displaySize.height
      faceapi.matchDimensions(canvas, displaySize)
      const resized = faceapi.resizeResults(detections, displaySize)
      // We'll draw the canvas AFTER matching so we can colour-code recognized vs unknown faces
      // (drawing is deferred to after the recognition loop below)

      console.log(`[scanner] Live Frame: Detected ${detections.length} face(s) with SSD scoreThreshold ${DETECTOR_SCORE_THRESHOLD}`)

      const recognized: DetectedStudent[] = []

      // Exclusive matching: collect all face→student candidates, then assign
      // each student to at most one face (the closest match).
      const candidates: Array<{ studentId: string; distance: number; detectionIndex: number }> = []

      for (let i = 0; i < detections.length; i++) {
        const detection = detections[i]
        const descriptor = detection.descriptor

        if (i === 0) {
          console.log(`[scanner] Descriptor[0] - Length: ${descriptor.length}, Sample: [${descriptor.slice(0, 3).join(', ')}]`)
        }

        if (descriptor.length !== 128) {
          console.warn(`[scanner] Face ${i} ignored: dimension ${descriptor.length} != 128`)
          continue
        }

        const bestMatch = faceMatcher.findBestMatch(descriptor)
        const box = detection.detection.box
        const faceArea = Math.round(box.width * box.height)

        console.log(`[scanner] Face ${i}: area=${faceArea}, match=${bestMatch.label}, dist=${bestMatch.distance.toFixed(4)}`)

        if (faceArea < MIN_FACE_AREA) {
          console.log(`[scanner] Face ${i} REJECTED: Too far (area=${faceArea} < ${MIN_FACE_AREA})`)
          continue
        }

        if (bestMatch.label === 'unknown') {
          // Find nearest anyway for debugging
          const closest = enrolledStudents.map(s => ({
            name: s.name,
            dist: faceapi.euclideanDistance(descriptor, s.descriptor)
          })).sort((a, b) => a.dist - b.dist)[0]
          
          if (closest) {
            console.log(`[scanner] Nearest candidate for face ${i}: ${closest.name} (Dist: ${closest.dist.toFixed(4)})`)
          }
          continue
        }
        candidates.push({ studentId: bestMatch.label, distance: bestMatch.distance, detectionIndex: i })
      }

      // Sort by distance ascending (best matches first)
      candidates.sort((a, b) => a.distance - b.distance)
      const assignedStudents = new Set<string>()
      const assignedFaces = new Set<number>()

      for (const candidate of candidates) {
        if (assignedStudents.has(candidate.studentId) || assignedFaces.has(candidate.detectionIndex)) {
          continue  // This student or face is already matched
        }

        const matched = enrolledByIdRef.current.get(candidate.studentId)
        if (!matched) {
          continue
        }

        const currentVotes = candidateVotesRef.current.get(matched.id) ?? 0
        candidateVotesRef.current.set(matched.id, currentVotes + 1)

        // Extra confirmation frames prevent false matches when using long-range tuning.
        if ((candidateVotesRef.current.get(matched.id) ?? 0) < REQUIRED_CONFIRMATION_FRAMES) {
          continue
        }

        assignedStudents.add(candidate.studentId)
        assignedFaces.add(candidate.detectionIndex)

        recognized.push({
          id: matched.id,
          name: matched.name,
          roll_number: matched.roll_number,
          confidence: distanceToConfidence(candidate.distance),
          timestamp: new Date().toLocaleTimeString(),
        })
      }

      // ── CANVAS DRAWING (after matching so we know who is recognized) ────────────
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Build a quick lookup: detectionIndex → recognized student
        const recognizedByFaceIdx = new Map<number, DetectedStudent>()
        for (const candidate of candidates) {
          if (assignedFaces.has(candidate.detectionIndex)) {
            const matched = enrolledByIdRef.current.get(candidate.studentId)
            if (matched) {
              const conf = distanceToConfidence(candidate.distance)
              recognizedByFaceIdx.set(candidate.detectionIndex, {
                id: matched.id,
                name: matched.name,
                roll_number: matched.roll_number,
                confidence: conf,
                timestamp: new Date().toLocaleTimeString(),
              })
            }
          }
        }

        resized.forEach((det, idx) => {
          const box = det.detection.box
          const student = recognizedByFaceIdx.get(idx)
          const isRecognized = Boolean(student)

          const BOX_PADDING = 4
          const bx = box.x - BOX_PADDING
          const by = box.y - BOX_PADDING
          const bw = box.width + BOX_PADDING * 2
          const bh = box.height + BOX_PADDING * 2

          if (isRecognized && student) {
            // ── Green glow box ────────────────────────────────────────────
            ctx.save()
            ctx.shadowColor = 'rgba(34, 197, 94, 0.8)'
            ctx.shadowBlur = 18
            ctx.strokeStyle = '#22c55e'
            ctx.lineWidth = 3
            ctx.strokeRect(bx, by, bw, bh)
            ctx.restore()

            // Corner accents (top-left & bottom-right)
            const cLen = Math.min(28, bw * 0.22)
            ctx.strokeStyle = '#4ade80'
            ctx.lineWidth = 4
            ctx.lineCap = 'round'
            // TL
            ctx.beginPath(); ctx.moveTo(bx, by + cLen); ctx.lineTo(bx, by); ctx.lineTo(bx + cLen, by); ctx.stroke()
            // TR
            ctx.beginPath(); ctx.moveTo(bx + bw - cLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cLen); ctx.stroke()
            // BL
            ctx.beginPath(); ctx.moveTo(bx, by + bh - cLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cLen, by + bh); ctx.stroke()
            // BR
            ctx.beginPath(); ctx.moveTo(bx + bw - cLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cLen); ctx.stroke()

            // ── Greeting badge (above box) ────────────────────────────────
            const greeting = `Hello, ${student.name}!`
            const subLabel = `${student.confidence}% match`
            ctx.font = 'bold 17px system-ui, sans-serif'
            const greetWidth = ctx.measureText(greeting).width
            ctx.font = '12px system-ui, sans-serif'
            const subWidth = ctx.measureText(subLabel).width
            const badgeW = Math.max(greetWidth, subWidth) + 24
            const badgeH = 46
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

            // Greeting text
            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 16px system-ui, sans-serif'
            ctx.fillText(greeting, badgeX + 12, badgeY + 19)

            // Sub-label
            ctx.fillStyle = '#bbf7d0'
            ctx.font = '12px system-ui, sans-serif'
            ctx.fillText(subLabel, badgeX + 12, badgeY + 36)

          } else {
            // ── Unknown face – subtle cyan scanning frame ─────────────────
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)'
            ctx.lineWidth = 2
            ctx.setLineDash([6, 4])
            ctx.strokeRect(bx, by, bw, bh)
            ctx.setLineDash([])

            const scanLabel = 'Scanning...'
            ctx.font = '13px system-ui, sans-serif'
            const sw = ctx.measureText(scanLabel).width + 16
            const sx = bx
            const sy = by - 26
            ctx.fillStyle = 'rgba(8, 145, 178, 0.85)'
            ctx.fillRect(sx, sy, sw, 22)
            ctx.fillStyle = '#e0f7fa'
            ctx.fillText(scanLabel, sx + 8, sy + 15)
          }
        })
      }
      // ── END CANVAS DRAWING ──────────────────────────────────────────────────────

      if (recognized.length === 0) {
        if (detections.length > 0) {
          const smallFaces = detections.filter(d => (d.detection.box.width * d.detection.box.height) < MIN_FACE_AREA).length
          if (smallFaces === detections.length) {
            setScanStatus('Too Far – Move Closer')
          } else {
            setScanStatus('Face Detected - Recognizing...')
          }
        } else {
          setScanStatus('Ready to scan - No face detected')
        }
        return
      }

      const deduped = Array.from(new Map(recognized.map((student) => [student.id, student])).values())

      setDetectedStudents((prev) => {
        const merged = [...deduped, ...prev.filter((item) => !deduped.some((now) => now.id === item.id))]
        return merged.slice(0, 80)
      })

      const nextSet = new Set(previewPresentRef.current)
      for (const student of deduped) {
        nextSet.add(student.id)
      }
      previewPresentRef.current = nextSet
      setPreviewPresentIds(Array.from(nextSet))

      setScanStatus(`Face Detected. Present preview: ${nextSet.size} student(s).`)
    } catch (err) {
      console.error('[scanner] detection failure', err)
    } finally {
      detectionInFlightRef.current = false
    }
  }

  const processDetectionsRef = useRef(processDetections)
  // Keep the ref pointing at the latest version so the stale interval always calls the right one
  processDetectionsRef.current = processDetections

  const startDetectionLoop = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
    }

    detectionIntervalRef.current = setInterval(() => {
      void processDetectionsRef.current()
    }, 300)
  }

  const stopAttendanceSession = () => {
    stopRecordedSession()
  }

  const clearPreview = () => {
    candidateVotesRef.current = new Map()
    previewPresentRef.current = new Set()
    setPreviewPresentIds([])
    setDetectedStudents([])
    setProcessingProgress(0)
    setVideoDuration(0)
    setAttendanceSaved(false)
    setScanCompleted(false)
    setScanStatus('Preview cleared. Start scan again.')
  }

  const toggleStudentStatus = (studentId: string) => {
    const nextSet = new Set(previewPresentRef.current)
    if (nextSet.has(studentId)) {
      nextSet.delete(studentId)
    } else {
      nextSet.add(studentId)
    }
    previewPresentRef.current = nextSet
    setPreviewPresentIds(Array.from(nextSet))
  }

  const clearSavedAttendance = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to clear attendance data')
      }

      setAttendanceSaved(false)
      setScanCompleted(false)
      candidateVotesRef.current = new Map()
      previewPresentRef.current = new Set()
      setPreviewPresentIds([])
      setDetectedStudents([])
      setProcessingProgress(0)
      setVideoDuration(0)
      setScanStatus('All saved attendance data has been cleared from database.')
    } catch (err) {
      console.error('[scanner] clear saved attendance error', err)
      setError(err instanceof Error ? err.message : 'Failed to clear attendance data')
    } finally {
      setIsSaving(false)
    }
  }

  const applyRecognitionMatches = (matches: VideoRecognitionMatch[]) => {
    const dedupedMatches = Array.from(new Map(matches.map((match) => [match.studentId, match])).values())
    const nextPresentIds = new Set<string>()

    const recognizedStudents: DetectedStudent[] = dedupedMatches.map((match) => {
      nextPresentIds.add(match.studentId)
      return {
        id: match.studentId,
        name: match.name,
        roll_number: match.roll_number,
        confidence: match.confidence,
        timestamp: formatVideoTimestamp(match.bestFrameIndex / VIDEO_TARGET_FPS),
      }
    })

    previewPresentRef.current = nextPresentIds
    setPreviewPresentIds(Array.from(nextPresentIds))
    setDetectedStudents(recognizedStudents)
    setScanCompleted(true)

    if (dedupedMatches.length === 0) {
      setScanStatus('Video processed, but no enrolled faces matched the recorded frames.')
      return
    }

    const frameCount = dedupedMatches.reduce((total, match) => total + match.frameCount, 0)
    setScanStatus(`Video processed frame by frame. Matched ${dedupedMatches.length} student(s) from ${frameCount} unique face track(s).`)
  }

  const resolveVideoDuration = async (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Could not read video metadata'))
      })
      return Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0
    } finally {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }
  }

  const createVideoElementFromBlob = async (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.src = objectUrl
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Unable to load recorded video'))
      })

      return { video, objectUrl }
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  const seekVideo = async (video: HTMLVideoElement, timeSeconds: number) => {
    const safeTime = Math.max(0, Math.min(timeSeconds, Math.max(0, video.duration - 0.05)))
    if (Math.abs(video.currentTime - safeTime) < 0.02) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        cleanup()
        resolve()
      }

      const onError = () => {
        cleanup()
        reject(new Error('Unable to seek recorded video'))
      }

      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
      }

      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      video.currentTime = safeTime
    })
  }


  const processRecordedVideo = async (blob: Blob, roster: EnrolledStudent[] = enrolledStudents) => {
    setIsProcessingVideo(true)
    setProcessingProgress(0)
    setScanStatus('Processing recorded video frame by frame...')

    try {
      const duration = await resolveVideoDuration(blob)
      setVideoDuration(duration)

      const analyzeLocally = async () => {
        return await analyzeAttendanceVideo(blob, roster as EnrolledFace[], {
          targetFps: VIDEO_TARGET_FPS,
          durationHintSeconds: duration,
          frameStride: 2,
          minDetectionScore: DETECTOR_SCORE_THRESHOLD,
          onStatus: (message) => setScanStatus(message),
          onFramePreview: (frame) => renderProcessedFramePreview(frame),
          onProgress: (progress, processedFrames, totalFrames) => {
            setProcessingProgress(progress)
            const safeTotalFrames = Number.isFinite(totalFrames) && totalFrames > 0
              ? totalFrames
              : Math.max(processedFrames, 1)
            if (processedFrames % 10 === 0 || processedFrames === safeTotalFrames) {
              setScanStatus(`Tracing video frames... ${progress}% (${processedFrames}/${safeTotalFrames} frames)`)
            }
          },
        })
      }

      setScanStatus('Analyzing video frames for student recognition...')
      const matches = await analyzeLocally()
      console.log(`[scanner] analyzeLocally finished. Received ${matches.length} matches.`)

      applyRecognitionMatches(matches)
      setProcessingProgress(100)
    } catch (err) {
      console.error('[scanner] recorded video processing error', err)
      setError(err instanceof Error ? err.message : 'Failed to process attendance video')
      setScanStatus('Video processing failed. You can retry the scan.')
    } finally {
      setIsProcessingVideo(false)
    }
  }

  const stopRecordedSession = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      setScanStatus('Stopping video recording and preparing frame analysis...')
      recorder.stop()
      return
    }

    if (sessionActive) {
      sessionActiveRef.current = false
      setSessionActive(false)
      stopCamera()
      setScanCompleted(true)
      setScanStatus('Video scan stopped. Review the attendance preview below, then save if it looks correct.')
    }
  }

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setError('Please upload a valid video file.')
      return
    }

    setError(null)
    sessionActiveRef.current = false
    setSessionActive(false)
    stopCamera()
    setAttendanceSaved(false)
    setScanCompleted(false)
    setDetectedStudents([])
    setPreviewPresentIds([])
    previewPresentRef.current = new Set()
    candidateVotesRef.current = new Map()

    await processRecordedVideo(file)
    event.target.value = ''
  }

  const saveAttendance = async () => {
    if (!attendanceDate || !className.trim() || !subjectName.trim()) {
      setError('Class, subject and date are required before saving.')
      return
    }

    if (isProcessingVideo) {
      setError('Please wait for video processing to finish before saving attendance.')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const presentSet = new Set(previewPresentRef.current)

      for (const student of allStudents) {
        const status = presentSet.has(student.id) ? 'present' : 'absent'

        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: student.id,
            status,
            confidence: status === 'present' ? 90 : 0,
            date: attendanceDate,
            class_name: className.trim(),
            subject_name: subjectName.trim(),
          }),
        })

        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || `Failed to save for ${student.name}`)
        }
      }

      setScanStatus('Attendance saved! Present: ' + presentSet.size + ' | Absent: ' + (allStudents.length - presentSet.size))
      setAttendanceSaved(true)
    } catch (err) {
      console.error('[scanner] save attendance error', err)
      setError(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setIsSaving(false)
    }
  }

  const startAttendanceSession = async () => {
    if (!modelsLoaded) {
      setError('Face models are still loading. Please wait.')
      return
    }

    const refreshedStudents = await refreshStudents()
    const availableStudents = refreshedStudents.length > 0 ? refreshedStudents : enrolledStudents

    if (availableStudents.length === 0) {
      setError('No enrolled students found. Enroll faces first.')
      return
    }

    if (!attendanceDate || !className.trim() || !subjectName.trim()) {
      setError('Select class, subject and date before starting attendance.')
      return
    }

    const ok = await startCamera()
    if (!ok) return

    setError(null)
    setIsProcessingVideo(false)
    setProcessingProgress(0)
    sessionActiveRef.current = true
    setSessionActive(true)
    setAttendanceSaved(false)
    setScanCompleted(false)
    setDetectedStudents([])
    candidateVotesRef.current = new Map()
    previewPresentRef.current = new Set()
    setPreviewPresentIds([])
    recordedChunksRef.current = []
    mediaRecorderRef.current = null

    const stream = videoRef.current?.srcObject as MediaStream | null
    if (!stream || typeof MediaRecorder === 'undefined') {
      setScanStatus('Video recording is unavailable in this browser. Falling back to live frame-by-frame scanning.')
      startDetectionLoop()
      return
    }

    const mimeType = getPreferredRecorderMimeType()
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

    mediaRecorderRef.current = recorder
    recordedChunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      const chunks = recordedChunksRef.current.slice()
      recordedChunksRef.current = []
      mediaRecorderRef.current = null

      sessionActiveRef.current = false
      setSessionActive(false)
      stopCamera()

      const blob = new Blob(chunks, {
        type: mimeType || 'video/webm',
      })

      if (blob.size === 0) {
        setError('No video data was captured. Please try again.')
        setIsProcessingVideo(false)
        return
      }

      void processRecordedVideo(blob, availableStudents)
    }

    try {
      recorder.start(1000)
      setScanStatus('Recording started. Keep recording as long as needed, then click Stop Scan to process at 30fps.')
    } catch (err) {
      console.error('[scanner] MediaRecorder start failed', err)
      mediaRecorderRef.current = null
      sessionActiveRef.current = false
      setSessionActive(false)
      stopCamera()
      setError('Failed to start video recording in this browser. Falling back to live detection is recommended.')
      startDetectionLoop()
    }
  }

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/'
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        modelsLoadedRef.current = true
        setModelsLoaded(true)
      } catch (err) {
        console.error('[scanner] model loading error', err)
        setError('Failed to load recognition models')
      }
    }

    void loadModels()
  }, [])

  useEffect(() => {
    if (!authLoading) {
      void fetchStudents()
    }
  }, [authLoading])

  useEffect(() => {
    const handleFocus = () => {
      if (!authLoading) void refreshStudents()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !authLoading) {
        void refreshStudents()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [authLoading])

  useEffect(() => {
    if (enrolledStudents.length === 0) {
      faceMatcherRef.current = null
      enrolledByIdRef.current = new Map()
      return
    }

    const labeledDescriptors = enrolledStudents.map(
      (student) => new faceapi.LabeledFaceDescriptors(student.id, [student.descriptor]),
    )
    faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCH_DISTANCE_THRESHOLD)
    enrolledByIdRef.current = new Map(enrolledStudents.map((student) => [student.id, student]))
  }, [enrolledStudents])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      mediaRecorderRef.current = null
      recordedChunksRef.current = []
      stopCamera()
    }
  }, [])

  const presentCount = previewPresentIds.length
  const unmatchedCount = Math.max(allStudents.length - presentCount, 0)
  const isResultFinalized = scanCompleted || attendanceSaved
  const secondMetricCount = isResultFinalized || sessionActive ? unmatchedCount : 0
  const absentCount = isResultFinalized ? unmatchedCount : 0
  const previewPresentSet = useMemo(() => new Set(previewPresentIds), [previewPresentIds])
  const showVideoSurface = cameraActive || isProcessingVideo

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <DashboardShell title="Attendance Scanner" subtitle="Recorded video frame-by-frame recognition session">
      <main className="space-y-6">
        <section className="glass-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Frame-by-Frame Recognition</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">Smart Attendance Scanner</h1>
              <p className="mt-2 text-sm text-muted-foreground">Record a short video, extract frames one by one, filter poor detections, and save accurate attendance results.</p>
            </div>
            <Link href="/">
              <Button variant="outline" className="rounded-xl border-border/70 bg-card/80">Back to Home</Button>
            </Link>
          </div>
        </section>

        <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class" />
          <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Subject" />
          <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
          {!sessionActive ? (
            <Button onClick={startAttendanceSession} disabled={!modelsLoaded || isSaving || isProcessingVideo}>Start Video Scan</Button>
          ) : (
            <Button variant="destructive" onClick={stopAttendanceSession} disabled={isSaving || isProcessingVideo}>
              Stop Scan
            </Button>
          )}
          <div className="flex gap-2">
            <Button onClick={saveAttendance} disabled={sessionActive || isSaving || isProcessingVideo || attendanceSaved || !scanCompleted} className="flex-1">
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </Button>
            <Button variant="outline" onClick={clearPreview} disabled={sessionActive || isSaving || isProcessingVideo}>Clear</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => uploadInputRef.current?.click()}
            disabled={sessionActive || isSaving || isProcessingVideo}
          >
            Upload Video
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoUpload}
          />
        </div>

        <div>
          <Button variant="destructive" onClick={clearSavedAttendance} disabled={sessionActive || isSaving || isProcessingVideo}>
            Clear All Saved Attendance Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="glass-card p-3">
            <p className="text-xs text-muted-foreground">Session</p>
            <p className="text-sm font-medium text-foreground">
              {isProcessingVideo ? 'Processing Video' : sessionActive ? 'Recording Video' : 'Stopped'}
            </p>
          </div>
          <div className="glass-card border-green-300 bg-green-50/80 p-3">
            <p className="text-xs text-muted-foreground">{attendanceSaved ? 'Present (Saved)' : scanCompleted ? 'Present (Preview)' : 'Detected'}</p>
            <p className="text-sm font-semibold text-green-700">{presentCount}</p>
          </div>
          <div className="glass-card border-red-300 bg-red-50/80 p-3">
            <p className="text-xs text-muted-foreground">{attendanceSaved ? 'Absent (Saved)' : scanCompleted ? 'Absent (Preview)' : 'Not yet seen'}</p>
            <p className="text-sm font-semibold text-red-700">{secondMetricCount}</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-xs text-muted-foreground">Last Scan</p>
            <p className="text-sm font-medium text-foreground">{lastScanAt || '-'}</p>
          </div>
        </div>

        <div className="glass-card p-3">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium text-foreground">{scanStatus}</p>
          {isProcessingVideo && (
            <p className="text-xs text-muted-foreground mt-1">
              Trace Progress: {processingProgress}%{videoDuration > 0 ? ` | Video: ${formatVideoTimestamp(videoDuration)}` : ''}
            </p>
          )}
        </div>

        {isProcessingVideo && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-700">
            Processing recorded video frame by frame. Please wait until the scan completes.
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            {error}
          </div>
        )}

        {!modelsLoaded && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-700">
            Loading recognition models...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="glass-card overflow-hidden">
              <div className="relative bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full ${showVideoSurface ? 'opacity-100' : 'opacity-0'}`}
                />
                {!showVideoSurface && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-muted-foreground">Camera is off. Click Start Video Scan.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Recognized Students (Preview)</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {detectedStudents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No matched students yet</p>
              ) : (
                detectedStudents.map((student) => (
                  <div key={student.id} className="p-3 bg-green-50 border border-green-300 rounded">
                    <p className="font-medium text-green-900">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.roll_number || '-'}</p>
                    <p className="text-xs text-muted-foreground">Frame time: {student.timestamp}</p>
                    <p className="text-xs font-semibold text-green-700 mt-1">PRESENT PREVIEW ({student.confidence}%)</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Attendance Preview</h2>
          {!sessionActive && !scanCompleted && !attendanceSaved ? (
            <p className="text-sm text-muted-foreground">Start a video scan to begin attendance. After the video is processed, you can review and edit before saving.</p>
          ) : sessionActive ? (
            <div>
              <p className="text-sm text-blue-700 font-medium mb-3">Recording in progress — {presentCount} face(s) recognised so far. Stop scan to process the video.</p>
              {presentCount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allStudents
                    .filter((s) => previewPresentSet.has(s.id))
                    .map((student) => (
                      <div key={student.id} className="p-3 rounded border bg-green-50 border-green-300">
                        <p className="font-semibold text-green-900">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.roll_number || '-'}</p>
                        <p className="text-xs font-semibold mt-1 text-green-700">DETECTED ✓</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : scanCompleted && !attendanceSaved ? (
            <div>
              <div className="p-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  Review the detected attendance below. Click the toggle button next to any student to correct mistakes. When you are satisfied, click <strong>Save Attendance</strong>.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-green-700 mb-2">Present ({presentCount})</h3>
                  <div className="space-y-2">
                    {allStudents
                      .filter((s) => previewPresentSet.has(s.id))
                      .map((student) => (
                        <div
                          key={student.id}
                          className="p-3 rounded border bg-green-50 border-green-300 flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold text-green-900">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.roll_number || '-'}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStudentStatus(student.id)}
                          >
                            Mark Absent
                          </Button>
                        </div>
                      ))}
                    {presentCount === 0 && (
                      <p className="text-sm text-muted-foreground">No students marked present</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">Absent ({absentCount})</h3>
                  <div className="space-y-2">
                    {allStudents
                      .filter((s) => !previewPresentSet.has(s.id))
                      .map((student) => (
                        <div
                          key={student.id}
                          className="p-3 rounded border bg-red-50 border-red-300 flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold text-red-900">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.roll_number || '-'}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStudentStatus(student.id)}
                          >
                            Mark Present
                          </Button>
                        </div>
                      ))}
                    {absentCount === 0 && (
                      <p className="text-sm text-muted-foreground">All students marked present</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={saveAttendance} disabled={isSaving} className="px-8">
                  {isSaving ? 'Saving...' : 'Save Attendance'}
                </Button>
                <Button variant="outline" onClick={clearPreview} disabled={isSaving}>
                  Clear & Rescan
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-green-700 font-medium mb-3">Attendance saved successfully — {presentCount} present, {absentCount} absent.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allStudents.map((student) => {
                  const present = previewPresentSet.has(student.id)
                  return (
                    <div
                      key={student.id}
                      className={`p-3 rounded border ${present ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}
                    >
                      <p className={`font-semibold ${present ? 'text-green-900' : 'text-red-900'}`}>{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.roll_number || '-'}</p>
                      <p className={`text-xs font-semibold mt-1 ${present ? 'text-green-700' : 'text-red-700'}`}>
                        {present ? 'PRESENT ✓' : 'ABSENT ✗'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </DashboardShell>
  )
}
