// lib/biometric/faceDetection.ts
//
// Real-time camera frame face detection and positioning analysis engine.

export type FaceDetectionState =
  | "NO_FACE"
  | "FACE_DETECTED"
  | "MULTIPLE_FACES"
  | "FACE_TOO_FAR"
  | "FACE_TOO_CLOSE"
  | "FACE_NOT_CENTERED"
  | "READY_TO_VERIFY"
  | "VERIFYING"
  | "VERIFIED"
  | "FAILED"

export interface FaceDetectionResult {
  state: FaceDetectionState
  message: string
  confidence: number
  box?: { x: number; y: number; width: number; height: number }
  centroid?: { cx: number; cy: number }
  faceCount: number
}

// Dedicated offscreen canvas for frame pixel processing
let offscreenCanvas: HTMLCanvasElement | null = null
let offscreenCtx: CanvasRenderingContext2D | null = null

function getOffscreenContext(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof window === "undefined") return null
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement("canvas")
    offscreenCanvas.width = 128
    offscreenCanvas.height = 128
    offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true })
  }
  return offscreenCtx ? { canvas: offscreenCanvas, ctx: offscreenCtx } : null
}

/**
 * Inspects the current video frame and determines face presence and positioning.
 */
export async function detectFaceInFrame(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return {
      state: "NO_FACE",
      message: "Waiting for camera video stream…",
      confidence: 0,
      faceCount: 0,
    }
  }

  // 1. Try Native Browser Shape Detection FaceDetector API if present
  if (typeof window !== "undefined" && "FaceDetector" in window) {
    try {
      const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
      const detectedFaces = await detector.detect(video)

      if (detectedFaces && detectedFaces.length > 0) {
        if (detectedFaces.length > 1) {
          return {
            state: "MULTIPLE_FACES",
            message: "Only one person should be visible",
            confidence: 0.95,
            faceCount: detectedFaces.length,
          }
        }

        const face = detectedFaces[0]
        const box = face.boundingBox
        const vW = video.videoWidth
        const vH = video.videoHeight

        const cx = (box.x + box.width / 2) / vW
        const cy = (box.y + box.height / 2) / vH
        const sizeRatio = (box.width * box.height) / (vW * vH)

        if (sizeRatio < 0.12) {
          return {
            state: "FACE_TOO_FAR",
            message: "Move closer",
            confidence: 0.9,
            centroid: { cx, cy },
            faceCount: 1,
          }
        }
        if (sizeRatio > 0.68) {
          return {
            state: "FACE_TOO_CLOSE",
            message: "Move slightly back",
            confidence: 0.9,
            centroid: { cx, cy },
            faceCount: 1,
          }
        }
        if (cx < 0.35 || cx > 0.65 || cy < 0.28 || cy > 0.72) {
          return {
            state: "FACE_NOT_CENTERED",
            message: "Center your face in the frame",
            confidence: 0.9,
            centroid: { cx, cy },
            faceCount: 1,
          }
        }

        return {
          state: "READY_TO_VERIFY",
          message: "Face detected · Ready for verification",
          confidence: 0.98,
          box,
          centroid: { cx, cy },
          faceCount: 1,
        }
      }
    } catch {
      // Fallback to pixel analysis
    }
  }

  // 2. High-speed Canvas Pixel & Luminance Segmentation Analysis
  const offscreen = getOffscreenContext()
  if (!offscreen) {
    return {
      state: "NO_FACE",
      message: "No face detected",
      confidence: 0,
      faceCount: 0,
    }
  }

  const { canvas, ctx } = offscreen
  const W = canvas.width
  const H = canvas.height

  ctx.drawImage(video, 0, 0, W, H)
  const frameData = ctx.getImageData(0, 0, W, H).data

  let skinPixelCount = 0
  let sumX = 0
  let sumY = 0
  let minX = W
  let maxX = 0
  let minY = H
  let maxY = 0

  let leftSideSkin = 0
  let rightSideSkin = 0

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const r = frameData[idx]
      const g = frameData[idx + 1]
      const b = frameData[idx + 2]

      // Chrominance & skin reflectance heuristics in RGB color space
      // Standard normalized skin tone boundary: R > G > B, (R - G) > 12, R > 45
      const isSkin =
        r > 50 &&
        g > 35 &&
        b > 25 &&
        r > g &&
        g > b &&
        r - g >= 12 &&
        Math.abs(r - g) <= 120

      if (isSkin) {
        skinPixelCount++
        sumX += x
        sumY += y
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y

        if (x < W * 0.4) leftSideSkin++
        if (x > W * 0.6) rightSideSkin++
      }
    }
  }

  const totalPixels = W * H
  const skinRatio = skinPixelCount / totalPixels

  // Threshold 1: No Face (Insufficient human skin pixels)
  if (skinRatio < 0.07) {
    return {
      state: "NO_FACE",
      message: "No face detected",
      confidence: 0.1,
      faceCount: 0,
    }
  }

  // Threshold 2: Multiple Faces (Large disconnected clusters on far left AND far right)
  if (leftSideSkin > totalPixels * 0.14 && rightSideSkin > totalPixels * 0.14) {
    return {
      state: "MULTIPLE_FACES",
      message: "Only one person should be visible",
      confidence: 0.85,
      faceCount: 2,
    }
  }

  const cx = sumX / (skinPixelCount * W)
  const cy = sumY / (skinPixelCount * H)

  // Threshold 3: Face Too Far
  if (skinRatio < 0.14) {
    return {
      state: "FACE_TOO_FAR",
      message: "Move closer",
      confidence: 0.75,
      centroid: { cx, cy },
      faceCount: 1,
    }
  }

  // Threshold 4: Face Too Close
  if (skinRatio > 0.65) {
    return {
      state: "FACE_TOO_CLOSE",
      message: "Move slightly back",
      confidence: 0.85,
      centroid: { cx, cy },
      faceCount: 1,
    }
  }

  // Threshold 5: Face Not Centered (Center range: 34% to 66%)
  if (cx < 0.33 || cx > 0.67 || cy < 0.25 || cy > 0.75) {
    return {
      state: "FACE_NOT_CENTERED",
      message: "Center your face in the frame",
      confidence: 0.8,
      centroid: { cx, cy },
      faceCount: 1,
    }
  }

  // Threshold 6: Valid Centered Face Ready for Biometric Verification
  return {
    state: "READY_TO_VERIFY",
    message: "Face detected · Ready for biometric verification",
    confidence: 0.94,
    centroid: { cx, cy },
    faceCount: 1,
    box: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  }
}
