"use client";

import type React from "react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch, getApiBase } from "@/lib/api";

interface RegisterFormProps {
  userType: "student" | "teacher";
  onSuccess?: () => void;
}

type PhotoState = {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
};

const MAX_PHOTO_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function RegisterForm({ userType, onSuccess }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    phone: "",
    // Student specific
    roll_no: "",
    class_code: "",
    // Teacher specific
    department: "",
    designation: "",
  });
  const labelClass = "flex flex-col gap-2 text-sm font-semibold text-slate-900";

  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; msg: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const endpoint = useMemo(
    () => (userType === "student" ? "/api/auth/register/student" : "/api/auth/register/teacher"),
    [userType]
  );

  function handleInputChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function clearPhotos() {
    photos.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPhotos([]);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const validated: PhotoState[] = [];

    if (selected.length > 5) {
      setMessage({ ok: false, msg: "Upload up to 5 photos for student enrollment." });
      return;
    }

    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setMessage({ ok: false, msg: "Only JPG, PNG, or WebP images are allowed." });
        return;
      }
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_PHOTO_MB) {
        setMessage({ ok: false, msg: `Each photo must be <= ${MAX_PHOTO_MB}MB.` });
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      validated.push({ file, previewUrl, error: null });
    }

    clearPhotos();
    setPhotos(validated);
    setMessage(null);
  }

  async function stopCamera() {
    setIsScanning(false);
    setScanError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function startCamera() {
    setScanError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Unable to access camera", err);
      setScanError("Unable to access the camera. Please allow webcam access or use a supported browser.");
      setCameraActive(false);
    }
  }

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !cameraActive || photos.length >= 5) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setScanError("Unable to capture frame from video.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setScanError("Unable to capture frame from camera.");
        return;
      }
      const file = new File([blob], `capture-${photos.length + 1}.jpg`, { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { file, previewUrl, error: null }]);
      setScanError(null);
    }, "image/jpeg", 0.85);
  }, [cameraActive, photos.length]);

  function toggleCamera() {
    if (cameraActive) {
      stopCamera();
      return;
    }
    startCamera();
  }

  function handleScannerOpenChange(open: boolean) {
    setScannerOpen(open);
    if (open) {
      startCamera();
      return;
    }
    stopCamera();
  }

  useEffect(() => {
    if (!cameraActive || !isScanning) {
      return;
    }

    const timer = window.setInterval(() => {
      if (photos.length >= 5) {
        setIsScanning(false);
        return;
      }
      captureFrame();
    }, 1200);

    return () => {
      window.clearInterval(timer);
    };
  }, [cameraActive, isScanning, photos.length, captureFrame]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      // Basic required checks
      if (!formData.username || !formData.password || !formData.name || !formData.email || !formData.phone) {
        throw new Error("Please fill all required fields.");
      }
      if (userType === "student") {
        if (!formData.roll_no || !formData.class_code) {
          throw new Error("Please complete all student fields.");
        }
      } else {
        if (!formData.department || !formData.designation) {
          throw new Error("Please complete all teacher fields.");
        }
      }

      const isStudent = userType === "student";
      const teacherPayload = {
        username: formData.username,
        password: formData.password,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        designation: formData.designation,
      };

      let res: Response;
      if (isStudent) {
        const body = new FormData();
        Object.entries(formData).forEach(([k, v]) => body.append(k, v));
        if (photos.length > 0) {
          photos.forEach((item, index) => {
            if (item.file) {
              body.append("photo", item.file, `photo-${index + 1}.jpg`);
            }
          });
        }

        const backendBase = getApiBase().replace(/\/+$/, "");
        const studentUrl = backendBase.endsWith("/api")
          ? `${backendBase}/auth/register/student`
          : `${backendBase}/api/auth/register/student`;
        console.log("Register student payload entries:", Array.from(body.entries()).map(([key, value]) => [key, value instanceof File ? `File(${value.name})` : value]));
        console.log("studentUrl", studentUrl, "isFormData", body instanceof FormData);
        res = await fetch(studentUrl, {
          method: "POST",
          body,
        });
      } else {
        console.log("Register teacher payload:", teacherPayload);
        res = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(teacherPayload),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Registration failed");
      }

      setMessage({
        ok: true,
        msg: `${userType === "student" ? "Student" : "Teacher"} registered successfully.${data?.face_enrolled ? " Face enrolled." : ""}`,
      });

      // Reset form
      setFormData({
        username: "",
        password: "",
        name: "",
        email: "",
        phone: "",
        roll_no: "",
        class_code: "",
        department: "",
        designation: "",
      });
      clearPhotos();
      
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage({ ok: false, msg: message || "Something went wrong" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Register {userType === "student" ? "Student" : "Teacher"}
        </CardTitle>
        <CardDescription className="text-center">Create a new {userType} account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Photo uploader and capture section */}
          {userType === "student" && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Face Scanner</p>
                  <p className="text-xs text-muted-foreground">
                    Open the scanner to capture up to 5 snapshots for student face enrollment.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Optional
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.3fr_0.95fr]">
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <Button type="button" variant="secondary" onClick={() => setScannerOpen(true)}>
                      Open Scanner
                    </Button>
                    <p className="text-xs text-slate-500">
                      Launch a compact scanner popup with face snapshot capture.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {photos.length > 0 ? (
                      photos.map((item, index) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <div key={index} className="relative h-20 w-full overflow-hidden rounded-lg border bg-slate-100">
                          <img src={item.previewUrl ?? ""} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))
                    ) : (
                      <div className="flex h-20 w-full items-center justify-center rounded-lg border bg-slate-50 text-xs text-muted-foreground">
                        No snapshots yet
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Captured {photos.length}/5 snapshots.</p>
                    <p>You may also upload images manually below.</p>
                  </div>

                  {photos.length > 0 && (
                    <Button type="button" variant="outline" onClick={clearPhotos}>
                      Clear captured snapshots
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p className="font-semibold">Manual upload</p>
                  <p className="text-xs text-muted-foreground">Add up to 5 photos if the scanner is unavailable.</p>
                  <Input
                    id="photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>

              {scanError && <p className="text-xs text-red-600">{scanError}</p>}

              <Dialog open={scannerOpen} onOpenChange={handleScannerOpenChange}>
                <DialogContent className="sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Scanner</DialogTitle>
                    <DialogDescription>
                      Capture up to 5 face snapshots in a popup scanner window. Use the buttons below to capture manually or scan automatically.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                    <div className="relative overflow-hidden rounded-xl border bg-black">
                      <video
                        ref={videoRef}
                        className="h-full min-h-[280px] w-full object-cover"
                        muted
                        playsInline
                        autoPlay
                      />
                      {!cameraActive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
                          Camera is off. Close the popup and open it again to enable the scanner.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold">Scanner controls</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" onClick={toggleCamera}>
                            {cameraActive ? "Stop Camera" : "Start Camera"}
                          </Button>
                          <Button
                            type="button"
                            variant={isScanning ? "secondary" : "outline"}
                            onClick={() => setIsScanning((prev) => !prev)}
                            disabled={!cameraActive || photos.length >= 5}
                          >
                            {isScanning ? "Stop Auto Scan" : "Auto Scan"}
                          </Button>
                          <Button type="button" variant="outline" onClick={captureFrame} disabled={!cameraActive || photos.length >= 5}>
                            Capture Snapshot
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Captured {photos.length}/5 snapshots.</p>
                      </div>

                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold">Snapshot preview</p>
                        <div className="grid grid-cols-2 gap-2">
                          {photos.length > 0 ? (
                            photos.map((item, index) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <div key={index} className="relative h-24 w-full overflow-hidden rounded-lg border bg-slate-100">
                                <img src={item.previewUrl ?? ""} alt={`Snapshot ${index + 1}`} className="h-full w-full object-cover" />
                              </div>
                            ))
                          ) : (
                            <div className="flex h-24 w-full items-center justify-center rounded-lg border bg-slate-50 text-xs text-muted-foreground">
                              No snapshots captured yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="mt-4 gap-2">
                    <div className="text-sm text-muted-foreground">
                      Close the scanner when finished.
                    </div>
                    <DialogClose asChild>
                      <Button type="button">Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {message && (
            <div className={`rounded-lg p-3 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {message.msg}
            </div>
          )}

          {/* Core fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username" className={labelClass}>Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className={labelClass}>Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className={labelClass}>Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className={labelClass}>Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className={labelClass}>Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                required
              />
            </div>
          </div>

          {userType === "student" && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="roll_no" className={labelClass}>Roll Number</Label>
                  <Input
                    id="roll_no"
                    type="text"
                    placeholder="Enter roll number"
                    value={formData.roll_no}
                    onChange={(e) => handleInputChange("roll_no", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="class_code" className={labelClass}>Class Code</Label>
                  <Input
                    id="class_code"
                    type="text"
                    placeholder="Enter class code"
                    value={formData.class_code}
                    onChange={(e) => handleInputChange("class_code", e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {userType === "teacher" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department" className={labelClass}>Department</Label>
                <Input
                  id="department"
                  type="text"
                  placeholder="Enter department"
                  value={formData.department}
                  onChange={(e) => handleInputChange("department", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="designation" className={labelClass}>Designation</Label>
                <Input
                  id="designation"
                  type="text"
                  placeholder="Enter designation"
                  value={formData.designation}
                  onChange={(e) => handleInputChange("designation", e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Registering..." : `Register ${userType === "student" ? "Student" : "Teacher"}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
