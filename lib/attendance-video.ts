'use client'

import * as faceapi from 'face-api.js'

export type EnrolledFace = {
  id: string
  name: string
  enrollment_number?: string | null
  descriptor: Float32Array
}

export type VideoRecognitionMatch = {
  studentId: string
  name: string
  enrollment_number: string | null
  confidence: number
  frameCount: number
  bestFrameIndex: number
}

export type VideoFramePreview = {
  canvas: HTMLCanvasElement
  frameIndex: number
  processedFrames: number
  totalFrames: number
  timeSeconds: number
}

type FrameCandidate = {
  descriptor: Float32Array
  confidence: number
  boxArea: number
  frameIndex: number
}

type VideoRecognitionOptions = {
  targetFps?: number
  durationHintSeconds?: number
  frameStride?: number
  minDetectionScore?: number
  minBoxRatio?: number
  duplicateSimilarityThreshold?: number
  minBlurScore?: number
  detectorType?: 'tiny' | 'ssd'
  onStatus?: (message: string) => void
  onProgress?: (progress: number, processedFrames: number, totalFrames: number) => void
  onFramePreview?: (frame: VideoFramePreview) => void
}

const DEFAULT_OPTIONS: Required<Omit<VideoRecognitionOptions, 'onStatus' | 'onProgress' | 'onFramePreview'>> = {
  targetFps: 30,
  durationHintSeconds: 0,
  frameStride: 1,
  minDetectionScore: 0.40,
  minBoxRatio: 0.001,
  duplicateSimilarityThreshold: 0.95,
  minBlurScore: 0.1,
  detectorType: 'ssd', 
}

const MIN_FACE_AREA = 8000

const cosineSimilarity = (left: Float32Array, right: Float32Array) => {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }
  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

const waitForEvent = (target: HTMLVideoElement, eventName: 'loadedmetadata' | 'seeked' | 'ended') => {
  return new Promise<void>((resolve, reject) => {
    const handleResolve = () => { cleanup(); resolve(); }
    const handleError = () => { cleanup(); reject(new Error(`Video failed while waiting for ${eventName}`)); }
    const cleanup = () => {
      target.removeEventListener(eventName, handleResolve)
      target.removeEventListener('error', handleError)
    }
    target.addEventListener(eventName, handleResolve, { once: true })
    target.addEventListener('error', handleError, { once: true })
  })
}

const createVideoElementFromBlob = async (blob: Blob) => {
  const objectUrl = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.src = objectUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  await waitForEvent(video, 'loadedmetadata')
  video.pause()
  return { video, objectUrl }
}

const seekVideo = async (video: HTMLVideoElement, timeSeconds: number) => {
  const safeTime = Math.max(0, Math.min(timeSeconds, Math.max(0, video.duration - 0.05)))
  if (Math.abs(video.currentTime - safeTime) < 0.02) return
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); }
    const onError = () => { cleanup(); reject(new Error('Unable to seek recorded video')); }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = safeTime
  })
}

const calculateCandidateScore = (candidate: FrameCandidate) => {
  return candidate.confidence * 0.7 + (candidate.boxArea / 100000) * 0.3
}

const toPositiveFinite = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0
}

const processFrameCanvas = async (
  canvas: HTMLCanvasElement,
  frameIndex: number,
  enrolledStudents: EnrolledFace[],
  faceMatcher: faceapi.FaceMatcher,
  mergedOptions: Required<Omit<VideoRecognitionOptions, 'onStatus' | 'onProgress' | 'onFramePreview'>>,
  uniqueCandidates: FrameCandidate[],
) => {
  const detectorOptions = mergedOptions.detectorType === 'ssd' 
    ? new faceapi.SsdMobilenetv1Options({ minConfidence: mergedOptions.minDetectionScore })
    : new faceapi.TinyFaceDetectorOptions({ inputSize: 640, scoreThreshold: mergedOptions.minDetectionScore })

  const detections = await faceapi
    .detectAllFaces(canvas, detectorOptions as any)
    .withFaceLandmarks()
    .withFaceDescriptors()

  if (detections.length === 0) return

  for (const detection of detections) {
    const detectionScore = detection.detection.score
    const box = detection.detection.box
    const faceArea = Math.round(box.width * box.height)

    if (faceArea < MIN_FACE_AREA) continue
    if (detectionScore < mergedOptions.minDetectionScore) continue

    const candidate: FrameCandidate = {
      descriptor: detection.descriptor,
      confidence: detectionScore,
      boxArea: faceArea,
      frameIndex,
    }

    const existingIndex = uniqueCandidates.findIndex(
      (current) => cosineSimilarity(current.descriptor, candidate.descriptor) >= mergedOptions.duplicateSimilarityThreshold,
    )

    if (existingIndex === -1) {
      uniqueCandidates.push(candidate)
    } else {
      const currentCandidate = uniqueCandidates[existingIndex]
      if (calculateCandidateScore(candidate) > calculateCandidateScore(currentCandidate)) {
        uniqueCandidates[existingIndex] = candidate
      }
    }
  }
}

