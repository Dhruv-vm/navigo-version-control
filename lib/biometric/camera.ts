// lib/biometric/camera.ts
//
// Production-grade camera device controller & lifecycle manager for Navigo Smart Boarding.

export type CameraStatus =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "PERMISSION_GRANTED"
  | "PERMISSION_DENIED"
  | "CAMERA_UNAVAILABLE"
  | "CAMERA_ACTIVE"
  | "CAMERA_ERROR"
  | "NO_CAMERA"

export interface CameraConfig {
  facingMode?: "user" | "environment"
  idealWidth?: number
  idealHeight?: number
}

export async function requestCameraStream(
  config: CameraConfig = {}
): Promise<{ stream: MediaStream | null; status: CameraStatus; error?: string }> {
  if (typeof window === "undefined" || !navigator?.mediaDevices) {
    return {
      stream: null,
      status: "CAMERA_UNAVAILABLE",
      error: "MediaDevices API not supported in this browser environment.",
    }
  }

  const { facingMode = "user", idealWidth = 640, idealHeight = 640 } = config

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter((d) => d.kind === "videoinput")

    if (videoDevices.length === 0) {
      return {
        stream: null,
        status: "NO_CAMERA",
        error: "No video input camera detected on this device.",
      }
    }

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode,
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
      },
      audio: false,
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return {
      stream,
      status: "CAMERA_ACTIVE",
    }
  } catch (err: any) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return {
        stream: null,
        status: "PERMISSION_DENIED",
        error: "Camera access was denied by user.",
      }
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return {
        stream: null,
        status: "NO_CAMERA",
        error: "No video camera device was found.",
      }
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return {
        stream: null,
        status: "CAMERA_UNAVAILABLE",
        error: "Camera is currently locked or in use by another application.",
      }
    }
    return {
      stream: null,
      status: "CAMERA_ERROR",
      error: err.message || "Unknown camera access failure.",
    }
  }
}

export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return
  try {
    stream.getTracks().forEach((track) => {
      track.stop()
    })
  } catch (err) {
    console.warn("Failed to cleanly stop media track:", err)
  }
}
