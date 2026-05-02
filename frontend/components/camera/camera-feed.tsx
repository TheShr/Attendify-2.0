"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, CameraOff, Users, AlertCircle, Wifi } from "lucide-react"
import { apiFetch, apiJson } from "@/lib/api"

export interface AttendanceMarkResult {
  matched: boolean
  studentId: number | null
  username?: string | null
  name?: string | null
  recognizedName?: string | null
  distance: number | null
  score: number | null
  threshold: number
  createdAt: string
  source?: string
  classId?: number | null
  attendanceRecorded?: boolean
  marked?: Array<{ student_id?: string | number | null; name?: string | null; distance?: number | null }>
}

interface DetectedFacePayload {
  id: string
  name: string
  confidence: number
  timestamp: Date
}

type CameraSourceMode = "native" | "ip"

interface CameraFeedProps {
  isActive: boolean
  onToggle: (active: boolean) => void
  onRecognized?: (result: AttendanceMarkResult) => void
  onFaceDetected?: (faces: DetectedFacePayload[]) => void
  classId?: number | null
}

export function CameraFeed({
  isActive,
  onToggle,
  onRecognized,
  onFaceDetected,
  classId,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string>("")
  const [frameCount, setFrameCount] = useState(0)
  const [records, setRecords] = useState<AttendanceMarkResult[]>([])
  const [sourceMode, setSourceMode] = useState<CameraSourceMode>("native")
  const [ipUrlInput, setIpUrlInput] = useState("")
  const [ipStreamUrl, setIpStreamUrl] = useState("")
  const [ipConnecting, setIpConnecting] = useState(false)

  const intervalRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!isActive) {
      setRecords([])
      setFrameCount(0)
      setError("")
      setIpConnecting(false)
    }
  }, [isActive])
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handleVideoError = () => {
      if (sourceMode !== "ip") return
      console.error("Video element error while streaming IP camera")
      setError("Could not connect to IP Camera. Please check URL and Wi-Fi network.")
      setIpStreamUrl("")
      setIpConnecting(false)
      if (isActive) {
        onToggle(false)
      }
    }

    const handleVideoPlaying = () => {
      if (sourceMode !== "ip") return
      setError("")
      setIpConnecting(false)
    }

    videoElement.addEventListener("error", handleVideoError)
    videoElement.addEventListener("playing", handleVideoPlaying)

    return () => {
      videoElement.removeEventListener("error", handleVideoError)
      videoElement.removeEventListener("playing", handleVideoPlaying)
    }
  }, [sourceMode, isActive, onToggle])

  const sanitizeIpUrl = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return ""
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    return `http://${trimmed}`
  }
  const buildIpStreamUrl = (baseUrl: string) => {
    const url = new URL(baseUrl)
    const normalizedPath = url.pathname.replace(/\/+$/, "")
    if (!normalizedPath || normalizedPath === "/") {
      url.pathname = "/video"
    } else if (/\/video$/i.test(normalizedPath)) {
      url.pathname = normalizedPath
    } else {
      url.pathname = `${normalizedPath.replace(/\/+$/, "")}/video`
    }
    url.search = ""
    url.hash = ""
    return url.toString()
  }

  const handleIpConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const sanitized = sanitizeIpUrl(ipUrlInput)
    if (!sanitized) {
      setError("Enter the IP Camera URL to connect.")
      return
    }

    setError("")
    setIpConnecting(true)
    try {
      const streamUrl = buildIpStreamUrl(sanitized)
      setIpStreamUrl(streamUrl)
      if (!isActive) {
        onToggle(true)
      }
    } catch (connectionError) {
      console.error("Invalid IP camera URL:", connectionError)
      setError("Could not connect to IP Camera. Please check URL and Wi-Fi network.")
      setIpConnecting(false)
    }
  }


  const stopAllStreams = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const activeStream = streamRef.current
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute("src")
      videoRef.current.srcObject = null
      videoRef.current.load()
    }

    inFlightRef.current = false
  }, [])

  const getCanvasBlob = useCallback(
    (canvas: HTMLCanvasElement, type: string, quality?: number) =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality)
      }),
    []
  )

  const captureAndAnalyzeFrame = useCallback(async () => {
    if (inFlightRef.current) {
      return
    }

    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      setFrameCount((prev) => prev + 1)
    } catch (drawErr) {
      console.error("Frame draw error:", drawErr)
      setError("Unable to capture frames from the current video stream.")
      return
    }

    try {
      inFlightRef.current = true
      const blob = await getCanvasBlob(canvas, "image/jpeg", 0.85)
      if (!blob) {
        setError("Failed to convert frame to image")
        inFlightRef.current = false
        return
      }

      try {
        const formData = new FormData()
        formData.append("image", blob, "frame.jpg")
        formData.append("source", sourceMode === "ip" ? "ip-webcam" : "webcam")

        if (typeof classId === "number" && Number.isFinite(classId)) {
          formData.append("class_id", String(classId))
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
        const headers: HeadersInit = {}
        if (token) {
          headers["Authorization"] = `Bearer ${token}`
        }

        const response = await apiFetch("/api/attendance/mark-face", {
          method: "POST",
          headers,
          body: formData,
        })

        const result = (await response.json()) as AttendanceMarkResult
        const matchedRecords = Array.isArray(result.marked) && result.marked.length > 0
          ? result.marked.map((item) => ({
              matched: true,
              studentId: item.student_id ? Number(item.student_id) : null,
              username: item.student_id ? String(item.student_id) : undefined,
              name: item.name ?? null,
              recognizedName: item.name ?? null,
              distance: item.distance ?? null,
              score: null,
              threshold: 0,
              createdAt: new Date().toISOString(),
              source: "face",
              attendanceRecorded: true,
            }))
          : [{
              matched: false,
              studentId: result.studentId ?? null,
              username: result.username ?? null,
              name: result.name ?? null,
              recognizedName: result.recognizedName ?? null,
              distance: result.distance,
              score: result.score,
              threshold: result.threshold ?? 0,
              createdAt: result.createdAt || new Date().toISOString(),
              source: result.source ?? "face",
              attendanceRecorded: false,
            }]

        setRecords((prev) => [...prev, ...matchedRecords].slice(-10))
        onRecognized?.(matchedRecords[0])

        const facePayloads = matchedRecords.map((record) => ({
          id:
            record.studentId !== null && !Number.isNaN(record.studentId)
              ? String(record.studentId)
              : record.username || record.recognizedName || record.name || globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
          name: record.recognizedName || record.name || record.username || "Unknown",
          confidence:
            typeof record.score === "number" ? Math.max(0, Math.min(1, record.score)) : 0,
          timestamp: record.createdAt ? new Date(record.createdAt) : new Date(),
        }))

        onFaceDetected?.(facePayloads)
      } catch (err) {
        console.error("Error sending frame to attendance endpoint:", err)
        setError("Unable to send frame to the attendance service.")
      } finally {
        inFlightRef.current = false
      }
    } catch (err) {
      console.error("Error capturing frame:", err)
      setError("Unable to capture frames from the current video stream.")
      inFlightRef.current = false
    }
  }, [classId, getCanvasBlob, onFaceDetected, onRecognized, sourceMode])

  const beginFrameCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    captureAndAnalyzeFrame()
    intervalRef.current = window.setInterval(() => {
      if (!isActive) return
      captureAndAnalyzeFrame()
    }, 1000) as unknown as number
  }, [captureAndAnalyzeFrame, isActive])

  const startNativeCamera = useCallback(async (cancelled: boolean) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      })

      if (cancelled) {
        mediaStream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = mediaStream
      setError("")
      inFlightRef.current = false

      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.srcObject = mediaStream
        videoRef.current.removeAttribute("src")
        await videoRef.current.play()
      }

      beginFrameCapture()
    } catch (err) {
      console.error("Error accessing camera:", err)
      setError("Unable to access the built-in camera. Please check permissions.")
      // onToggle(false)  // Remove this so the component stays visible with error
    }
  }, [beginFrameCapture, onToggle])

  const startIpCamera = useCallback(async (cancelled: boolean) => {
    try {
      if (!ipStreamUrl) {
        throw new Error("Missing IP stream URL")
      }

      streamRef.current = null
      setError("")
      inFlightRef.current = false

      const videoElement = videoRef.current
      if (!videoElement) {
        throw new Error("Missing video element")
      }

      videoElement.pause()
      videoElement.srcObject = null
      videoElement.crossOrigin = "anonymous"
      videoElement.src = ipStreamUrl
      await videoElement.play()

      if (cancelled) {
        setIpConnecting(false)
        return
      }

      setIpConnecting(false)
      setError("")
      beginFrameCapture()
    } catch (err) {
      if (cancelled) {
        setIpConnecting(false)
        return
      }
      console.error("Error connecting to IP Webcam stream:", err)
      setError("Could not connect to IP Camera. Please check URL and Wi-Fi network.")
      setIpStreamUrl("")
      setIpConnecting(false)
      // onToggle(false)  // Remove to keep component visible
    }
  }, [beginFrameCapture, ipStreamUrl, onToggle])
  const handleToggle = () => {
    if (!isActive && sourceMode === "ip" && !ipStreamUrl) {
      setError("Enter the IP Camera URL and press Connect before starting.")
      return
    }

    setError("")
    onToggle(!isActive)
  }

  const handleSourceModeChange = (mode: CameraSourceMode) => {
    if (mode === sourceMode) return
    setError("")
    setSourceMode(mode)
    if (isActive) {
      onToggle(false)
    }
    if (mode === "native") {
      setIpStreamUrl("")
      setIpConnecting(false)
    }
  }

  const latestRecords = records.slice().reverse()

  useEffect(() => {
    if (!isActive) {
      stopAllStreams()
      return
    }

    if (sourceMode === "ip" && !ipStreamUrl) {
      setError("Enter the IP Camera URL and connect before starting the feed.")
      onToggle(false)
      return
    }

    let cancelled = false

    const start = async () => {
      stopAllStreams()
      if (sourceMode === "native") {
        await startNativeCamera(cancelled)
      } else {
        await startIpCamera(cancelled)
      }
    }

    start()

    return () => {
      cancelled = true
      stopAllStreams()
    }
  }, [isActive, sourceMode, ipStreamUrl, startNativeCamera, startIpCamera, stopAllStreams, onToggle])
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Feed
            </CardTitle>
            <CardDescription>Live camera feed for face recognition attendance</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge variant="default" className="bg-green-500">
                <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-white" />
                LIVE
              </Badge>
            )}
            <Button onClick={handleToggle} variant={isActive ? "destructive" : "default"} size="sm">
              {isActive ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
              {isActive ? "Stop" : "Start"}
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input Source</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={sourceMode === "native" ? "default" : "outline"}
              className="justify-start gap-2"
              onClick={() => handleSourceModeChange("native")}
            >
              <Camera className="h-4 w-4" />
              Option 1: Built-in Webcam
            </Button>
            <Button
              type="button"
              variant={sourceMode === "ip" ? "default" : "outline"}
              className="justify-start gap-2"
              onClick={() => handleSourceModeChange("ip")}
            >
              <Wifi className="h-4 w-4" />
              Option 2: IP Webcam URL
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sourceMode === "ip" && (
          <form className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/60 p-4" onSubmit={handleIpConnect}>
            <div className="space-y-1">
              <Label htmlFor="ip-url">Enter IP Camera URL (e.g., http://192.0.0.4:8080)</Label>
              <Input
                id="ip-url"
                value={ipUrlInput}
                onChange={(event) => setIpUrlInput(event.target.value)}
                placeholder="http://192.0.0.4:8080"
                autoComplete="off"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={ipConnecting}>
                {ipConnecting ? "Connecting..." : "Connect"}
              </Button>
              {ipStreamUrl && !ipConnecting && (
                <span className="text-xs text-muted-foreground">Streaming from {ipStreamUrl}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Use the IP Webcam app on your phone, ensure both devices share the same network, and paste the camera URL; `/video` is appended automatically.
            </p>
          </form>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <div className="relative">
          <video
            ref={videoRef}
            className="h-64 w-full rounded-lg bg-gray-900 object-cover"
            autoPlay
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />

          {!isActive && !error && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-100">
              <div className="text-center">
                <Camera className="mx-auto mb-2 h-12 w-12 text-gray-400" />
                <p className="text-sm text-gray-500">Camera is off</p>
              </div>
            </div>
          )}

          {isActive && (
            <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              Frames: {frameCount}
            </div>
          )}
        </div>

        {isActive && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Recognized Students ({records.length})
              </h4>
              <span className="text-xs text-muted-foreground">Latest 10</span>
            </div>

            {latestRecords.length > 0 ? (
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {latestRecords.map((record, index) => (
                  <div key={`${record.createdAt}-${index}`} className="flex items-center justify-between rounded bg-gray-50 p-2">
                    <div>
                      <span className="text-sm font-medium">
                        {record.matched
                          ? record.recognizedName || record.name || record.username || (record.studentId ? `ID ${record.studentId}` : "Unknown")
                          : "Unknown"}
                      </span>
                      {record.score !== null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {(record.score * 100).toFixed(0)}% confidence
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No recognitions yet</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

















