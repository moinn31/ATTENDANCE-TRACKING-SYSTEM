'use client'

import * as faceapi from 'face-api.js'

export type EnrolledFace = {
  id: string
  name: string
  roll_number?: string | null
  descriptor: Float32Array
}

export type VideoRecognitionMatch = {
  studentId: string
  name: string
  roll_number: string | null
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
  boxRatio: number
  blurScore: number
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
  onStatus?: (message: string) => void
  onProgress?: (progress: number, processedFrames: number, totalFrames: number) => void
  onFramePreview?: (frame: VideoFramePreview) => void
}

const DEFAULT_OPTIONS: Required<Omit<VideoRecognitionOptions, 'onStatus' | 'onProgress' | 'onFramePreview'>> = {
  targetFps: 30,
  durationHintSeconds: 0,
  frameStride: 1,
  minDetectionScore: 0.10,
  minBoxRatio: 0.005,
  duplicateSimilarityThreshold: 0.95,
  minBlurScore: 0.5,
}

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

  if (leftNorm === 0 || rightNorm === 0) {
    return 0
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

const waitForEvent = (target: HTMLVideoElement, eventName: 'loadedmetadata' | 'seeked' | 'ended') => {
  return new Promise<void>((resolve, reject) => {
    const handleResolve = () => {
      cleanup()
      resolve()
    }

    const handleError = () => {
      cleanup()
      reject(new Error(`Video failed while waiting for ${eventName}`))
    }

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

  return {
    video,
    objectUrl,
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

const estimateBlurScore = (canvas: HTMLCanvasElement, box: faceapi.Box) => {
  const cropCanvas = document.createElement('canvas')
  const cropSize = 24
  cropCanvas.width = cropSize
  cropCanvas.height = cropSize

  const context = cropCanvas.getContext('2d')
  if (!context) {
    return 0
  }

  const safeX = Math.max(0, box.x)
  const safeY = Math.max(0, box.y)
  const safeWidth = Math.max(1, Math.min(box.width, canvas.width - safeX))
  const safeHeight = Math.max(1, Math.min(box.height, canvas.height - safeY))

  context.drawImage(canvas, safeX, safeY, safeWidth, safeHeight, 0, 0, cropSize, cropSize)
  const imageData = context.getImageData(0, 0, cropSize, cropSize).data

  let sum = 0
  let sumSquared = 0
  let count = 0

  for (let index = 0; index < imageData.length; index += 16) {
    const red = imageData[index] ?? 0
    const green = imageData[index + 1] ?? 0
    const blue = imageData[index + 2] ?? 0
    const grayscale = 0.299 * red + 0.587 * green + 0.114 * blue
    sum += grayscale
    sumSquared += grayscale * grayscale
    count += 1
  }

  if (count === 0) {
    return 0
  }

  const mean = sum / count
  return Math.max(0, sumSquared / count - mean * mean)
}

const calculateCandidateScore = (candidate: FrameCandidate) => {
  const normalizedBlur = Math.min(candidate.blurScore, 120) / 120
  return candidate.confidence * 0.55 + candidate.boxRatio * 100 * 0.25 + normalizedBlur * 100 * 0.2
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
  mergedOptions: Required<Omit<VideoRecognitionOptions, 'onStatus' | 'onProgress'>>,
  uniqueCandidates: FrameCandidate[],
) => {
  const detections = await faceapi
    .detectAllFaces(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: mergedOptions.minDetectionScore,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors()

  if (detections.length === 0) {
    return
  }

  for (const detection of detections) {
    const detectionScore = detection.detection.score
    const box = detection.detection.box
    const boxRatio = (box.width * box.height) / (canvas.width * canvas.height)

    if (detectionScore < mergedOptions.minDetectionScore) {
      continue
    }

    if (boxRatio < mergedOptions.minBoxRatio) {
      continue
    }

    const blurScore = estimateBlurScore(canvas, box)
    if (blurScore < mergedOptions.minBlurScore) {
      continue
    }

    const candidate: FrameCandidate = {
      descriptor: detection.descriptor,
      confidence: detectionScore,
      boxRatio,
      blurScore,
      frameIndex,
    }

    const existingIndex = uniqueCandidates.findIndex(
      (current) => cosineSimilarity(current.descriptor, candidate.descriptor) >= mergedOptions.duplicateSimilarityThreshold,
    )

    if (existingIndex === -1) {
      uniqueCandidates.push(candidate)
      continue
    }

    const currentCandidate = uniqueCandidates[existingIndex]
    if (calculateCandidateScore(candidate) > calculateCandidateScore(currentCandidate)) {
      uniqueCandidates[existingIndex] = candidate
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

  if (typeof frameCallback !== 'function') {
    return false
  }

  await video.play()
  let callbackFrameIndex = 0
  let processedFrames = 0
  const knownDuration = toPositiveFinite(video.duration)
  const hintedDuration = toPositiveFinite(mergedOptions.durationHintSeconds)
  const estimatedDuration = Math.max(knownDuration, hintedDuration)
  const frameStride = Math.max(1, mergedOptions.frameStride)
  const estimatedRawFrames = Math.max(1, Math.ceil(estimatedDuration * mergedOptions.targetFps))
  const estimatedTotalFrames = Math.max(1, Math.ceil(estimatedRawFrames / frameStride))
  const knownEndTime = knownDuration > 0 ? Math.max(0, knownDuration - 0.01) : Number.POSITIVE_INFINITY

  await new Promise<void>((resolve, reject) => {
    const scheduleNext = () => {
      frameCallback.call(video, async (_now, metadata) => {
        try {
          if (video.ended || metadata.mediaTime >= knownEndTime) {
            resolve()
            return
          }

          if (video.videoWidth > 0 && video.videoHeight > 0 && callbackFrameIndex % frameStride === 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const context = canvas.getContext('2d')
            if (context) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height)
              await processFrameCanvas(
                canvas,
                callbackFrameIndex,
                enrolledStudents,
                faceMatcher,
                mergedOptions,
                uniqueCandidates,
              )
              processedFrames += 1
              const dynamicTotalFrames = Math.max(estimatedTotalFrames, processedFrames)
              const progress = Math.min(100, Math.round((processedFrames / dynamicTotalFrames) * 100))
              onProgress?.(progress, processedFrames, dynamicTotalFrames)
              onFramePreview?.({
                canvas,
                frameIndex: callbackFrameIndex,
                processedFrames,
                totalFrames: dynamicTotalFrames,
                timeSeconds: metadata.mediaTime,
              })
            }
          }

          callbackFrameIndex += 1

          scheduleNext()
        } catch (error) {
          reject(error)
        }
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
  for (let frameIndex = 0; frameIndex < rawFrameCount; frameIndex += 1) {
    if (frameIndex % frameStride !== 0) {
      continue
    }

    const sampleTime = Math.min(duration, (frameIndex * targetFrameIntervalMs) / 1000)
    await seekVideo(video, sampleTime)

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      continue
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      continue
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    await processFrameCanvas(canvas, frameIndex, enrolledStudents, faceMatcher, mergedOptions, uniqueCandidates)
    processedFrames += 1
    const progress = Math.min(100, Math.round((processedFrames / totalFrames) * 100))
    onProgress?.(progress, processedFrames, totalFrames)
    onFramePreview?.({
      canvas,
      frameIndex,
      processedFrames,
      totalFrames,
      timeSeconds: sampleTime,
    })
  }
}

export async function analyzeAttendanceVideo(
  blob: Blob,
  enrolledStudents: EnrolledFace[],
  options: VideoRecognitionOptions = {},
): Promise<VideoRecognitionMatch[]> {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  const { video, objectUrl } = await createVideoElementFromBlob(blob)
  const hiddenCanvas = document.createElement('canvas')

  try {
    const labeledDescriptors = enrolledStudents.map(
      (student) => new faceapi.LabeledFaceDescriptors(student.id, [student.descriptor]),
    )
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.65)

    const uniqueCandidates: FrameCandidate[] = []

    options.onStatus?.('Analyzing recorded video frame by frame at native frame rate...')

    const usedFrameCallbacks = await analyzeWithFrameCallbacks(
      video,
      hiddenCanvas,
      enrolledStudents,
      faceMatcher,
      mergedOptions,
      uniqueCandidates,
      options.onProgress,
      options.onFramePreview,
    )

    if (!usedFrameCallbacks) {
      options.onStatus?.(`Video callback unavailable, falling back to ${mergedOptions.targetFps}fps frame extraction...`)
      await analyzeWithSeekFallback(
        video,
        hiddenCanvas,
        enrolledStudents,
        faceMatcher,
        mergedOptions,
        uniqueCandidates,
        options.onProgress,
        options.onFramePreview,
      )
    }

    const recognized = new Map<string, VideoRecognitionMatch>()

    uniqueCandidates.forEach((candidate) => {
      const bestMatch = faceMatcher.findBestMatch(candidate.descriptor)
      if (bestMatch.label === 'unknown') {
        return
      }

      const student = enrolledStudents.find((item) => item.id === bestMatch.label)
      if (!student) {
        return
      }

      const confidence = Math.max(0, Math.min(100, Math.round((1 - bestMatch.distance / 1.2) * 100)))
      const existing = recognized.get(student.id)

      if (!existing) {
        recognized.set(student.id, {
          studentId: student.id,
          name: student.name,
          roll_number: student.roll_number ?? null,
          confidence,
          frameCount: 1,
          bestFrameIndex: candidate.frameIndex,
        })
        return
      }

      recognized.set(student.id, {
        ...existing,
        confidence: Math.max(existing.confidence, confidence),
        frameCount: existing.frameCount + 1,
        bestFrameIndex: Math.min(existing.bestFrameIndex, candidate.frameIndex),
      })
    })

    return Array.from(recognized.values()).sort((left, right) => right.confidence - left.confidence)
  } finally {
    URL.revokeObjectURL(objectUrl)
    video.removeAttribute('src')
    video.load()
  }
}