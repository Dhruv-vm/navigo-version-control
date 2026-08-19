// lib/biometric/provider.ts
//
// Clean Biometric Provider interface connecting camera, face detection, and identity verification.

import { requestCameraStream, stopCameraStream, type CameraStatus } from "./camera"
import { detectFaceInFrame, type FaceDetectionResult, type FaceDetectionState } from "./faceDetection"
import { extractEmbeddingFromVideo, computeCosineSimilarity } from "./faceVerification"

export interface IFaceBiometricProvider {
  startCamera(): Promise<{ stream: MediaStream | null; status: CameraStatus; error?: string }>
  stopCamera(stream: MediaStream | null): void
  detectFace(video: HTMLVideoElement): Promise<FaceDetectionResult>
  createBiometricProfile(video: HTMLVideoElement, passengerName?: string): { profileId: string; faceEmbedding: number[] }
  verifyFaceAgainstProfile(video: HTMLVideoElement, registeredEmbedding: number[]): { match: boolean; similarity: number }
}

export class DefaultFaceBiometricProvider implements IFaceBiometricProvider {
  async startCamera() {
    return requestCameraStream({ facingMode: "user", idealWidth: 640, idealHeight: 640 })
  }

  stopCamera(stream: MediaStream | null) {
    stopCameraStream(stream)
  }

  async detectFace(video: HTMLVideoElement) {
    return detectFaceInFrame(video)
  }

  createBiometricProfile(video: HTMLVideoElement, passengerName = "Traveler") {
    const faceEmbedding = extractEmbeddingFromVideo(video)
    const profileId = `BIO-NVG-${Date.now().toString(36).toUpperCase()}`
    return { profileId, faceEmbedding }
  }

  verifyFaceAgainstProfile(video: HTMLVideoElement, registeredEmbedding: number[]) {
    const liveEmbedding = extractEmbeddingFromVideo(video)
    const similarity = computeCosineSimilarity(liveEmbedding, registeredEmbedding)
    return { match: similarity >= 0.82, similarity }
  }
}

export const biometricProvider = new DefaultFaceBiometricProvider()
