'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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

type RecognitionServiceMatch = {
  student_id: string
  name: string
  roll_number?: string | null
  confidence?: number
  similarity?: number
}

type RecognitionServiceResponse = {
  matches?: RecognitionServiceMatch[]
  batch_results?: Array<{
    frame_index: number
    matches?: RecognitionServiceMatch[]
  }>
  error?: string
}

const DETECTOR_INPUT_SIZE = 512
const DETECTOR_SCORE_THRESHOLD = 0.05
const FACE_MATCH_DISTANCE_THRESHOLD = 0.5
const REQUIRED_CONFIRMATION_FRAMES = 1
const VIDEO_TARGET_FPS = 30
const YOLO_SERVICE_TARGET_FPS = 6
const YOLO_SERVICE_BATCH_SIZE = 4

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

    const context = previewCanvas.getContext('2d')
    if (!context) {
      return
    }

    context.drawImage(frame.canvas, 0, 0, previewCanvas.width, previewCanvas.height)

    if (frame.processedFrames % 15 === 0 || frame.processedFrames === frame.totalFrames) {
      setLastScanAt(`Frame ${frame.processedFrames}/${frame.totalFrames} @ ${formatVideoTimestamp(frame.timeSeconds)}`)
    }
  }

  const getAuthHeaders = (isJson = false) => {
    // Safe access to localStorage (might not be available during SSR)
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null
    const headers: Record<string, string> = {}

    if (isJson) {
      headers['Content-Type'] = 'application/json'
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return headers
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
    return Math.max(0, Math.min(100, Math.round((1 - distance / 1.2) * 100)))
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
      // Check if token exists before attempting to fetch
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null
      
      if (!token) {
        setError('🔐 Not authenticated. Please login first.')
        return []
      }

      const response = await fetch('/api/students?includeEmbeddings=true', {
        cache: 'no-store',
        headers: getAuthHeaders(),
      })

      let payload: any = {}
      try {
        payload = await response.json()
      } catch {
        payload = {}
      }

      if (!response.ok) {
        if (response.status === 401) {
          setError('🔐 Authentication failed. Please login again.')
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('token')
          }
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
          return {
            id: row.id,
            name: row.name,
            roll_number: row.roll_number ?? null,
            descriptor,
          }
        })
        .filter((row: EnrolledStudent | null): row is EnrolledStudent => Boolean(row))

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
          new faceapi.TinyFaceDetectorOptions({
            inputSize: DETECTOR_INPUT_SIZE,
            scoreThreshold: DETECTOR_SCORE_THRESHOLD,
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

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        faceapi.draw.drawDetections(canvas, resized)
      }

      if (detections.length === 0) {
        setScanStatus('No faces in frame yet. Keep camera steady and move slowly left to right.')
        return
      }

      const recognized: DetectedStudent[] = []

      for (const detection of detections) {
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor)
        console.log(`[scanner] Face match: label=${bestMatch.label}, distance=${bestMatch.distance.toFixed(3)}, threshold=${FACE_MATCH_DISTANCE_THRESHOLD}`)
        if (bestMatch.label === 'unknown') {
          continue
        }

        const matched = enrolledByIdRef.current.get(bestMatch.label)
        if (!matched) {
          continue
        }

        const currentVotes = candidateVotesRef.current.get(matched.id) ?? 0
        candidateVotesRef.current.set(matched.id, currentVotes + 1)
        console.log(`[scanner] Match: ${matched.name} | votes: ${currentVotes + 1}/${REQUIRED_CONFIRMATION_FRAMES} | distance: ${bestMatch.distance.toFixed(3)}`)

        // Extra confirmation frames prevent false matches when using long-range tuning.
        if ((candidateVotesRef.current.get(matched.id) ?? 0) < REQUIRED_CONFIRMATION_FRAMES) {
          continue
        }

        recognized.push({
          id: matched.id,
          name: matched.name,
          roll_number: matched.roll_number,
          confidence: distanceToConfidence(bestMatch.distance),
          timestamp: new Date().toLocaleTimeString(),
        })
      }

      if (recognized.length === 0) {
        setScanStatus(`Detected ${detections.length} face(s), searching for enrolled match... (check browser console for details)`)
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

      setScanStatus(`Detected ${detections.length} face(s). Present preview: ${nextSet.size} student(s).`)
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
        headers: getAuthHeaders(true),
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

  const seekVideo = async (video: HTMLVideoElement, time: number) => {
    const safeTime = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.05)))
    if (Math.abs(video.currentTime - safeTime) < 0.02) return

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => { cleanup(); resolve() }
      const onError = () => { cleanup(); reject(new Error('Video seek failed')) }
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
      }
      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      video.currentTime = safeTime
    })
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



  const analyzeAttendanceVideoWithYoloService = async (
    blob: Blob,
    roster: EnrolledStudent[],
    durationHintSeconds: number,
  ): Promise<VideoRecognitionMatch[]> => {
    const { video, objectUrl } = await createVideoElementFromBlob(blob)
    const frameCanvas = document.createElement('canvas')

    try {
      const duration = Math.max(
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0,
        Number.isFinite(durationHintSeconds) && durationHintSeconds > 0 ? durationHintSeconds : 0,
      )
      const intervalSeconds = Math.max(1 / YOLO_SERVICE_TARGET_FPS, 0.05)
      const totalFrames = Math.max(1, Math.ceil(duration / intervalSeconds))
      const aggregate = new Map<string, VideoRecognitionMatch>()

      const students = roster.map((student) => ({
        id: student.id,
        name: student.name,
        roll_number: student.roll_number,
        embedding: Array.from(student.descriptor),
      }))

      let processedFrames = 0
      let batchPayload: Array<{ frameIndex: number; imageBase64: string }> = []

      const flushBatch = async () => {
        if (batchPayload.length === 0) {
          return
        }

        const response = await fetch('/api/recognition', {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            images_base64: batchPayload.map((frame) => frame.imageBase64),
            frame_indices: batchPayload.map((frame) => frame.frameIndex),
            students,
          }),
        })

        let payload: RecognitionServiceResponse = {}
        try {
          payload = await response.json()
        } catch {
          payload = {}
        }

        if (!response.ok) {
          if (response.status === 501 || response.status === 503) {
            throw new Error('Recognition service not configured')
          }
          if (response.status === 401) {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('token')
            }
            throw new Error('Authentication failed. Please login again.')
          }
          throw new Error(payload.error || 'YOLO recognition request failed')
        }

        const groupedMatches = payload.batch_results
          ? payload.batch_results.map((entry) => ({
              frameIndex: Number.isFinite(entry.frame_index) ? entry.frame_index : 0,
              matches: entry.matches || [],
            }))
          : [
              {
                frameIndex: batchPayload[0]?.frameIndex ?? 0,
                matches: payload.matches || [],
              },
            ]

        for (const group of groupedMatches) {
          for (const match of group.matches) {
            const existing = aggregate.get(match.student_id)
            const confidence = Math.max(0, Math.min(100, Math.round(match.confidence ?? (match.similarity ?? 0) * 100)))

            if (!existing) {
              aggregate.set(match.student_id, {
                studentId: match.student_id,
                name: match.name,
                roll_number: match.roll_number ?? null,
                confidence,
                frameCount: 1,
                bestFrameIndex: group.frameIndex,
              })
              continue
            }

            aggregate.set(match.student_id, {
              ...existing,
              confidence: Math.max(existing.confidence, confidence),
              frameCount: existing.frameCount + 1,
              bestFrameIndex: Math.min(existing.bestFrameIndex, group.frameIndex),
            })
          }
        }

        processedFrames = Math.min(totalFrames, processedFrames + batchPayload.length)
        const progress = Math.min(100, Math.round((processedFrames / totalFrames) * 100))
        setProcessingProgress(progress)
        setScanStatus(
          `Tracing video frames with YOLO... ${progress}% (${processedFrames}/${totalFrames} frames) | Matches: ${aggregate.size}`,
        )

        batchPayload = []
      }

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
        const sampleTime = Math.min(duration, frameIndex * intervalSeconds)
        await seekVideo(video, sampleTime)

        if (video.videoWidth <= 0 || video.videoHeight <= 0) {
          continue
        }

        frameCanvas.width = video.videoWidth
        frameCanvas.height = video.videoHeight
        const context = frameCanvas.getContext('2d')
        if (!context) {
          continue
        }

        context.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height)

        renderProcessedFramePreview({
          canvas: frameCanvas,
          frameIndex,
          processedFrames: frameIndex + 1,
          totalFrames,
          timeSeconds: sampleTime,
        })

        batchPayload.push({
          frameIndex,
          imageBase64: frameCanvas.toDataURL('image/jpeg', 0.88),
        })

        const isBatchReady = batchPayload.length >= YOLO_SERVICE_BATCH_SIZE || frameIndex + 1 === totalFrames
        if (isBatchReady) {
          await flushBatch()
        }
      }

      return Array.from(aggregate.values()).sort((left, right) => right.confidence - left.confidence)
    } finally {
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute('src')
      video.load()
    }
  }

  const processRecordedVideo = async (blob: Blob, roster: EnrolledStudent[] = enrolledStudents) => {
    setIsProcessingVideo(true)
    setProcessingProgress(0)
    setScanStatus('Processing recorded video frame by frame...')

    let objectUrl = ''
    try {
      // Create a temporary video element from the blob
      const loadResult = await createVideoElementFromBlob(blob)
      const tempVideo = loadResult.video
      objectUrl = loadResult.objectUrl

      // Resolve video duration (WebM can report Infinity initially)
      let duration = tempVideo.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        // Seek to a far time to force duration resolution
        try { await seekVideo(tempVideo, 1e9) } catch {}
        duration = tempVideo.duration
        if (!Number.isFinite(duration) || duration <= 0) {
          duration = await resolveVideoDuration(blob)
        }
        try { await seekVideo(tempVideo, 0) } catch {}
      }

      if (!Number.isFinite(duration) || duration <= 0) {
        setError('Video duration could not be resolved. Please record for a few more seconds and try again.')
        return
      }

      setVideoDuration(duration)

      // Build face matcher from enrolled students
      const faceMatcher = faceMatcherRef.current
      if (!faceMatcher) {
        setError('Face matcher is not ready. Please wait for models to load.')
        return
      }

      // Frame-by-frame processing (same approach as the working reference project)
      const FRAME_STEP = 1 / 30 // ~30fps sampling
      const MIN_VOTES = 1
      const frameSamples: number[] = []
      for (let t = 0; t < duration; t += FRAME_STEP) {
        frameSamples.push(Math.min(t, duration))
      }
      const totalFrames = frameSamples.length

      const recognizedById = new Map<string, DetectedStudent>()
      const localVotes = new Map<string, number>()
      const localConfidence = new Map<string, number>()
      let processedFrames = 0

      // Set up the processing canvas
      const frameCanvas = document.createElement('canvas')

      for (const timestamp of frameSamples) {
        // Seek to frame
        await seekVideo(tempVideo, timestamp)

        if (tempVideo.videoWidth <= 0 || tempVideo.videoHeight <= 0) {
          processedFrames++
          continue
        }

        // Draw frame to canvas
        frameCanvas.width = tempVideo.videoWidth
        frameCanvas.height = tempVideo.videoHeight
        const ctx = frameCanvas.getContext('2d')
        if (!ctx) {
          processedFrames++
          continue
        }
        ctx.drawImage(tempVideo, 0, 0, frameCanvas.width, frameCanvas.height)

        // Run face detection with relaxed settings (matching reference project)
        const detections = await faceapi
          .detectAllFaces(frameCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
          .withFaceLandmarks()
          .withFaceDescriptors()

        // Render the current frame to the visible canvas for preview
        if (canvasRef.current && tempVideo.videoWidth > 0) {
          const displayCanvas = canvasRef.current
          displayCanvas.width = tempVideo.videoWidth
          displayCanvas.height = tempVideo.videoHeight
          const displayCtx = displayCanvas.getContext('2d')
          if (displayCtx) {
            displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height)
            displayCtx.drawImage(tempVideo, 0, 0, displayCanvas.width, displayCanvas.height)
            if (detections.length > 0) {
              const displaySize = { width: tempVideo.videoWidth, height: tempVideo.videoHeight }
              faceapi.matchDimensions(displayCanvas, displaySize)
              const resized = faceapi.resizeResults(detections, displaySize)
              faceapi.draw.drawDetections(displayCanvas, resized)
            }
          }
        }

        // Match each detected face against enrolled students
        for (const detection of detections) {
          const bestMatch = faceMatcher.findBestMatch(detection.descriptor)
          if (bestMatch.label === 'unknown') continue

          const matched = enrolledByIdRef.current.get(bestMatch.label)
          if (!matched) continue

          const currentVotes = localVotes.get(matched.id) ?? 0
          const nextVotes = currentVotes + 1
          localVotes.set(matched.id, nextVotes)
          localConfidence.set(
            matched.id,
            Math.max(localConfidence.get(matched.id) ?? 0, distanceToConfidence(bestMatch.distance))
          )

          if (nextVotes >= MIN_VOTES) {
            recognizedById.set(matched.id, {
              id: matched.id,
              name: matched.name,
              roll_number: matched.roll_number,
              confidence: distanceToConfidence(bestMatch.distance),
              timestamp: formatVideoTimestamp(timestamp),
            })
          }
        }

        processedFrames++
        const progress = Math.min(100, Math.round((processedFrames / totalFrames) * 100))
        setProcessingProgress(progress)

        // Update UI every 5 frames or at end
        if (processedFrames === 1 || processedFrames % 5 === 0 || processedFrames === totalFrames) {
          setDetectedStudents(Array.from(recognizedById.values()).slice(0, 120))
          const presentSoFar = Array.from(localVotes.entries()).filter(([, v]) => v >= MIN_VOTES)
          setScanStatus(
            `Tracing video frames... ${progress}% (${processedFrames}/${totalFrames} frames). Matched ${presentSoFar.length} student(s).`
          )
        }
      }

      // Final results
      const presentIds = Array.from(localVotes.entries())
        .filter(([, votes]) => votes >= MIN_VOTES)
        .map(([studentId]) => studentId)

      previewPresentRef.current = new Set(presentIds)
      setPreviewPresentIds(presentIds)
      setDetectedStudents(Array.from(recognizedById.values()).slice(0, 120))
      setScanCompleted(true)
      setProcessingProgress(100)

      if (presentIds.length === 0) {
        setScanStatus('Video processed, but no enrolled faces matched. Check browser console for debug info.')
        console.log('[scanner] No matches found. Debug info:')
        console.log('[scanner]   Enrolled students:', roster.length)
        console.log('[scanner]   Descriptor dims:', roster.map(s => s.descriptor.length))
        console.log('[scanner]   Total frames:', totalFrames)
        console.log('[scanner]   Duration:', duration, 'seconds')
      } else {
        setScanStatus(
          `Video processing complete. Present: ${presentIds.length}, Absent: ${Math.max(allStudents.length - presentIds.length, 0)}`
        )
      }
    } catch (err) {
      console.error('[scanner] recorded video processing error', err)
      setError(err instanceof Error ? err.message : 'Failed to process attendance video')
      setScanStatus('Video processing failed. You can retry the scan.')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
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
          headers: getAuthHeaders(true),
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

    console.log(`[scanner] Session starting: ${availableStudents.length} enrolled students loaded, ${allStudents.length} total students`)
    availableStudents.forEach(s => console.log(`[scanner]   - ${s.name} (${s.id.substring(0,8)}...) descriptor: ${s.descriptor.length}-dim`))

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

  // Check authentication on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const token = window.localStorage.getItem('token')
    if (!token) {
      setError('🔐 Authentication Required: Please login to access the scanner')
      // Don't redirect - just show error in UI
    }
  }, [])

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/'
        await Promise.all([
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
    void fetchStudents()
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      void refreshStudents()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshStudents()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

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
