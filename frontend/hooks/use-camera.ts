"use client"

import { useState, useCallback, useRef } from "react"

import { apiJson } from "@/lib/api"

import type { AttendanceMarkResult } from "@/components/camera/camera-feed"

interface UseCameraReturn {
  isActive: boolean
  events: AttendanceMarkResult[]
  frameCount: number
  error: string | null
  startCamera: () => Promise<void>
  stopCamera: () => void
  toggleCamera: () => void
}

export function useCamera(): UseCameraReturn {
  const [isActive, setIsActive] = useState(false)
  const [events, setEvents] = useState<AttendanceMarkResult[]>([])
  const [frameCount, setFrameCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inFlightRef = useRef(false)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      })

      const video = document.createElement("video")
      video.setAttribute("playsinline", "true")
      video.muted = true
      video.srcObject = stream
      await video.play()

      streamRef.current = stream
      videoRef.current = video
      canvasRef.current = document.createElement("canvas")
      setIsActive(true)
      setError(null)
      setFrameCount(0)
      setEvents([])
      inFlightRef.current = false

      intervalRef.current = setInterval(() => {
        setFrameCount((prev) => prev + 1)
        captureFrame()
      }, 7000)
    } catch (err) {
      console.error("Error accessing camera:", err)
      setError("Unable to access camera. Please check permissions.")
      setIsActive(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current = null
    }

    canvasRef.current = null
    inFlightRef.current = false
    setIsActive(false)
    setEvents([])
    setFrameCount(0)
  }, [])

  const toggleCamera = useCallback(() => {
    if (isActive) {
      stopCamera()
    } else {
      void startCamera()
    }
  }, [isActive, startCamera, stopCamera])

  const captureFrame = useCallback(async () => {
    if (inFlightRef.current) {
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      inFlightRef.current = true
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
      const result = await apiJson<AttendanceMarkResult>("/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, source: "webcam" }),
      })

      setEvents((prev) => [...prev, result].slice(-20))
    } catch (err) {
      console.error("Error sending frame to attendance endpoint:", err)
    } finally {
      inFlightRef.current = false
    }
  }, [])

  return {
    isActive,
    events,
    frameCount,
    error,
    startCamera,
    stopCamera,
    toggleCamera,
  }
}
