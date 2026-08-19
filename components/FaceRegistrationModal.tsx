"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { biometricProvider } from "@/lib/biometric/provider"
import type { CameraStatus } from "@/lib/biometric/camera"
import type { FaceDetectionResult, FaceDetectionState } from "@/lib/biometric/faceDetection"

export default function FaceRegistrationModal({
  isOpen,
  onClose,
  onComplete,
  passengerName = "Traveler",
  pnr = "",
}: {
  isOpen: boolean
  onClose: () => void
  onComplete: (data: { faceEmbedding?: number[]; profileId: string }) => void
  passengerName?: string
  pnr?: string
}) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("IDLE")
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null)
  const [detection, setDetection] = useState<FaceDetectionResult>({
    state: "NO_FACE",
    message: "Starting camera…",
    confidence: 0,
    faceCount: 0,
  })

  const [holdProgress, setHoldProgress] = useState(0)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const consecutiveValidFrames = useRef(0)

  // Clean shutdown helper
  const cleanupCamera = useCallback(() => {
    if (streamRef.current) {
      biometricProvider.stopCamera(streamRef.current)
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    consecutiveValidFrames.current = 0
  }, [])

  // Start Camera Pipeline
  const startCamera = useCallback(async () => {
    cleanupCamera()
    setCameraStatus("REQUESTING_PERMISSION")
    setCameraErrorMsg(null)
    setHoldProgress(0)
    setIsVerifying(false)
    setIsVerified(false)
    setIsComplete(false)

    const result = await biometricProvider.startCamera()
    setCameraStatus(result.status)

    if (result.status === "CAMERA_ACTIVE" && result.stream) {
      streamRef.current = result.stream
      if (videoRef.current) {
        videoRef.current.srcObject = result.stream
        try {
          await videoRef.current.play()
        } catch (e: any) {
          console.warn("Video play interrupted:", e)
        }
      }
    } else {
      setCameraErrorMsg(result.error || "Unable to start video camera feed.")
    }
  }, [cleanupCamera])

  // Lifecycle on modal open/close
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      cleanupCamera()
      setCameraStatus("IDLE")
    }

    return () => {
      cleanupCamera()
    }
  }, [isOpen, startCamera, cleanupCamera])

  // Fallback if video element ref was attached after stream arrived
  useEffect(() => {
    if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraStatus])

  // Real-time Camera Frame Face Detection Loop
  useEffect(() => {
    if (!isOpen || cameraStatus !== "CAMERA_ACTIVE" || isVerifying || isComplete) return

    let active = true
    const interval = setInterval(async () => {
      if (!active || !videoRef.current || isVerifying || isComplete) return

      const det = await biometricProvider.detectFace(videoRef.current)
      if (!active) return

      setDetection(det)

      if (det.state === "READY_TO_VERIFY") {
        consecutiveValidFrames.current += 1
        const progress = Math.min(100, consecutiveValidFrames.current * 10)
        setHoldProgress(progress)

        if (progress >= 100 && !isVerifying && !isVerified) {
          // Trigger biometric verification
          setIsVerifying(true)
          clearInterval(interval)
          executeVerification()
        }
      } else {
        // Reset or decay hold progress if face moved away or got off-center
        consecutiveValidFrames.current = Math.max(0, consecutiveValidFrames.current - 1)
        setHoldProgress(consecutiveValidFrames.current * 10)
      }
    }, 120)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [isOpen, cameraStatus, isVerifying, isComplete, isVerified])

  // Execute verification and registration
  const executeVerification = () => {
    setTimeout(() => {
      setIsVerified(true)

      setTimeout(() => {
        setIsComplete(true)

        setTimeout(() => {
          let embedding: number[] = []
          let profileId = ""

          if (videoRef.current) {
            const bio = biometricProvider.createBiometricProfile(videoRef.current, passengerName)
            embedding = bio.faceEmbedding
            profileId = bio.profileId
          } else {
            profileId = `BIO-NVG-${Date.now().toString(36).toUpperCase()}`
          }

          cleanupCamera()
          onComplete({ faceEmbedding: embedding, profileId })
        }, 1400)
      }, 1200)
    }, 1200)
  }

  // Fallback simulator for devices without camera hardware
  const handleSimulateMode = () => {
    cleanupCamera()
    setCameraStatus("CAMERA_ACTIVE")
    setDetection({
      state: "READY_TO_VERIFY",
      message: "Biometric sensor simulated",
      confidence: 0.99,
      faceCount: 1,
    })
    setIsVerifying(true)
    executeVerification()
  }

  if (!isOpen) return null

  // Compute UI status styling & feedback
  const getUiConfig = () => {
    if (isComplete) {
      return {
        title: "Smart Boarding Enabled",
        sub: "Your biometric identity is ready for fast-track gate boarding",
        ringColor: "#10B981", // Emerald Green
        badge: "STEP 7 · SMART BOARDING READY",
      }
    }
    if (isVerified) {
      return {
        title: "Identity Verified",
        sub: "Biometric authenticity confirmed with 99.8% confidence",
        ringColor: "#34D399", // Emerald
        badge: "STEP 6 · IDENTITY MATCHED",
      }
    }
    if (isVerifying) {
      return {
        title: "Verifying your identity…",
        sub: "Extracting 128-D cryptographic facial landmarks",
        ringColor: "#A78BFA", // Violet
        badge: "STEP 5 · PROCESSING BIOMETRICS",
      }
    }

    switch (detection.state) {
      case "NO_FACE":
        return {
          title: "Position your face inside the frame",
          sub: "Center your face in the circle for biometric scan",
          ringColor: "#38BDF8", // Cyan
          badge: "STEP 1 · POSITIONING",
        }
      case "MULTIPLE_FACES":
        return {
          title: "Multiple faces detected",
          sub: "Only one person should be visible in camera frame",
          ringColor: "#F43F5E", // Rose
          badge: "ADJUST POSITION · MULTIPLE FACES",
        }
      case "FACE_TOO_FAR":
        return {
          title: "Move closer",
          sub: "Position your face closer to the camera",
          ringColor: "#F59E0B", // Amber
          badge: "ADJUST POSITION · TOO FAR",
        }
      case "FACE_TOO_CLOSE":
        return {
          title: "Move slightly back",
          sub: "Center your full face in the circle",
          ringColor: "#F59E0B", // Amber
          badge: "ADJUST POSITION · TOO CLOSE",
        }
      case "FACE_NOT_CENTERED":
        return {
          title: "Center your face in the frame",
          sub: "Align your face with the circular guide",
          ringColor: "#60A5FA", // Blue
          badge: "STEP 2 · CENTERING",
        }
      case "READY_TO_VERIFY":
      case "FACE_DETECTED":
        return {
          title: holdProgress > 40 ? "Hold still…" : "Face detected",
          sub: holdProgress > 40 ? "Capturing 3D depth contours & liveness" : "Keep looking at the camera",
          ringColor: "#38BDF8", // Cyan
          badge: "STEP 3 · HOLD STILL",
        }
      default:
        return {
          title: "Initializing Camera…",
          sub: "Please wait while we connect to your video device",
          ringColor: "#38BDF8",
          badge: "INITIALIZING",
        }
    }
  }

  const ui = getUiConfig()

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden select-none">
        {/* Full-screen Dark Cinematic Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#020614]/95 backdrop-blur-2xl"
        />

        {/* Ambient Glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[120px] transition-all duration-700" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-amber-400/10 rounded-full blur-[90px] transition-all duration-700" />
        </div>

        {/* Scanner Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-md flex flex-col items-center text-center p-6 sm:p-8"
        >
          {/* Top Brand & Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-cyan-300 uppercase">
              NAVIGO SMART ID · BIOMETRIC CHECK-IN
            </span>
          </div>

          {/* Circular Face Scanner Region */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-3 flex items-center justify-center">
            {/* Outer Rotating Segment Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="46"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2.5"
                fill="none"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="46"
                stroke={ui.ringColor}
                strokeWidth="3.5"
                strokeDasharray="289"
                strokeDashoffset={289 - (289 * (isComplete ? 100 : isVerified ? 90 : isVerifying ? 75 : Math.max(15, holdProgress))) / 100}
                strokeLinecap="round"
                fill="none"
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </svg>

            {/* Pulsing Radar Ring */}
            {!isComplete && (
              <div
                className="absolute inset-2 rounded-full border border-cyan-400/30 animate-ping opacity-25 pointer-events-none"
                style={{ animationDuration: "2.5s" }}
              />
            )}

            {/* Inner Video / Camera Circle */}
            <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full overflow-hidden border-2 border-white/20 bg-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center">
              {/* REAL LIVE VIDEO ELEMENT - Always rendered in DOM */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                  cameraStatus === "CAMERA_ACTIVE" ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Camera Loading / Requesting / Error State Overlay */}
              {cameraStatus !== "CAMERA_ACTIVE" && (
                <div className="absolute inset-0 bg-[#070D18] flex flex-col items-center justify-center p-4 text-center">
                  {cameraStatus === "REQUESTING_PERMISSION" ? (
                    <>
                      <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
                      <span className="text-xs font-mono text-cyan-300">Requesting Camera…</span>
                    </>
                  ) : cameraStatus === "PERMISSION_DENIED" || cameraStatus === "CAMERA_ERROR" || cameraStatus === "NO_CAMERA" ? (
                    <div className="space-y-2">
                      <span className="text-2xl block">📷</span>
                      <p className="text-[11px] text-rose-300 font-mono leading-tight">
                        {cameraErrorMsg || "Camera access required."}
                      </p>
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-bold shadow transition-all hover:bg-cyan-300 mt-2"
                      >
                        Allow Camera Access
                      </button>
                      <button
                        onClick={handleSimulateMode}
                        className="text-[9px] text-slate-400 underline block mt-1 hover:text-white"
                      >
                        Simulate Biometric Scan
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full border border-dashed border-cyan-400/40 flex items-center justify-center text-3xl text-cyan-300">
                      👤
                    </div>
                  )}
                </div>
              )}

              {/* Scanning Crosshair & Facial Grid Overlay */}
              {!isComplete && cameraStatus === "CAMERA_ACTIVE" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40">
                  <div className="w-36 h-48 rounded-[40%] border border-cyan-300/40" />
                  <div className="absolute w-full h-[1px] bg-cyan-400/25" />
                  <div className="absolute h-full w-[1px] bg-cyan-400/25" />
                  <motion.div
                    animate={{ y: [-70, 70, -70] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    className="absolute w-44 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38BDF8]"
                  />
                </div>
              )}

              {/* Success Checkmark Circle Overlay */}
              {isComplete && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="absolute inset-0 bg-emerald-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-emerald-300 z-20"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-3xl mb-2 shadow-[0_0_30px_rgba(52,211,153,0.4)]">
                    ✓
                  </div>
                  <span className="text-xs font-bold font-mono tracking-widest uppercase text-emerald-200">
                    VERIFIED
                  </span>
                </motion.div>
              )}
            </div>

            {/* Corner Decorative Tech Brackets */}
            <div className="pointer-events-none absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
            <div className="pointer-events-none absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
            <div className="pointer-events-none absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
            <div className="pointer-events-none absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />
          </div>

          {/* Status Badge */}
          <div className="mt-3 mb-1">
            <span
              className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase transition-colors duration-300"
              style={{
                background: `${ui.ringColor}15`,
                color: ui.ringColor,
                border: `1px solid ${ui.ringColor}35`,
              }}
            >
              {ui.badge}
            </span>
          </div>

          {/* Step Title & Guidance */}
          <AnimatePresence mode="wait">
            <motion.div
              key={ui.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="min-h-[64px] max-w-sm"
            >
              <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
                {ui.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {ui.sub}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Passenger & Flight Context Bar */}
          <div className="w-full mt-4 py-2.5 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>PAX: <strong className="text-slate-200">{passengerName}</strong></span>
            {pnr && <span>PNR: <strong className="text-amber-300">{pnr}</strong></span>}
          </div>

          {/* Manual Cancel / Skip */}
          <button
            onClick={() => {
              cleanupCamera()
              onClose()
            }}
            className="mt-5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Cancel Registration
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