const analyzeWithFrameCallbacks = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  enrolledStudents: EnrolledFace[],
  faceMatcher: faceapi.FaceMatcher,
  mergedOptions: Required<Omit<VideoRecognitionOptions, 'onStatus' | 'onProgress' | 'onFramePreview'>>,
  uniqueCandidates: FrameCandidate[],
  onProgress?: (progress: number, processedFrames: number, totalFrames: number) => void,
  onFramePreview?: (frame: VideoFramePreview) => void,
) => {
  const frameCallback = (video as HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number
  }).requestVideoFrameCallback

  if (typeof frameCallback !== 'function') return false

  await video.play()
  let callbackFrameIndex = 0
  let processedFrames = 0
  const estimatedDuration = Math.max(toPositiveFinite(video.duration), toPositiveFinite(mergedOptions.durationHintSeconds))
  const frameStride = Math.max(1, mergedOptions.frameStride)
  const estimatedTotalFrames = Math.max(1, Math.ceil((estimatedDuration * mergedOptions.targetFps) / frameStride))
  const knownEndTime = video.duration > 0 ? Math.max(0, video.duration - 0.01) : Number.POSITIVE_INFINITY

  await new Promise<void>((resolve, reject) => {
    let isResolved = false
    const safeResolve = () => {
      if (!isResolved) {
        isResolved = true
        video.onended = null; video.onerror = null;
        resolve()
      }
    }
    video.onended = safeResolve
    video.onerror = (e) => { if (!isResolved) { isResolved = true; reject(e); } }

    const scheduleNext = () => {
      if (isResolved) return
      frameCallback.call(video, async (_now, metadata) => {
        try {
          if (video.ended || metadata.mediaTime >= knownEndTime) { safeResolve(); return; }
          if (video.videoWidth > 0 && video.videoHeight > 0 && callbackFrameIndex % frameStride === 0) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (context) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height)
              await processFrameCanvas(canvas, callbackFrameIndex, enrolledStudents, faceMatcher, mergedOptions, uniqueCandidates)
              processedFrames += 1
              const progress = Math.min(100, Math.round((processedFrames / Math.max(estimatedTotalFrames, processedFrames)) * 100))
              onProgress?.(progress, processedFrames, Math.max(estimatedTotalFrames, processedFrames))
              onFramePreview?.({ canvas, frameIndex: callbackFrameIndex, processedFrames, totalFrames: Math.max(estimatedTotalFrames, processedFrames), timeSeconds: metadata.mediaTime })
            }
          }
          callbackFrameIndex += 1
          scheduleNext()
        } catch (error) { reject(error) }
      })
    }
    scheduleNext()
  })
  return true
}

