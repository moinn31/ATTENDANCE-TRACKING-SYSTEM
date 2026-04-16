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

type FrameCandidate = {
  descriptor: Float32Array
  confidence: number
  boxRatio: number
  blurScore: number
  frameIndex: number
}

type VideoRecognitionOptions = {
  sampleIntervalMs?: number
  minDetectionScore?: number
  minBoxRatio?: number
  duplicateSimilarityThreshold?: number
  minBlurScore?: number
  onStatus?: (message: string) => void
}

const DEFAULT_OPTIONS: Required<Omit<VideoRecognitionOptions, 'onStatus'>> = {
  sampleIntervalMs: 350,
  minDetectionScore: 0.72,
  minBoxRatio: 0.08,
  duplicateSimilarityThreshold: 0.92,
  minBlurScore: 8,
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

const waitForEvent = (target: HTMLVideoElement, eventName: 'loadedmetadata' | 'seeked') => {
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
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.62)

    const uniqueCandidates: FrameCandidate[] = []
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
    const totalFrames = duration > 0 ? Math.max(1, Math.ceil((duration * 1000) / mergedOptions.sampleIntervalMs)) : 0

    options.onStatus?.('Analyzing recorded video frame by frame...')

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const sampleTime = Math.min(duration, (frameIndex * mergedOptions.sampleIntervalMs) / 1000)
      await seekVideo(video, sampleTime)

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        continue
      }

      hiddenCanvas.width = video.videoWidth
      hiddenCanvas.height = video.videoHeight
      const context = hiddenCanvas.getContext('2d')
      if (!context) {
        continue
      }

      context.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height)

      const detections = await faceapi
        .detectAllFaces(
          hiddenCanvas,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 512,
            scoreThreshold: mergedOptions.minDetectionScore,
          }),
        )
        .withFaceLandmarks()
        .withFaceDescriptors()

      if (detections.length === 0) {
        continue
      }

      for (const detection of detections) {
        const detectionScore = detection.detection.score
        const box = detection.detection.box
        const boxRatio = (box.width * box.height) / (hiddenCanvas.width * hiddenCanvas.height)

        if (detectionScore < mergedOptions.minDetectionScore) {
          continue
        }

        if (boxRatio < mergedOptions.minBoxRatio) {
          continue
        }

        const blurScore = estimateBlurScore(hiddenCanvas, box)
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