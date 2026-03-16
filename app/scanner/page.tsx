'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as faceapi from 'face-api.js'
import { createClient } from '@/lib/supabase/client'
import { isMissingSessionError } from '@/lib/supabase/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

export default function ScannerPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const previewPresentRef = useRef<Set<string>>(new Set())
  const candidateVotesRef = useRef<Map<string, number>>(new Map())
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null)
  const enrolledByIdRef = useRef<Map<string, EnrolledStudent>>(new Map())
  const detectionInFlightRef = useRef(false)
  // Refs that mirror state so the detection interval (stale closure) always reads current values
  const sessionActiveRef = useRef(false)
  const modelsLoadedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
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
  const [error, setError] = useState<string | null>(null)

  const getLocalDate = () => {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return local.toISOString().split('T')[0]
  }

  useEffect(() => {
    setAttendanceDate(getLocalDate())
  }, [])

  const parseDescriptor = (serialized: string | null | undefined): Float32Array | null => {
    if (!serialized) return null
    try {
      const parsed = JSON.parse(serialized)
      if (!Array.isArray(parsed) || parsed.length === 0) return null
      const numeric = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      if (numeric.length === 0) return null
      return new Float32Array(numeric)
    } catch {
      return null
    }
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      })

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }

      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraActive(true)
      setError(null)
      return true
    } catch (err) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        })

        if (!videoRef.current) {
          fallbackStream.getTracks().forEach((track) => track.stop())
          return false
        }

        videoRef.current.srcObject = fallbackStream
        await videoRef.current.play()
        setCameraActive(true)
        setError(null)
        return true
      } catch {
        console.error('[scanner] camera error', err)
        setError('Failed to access camera. Allow camera permissions and try again.')
        return false
      }
    }
  }

  const fetchStudents = async () => {
    try {
      const response = await fetch('/api/students?includeEmbeddings=true', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) {
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
    } catch (err) {
      console.error('[scanner] students fetch error', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch students')
    }
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

      // inputSize 320 + lower scoreThreshold handles backlit / low-contrast faces better
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
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
        if (bestMatch.label === 'unknown') {
          continue
        }

        const matched = enrolledByIdRef.current.get(bestMatch.label)
        if (!matched) {
          continue
        }

        const currentVotes = candidateVotesRef.current.get(matched.id) ?? 0
        candidateVotesRef.current.set(matched.id, currentVotes + 1)

        // Require at least two positive frames before marking present preview.
        if ((candidateVotesRef.current.get(matched.id) ?? 0) < 2) {
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
        setScanStatus(`Detected ${detections.length} face(s), searching for enrolled match...`)
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

  const startAttendanceSession = async () => {
    if (!modelsLoaded) {
      setError('Face models are still loading. Please wait.')
      return
    }

    if (enrolledStudents.length === 0) {
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
    sessionActiveRef.current = true
    setSessionActive(true)
    setAttendanceSaved(false)
    setScanCompleted(false)
    setDetectedStudents([])
    candidateVotesRef.current = new Map()
    previewPresentRef.current = new Set()
    setPreviewPresentIds([])
    setScanStatus('Scanning started. Faces will be matched in real time. Stop scan when done.')

    startDetectionLoop()
  }

  const stopAttendanceSession = () => {
    sessionActiveRef.current = false
    setSessionActive(false)
    stopCamera()
    setScanCompleted(true)
    setScanStatus('Scanning stopped. Review the attendance preview below. Toggle any corrections, then click Save Attendance.')
  }

  const clearPreview = () => {
    candidateVotesRef.current = new Map()
    previewPresentRef.current = new Set()
    setPreviewPresentIds([])
    setDetectedStudents([])
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
      setScanStatus('All saved attendance data has been cleared from database.')
    } catch (err) {
      console.error('[scanner] clear saved attendance error', err)
      setError(err instanceof Error ? err.message : 'Failed to clear attendance data')
    } finally {
      setIsSaving(false)
    }
  }

  const saveAttendance = async () => {
    if (!attendanceDate || !className.trim() || !subjectName.trim()) {
      setError('Class, subject and date are required before saving.')
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
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error && !isMissingSessionError(error.message)) {
          await supabase.auth.signOut()
          setLoading(false)
          router.replace('/auth/login')
          return
        }

        if (!user) {
          setLoading(false)
          router.replace('/auth/login')
          return
        }

        setLoading(false)
      } catch {
        await supabase.auth.signOut()
        setLoading(false)
        router.replace('/auth/login')
      }
    }

    void getUser()
  }, [router, supabase])

  useEffect(() => {
    if (!loading) {
      void fetchStudents()
    }
  }, [loading])

  useEffect(() => {
    if (enrolledStudents.length === 0) {
      faceMatcherRef.current = null
      enrolledByIdRef.current = new Map()
      return
    }

    const labeledDescriptors = enrolledStudents.map(
      (student) => new faceapi.LabeledFaceDescriptors(student.id, [student.descriptor]),
    )
    faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.55)
    enrolledByIdRef.current = new Map(enrolledStudents.map((student) => [student.id, student]))
  }, [enrolledStudents])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const presentCount = previewPresentIds.length
  const unmatchedCount = Math.max(allStudents.length - presentCount, 0)
  const isResultFinalized = scanCompleted || attendanceSaved
  const secondMetricCount = isResultFinalized || sessionActive ? unmatchedCount : 0
  const absentCount = isResultFinalized ? unmatchedCount : 0
  const previewPresentSet = useMemo(() => new Set(previewPresentIds), [previewPresentIds])

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
          <h1 className="text-3xl font-bold text-foreground">Smart Attendance Scanner</h1>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class" />
          <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Subject" />
          <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
          {!sessionActive ? (
            <Button onClick={startAttendanceSession} disabled={!modelsLoaded || isSaving}>Start Scan</Button>
          ) : (
            <Button variant="destructive" onClick={stopAttendanceSession} disabled={isSaving}>
              Stop Scan
            </Button>
          )}
          <div className="flex gap-2">
            <Button onClick={saveAttendance} disabled={sessionActive || isSaving || attendanceSaved || !scanCompleted} className="flex-1">
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </Button>
            <Button variant="outline" onClick={clearPreview} disabled={sessionActive || isSaving}>Clear</Button>
          </div>
        </div>

        <div className="mb-4">
          <Button variant="destructive" onClick={clearSavedAttendance} disabled={sessionActive || isSaving}>
            Clear All Saved Attendance Data
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 rounded border bg-card">
            <p className="text-xs text-muted-foreground">Session</p>
            <p className="text-sm font-medium text-foreground">{sessionActive ? 'Running' : 'Stopped'}</p>
          </div>
          <div className="p-3 rounded border bg-green-50 border-green-300">
            <p className="text-xs text-muted-foreground">{attendanceSaved ? 'Present (Saved)' : scanCompleted ? 'Present (Preview)' : 'Detected'}</p>
            <p className="text-sm font-semibold text-green-700">{presentCount}</p>
          </div>
          <div className="p-3 rounded border bg-red-50 border-red-300">
            <p className="text-xs text-muted-foreground">{attendanceSaved ? 'Absent (Saved)' : scanCompleted ? 'Absent (Preview)' : 'Not yet seen'}</p>
            <p className="text-sm font-semibold text-red-700">{secondMetricCount}</p>
          </div>
          <div className="p-3 rounded border bg-card">
            <p className="text-xs text-muted-foreground">Last Scan</p>
            <p className="text-sm font-medium text-foreground">{lastScanAt || '-'}</p>
          </div>
        </div>

        <div className="mb-4 p-3 rounded border bg-card">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium text-foreground">{scanStatus}</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            {error}
          </div>
        )}

        {!modelsLoaded && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-700">
            Loading recognition models...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
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
                  className={`absolute inset-0 w-full h-full ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-muted-foreground">Camera is off. Click Start Scan.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Recognized Students (Preview)</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {detectedStudents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No matched students yet</p>
              ) : (
                detectedStudents.map((student) => (
                  <div key={student.id} className="p-3 bg-green-50 border border-green-300 rounded">
                    <p className="font-medium text-green-900">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.roll_number || '-'}</p>
                    <p className="text-xs text-muted-foreground">{student.timestamp}</p>
                    <p className="text-xs font-semibold text-green-700 mt-1">PRESENT PREVIEW ({student.confidence}%)</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Attendance Preview</h2>
          {!sessionActive && !scanCompleted && !attendanceSaved ? (
            <p className="text-sm text-muted-foreground">Start scan to begin attendance. After scanning, you can review and edit before saving.</p>
          ) : sessionActive ? (
            <div>
              <p className="text-sm text-blue-700 font-medium mb-3">Scanning in progress — {presentCount} face(s) recognised so far. Stop scan to review.</p>
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
      </div>
    </main>
  )
}