const analyzeWithSeekFallback = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  enrolledStudents: EnrolledFace[],
  faceMatcher: faceapi.FaceMatcher,
  mergedOptions: Required<Omit<VideoRecognitionOptions, 'onStatus' | 'onProgress' | 'onFramePreview'>>,
  uniqueCandidates: FrameCandidate[],
  onProgress?: (progress: number, processedFrames: number, totalFrames: number) => void,
  onFramePreview?: (frame: VideoFramePreview) => void,
) => {
  const targetFrameIntervalMs = Math.max(1000 / mergedOptions.targetFps, 1)
  const duration = Math.max(toPositiveFinite(video.duration), toPositiveFinite(mergedOptions.durationHintSeconds))
  const frameStride = Math.max(1, mergedOptions.frameStride)
  const rawFrameCount = duration > 0 ? Math.max(1, Math.ceil((duration * 1000) / targetFrameIntervalMs)) : 1
  const totalFrames = Math.max(1, Math.ceil(rawFrameCount / frameStride))

  let processedFrames = 0
  for (let frameIndex = 0; frameIndex < rawFrameCount; frameIndex += frameStride) {
    const sampleTime = Math.min(duration, (frameIndex * targetFrameIntervalMs) / 1000)
    await seekVideo(video, sampleTime)
    if (video.videoWidth === 0 || video.videoHeight === 0) continue
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d')
    if (!context) continue
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    await processFrameCanvas(canvas, frameIndex, enrolledStudents, faceMatcher, mergedOptions, uniqueCandidates)
    processedFrames += 1
    const progress = Math.min(100, Math.round((processedFrames / totalFrames) * 100))
    onProgress?.(progress, processedFrames, totalFrames)
    onFramePreview?.({ canvas, frameIndex, processedFrames, totalFrames, timeSeconds: sampleTime })
  }
}

export async function analyzeAttendanceVideo(
  blob: Blob,
  enrolledStudents: EnrolledFace[],
  options: VideoRecognitionOptions = {},
): Promise<VideoRecognitionMatch[]> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const { video, objectUrl } = await createVideoElementFromBlob(blob)
  const hiddenCanvas = document.createElement('canvas')

  try {
    const labeledDescriptors = enrolledStudents
      .filter((student) => student.descriptor.length === 128)
      .map((student) => new faceapi.LabeledFaceDescriptors(student.id, [student.descriptor]))

    if (labeledDescriptors.length === 0) {
      options.onStatus?.('No compatible (128-d) face embeddings found.')
      return []
    }

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.75)
    const uniqueCandidates: FrameCandidate[] = []
    options.onStatus?.('Analyzing recorded video frame by frame...')

    const usedFrameCallbacks = await analyzeWithFrameCallbacks(video, hiddenCanvas, enrolledStudents, faceMatcher, mergedOptions, uniqueCandidates, options.onProgress, options.onFramePreview)

    if (!usedFrameCallbacks) {
      options.onStatus?.('Falling back to frame extraction...')
      await analyzeWithSeekFallback(video, hiddenCanvas, enrolledStudents, faceMatcher, mergedOptions, uniqueCandidates, options.onProgress, options.onFramePreview)
    }
    
    const recognized = new Map<string, VideoRecognitionMatch>()
    uniqueCandidates.forEach((candidate) => {
      if (candidate.descriptor.length !== 128) return
      const bestMatch = faceMatcher.findBestMatch(candidate.descriptor)
      if (bestMatch.label === 'unknown') return
      const student = enrolledStudents.find((item) => item.id === bestMatch.label)
      if (!student) return

      const confidence = Math.max(0, Math.min(100, Math.round((1 - bestMatch.distance) * 100)))
      const existing = recognized.get(student.id)
      if (!existing) {
        recognized.set(student.id, {
          studentId: student.id,
          name: student.name,
          enrollment_number: student.enrollment_number ?? null,
          confidence,
          frameCount: 1,
          bestFrameIndex: candidate.frameIndex,
        })
      } else {
        recognized.set(student.id, {
          ...existing,
          confidence: Math.max(existing.confidence, confidence),
          frameCount: existing.frameCount + 1,
          bestFrameIndex: Math.min(existing.bestFrameIndex, candidate.frameIndex),
        })
      }
    })

    const confirmed = Array.from(recognized.values())
      .filter((match) => match.frameCount >= 1)
      .sort((left, right) => right.confidence - left.confidence)

    if (confirmed.length > 0) {
      options.onStatus?.(`Recognition success! Found ${confirmed.length} student(s).`)
    } else {
      options.onStatus?.('No students recognized.')
    }

    return confirmed
  } finally {
    URL.revokeObjectURL(objectUrl)
    video.removeAttribute('src')
    video.load()
  }
}