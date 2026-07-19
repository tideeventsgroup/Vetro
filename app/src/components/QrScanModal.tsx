import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { XIcon } from "./icons.js";

interface QrScanModalProps {
  onDetected: (value: string) => void;
  onClose: () => void;
}

// A focused camera-scan sheet: point at a checkpoint's printed QR code and
// it resolves as soon as jsQR decodes a frame. Always paired with a manual
// fallback button on the calling page — camera access can be denied, slow,
// or simply unavailable on a desktop, and a security officer's phone is not
// a device to gate a core action behind a single input method.
export function QrScanModal({ onDetected, onClose }: QrScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
        setError("Camera access isn't available in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          tick(performance.now());
        }
      } catch {
        setError("Could not access the camera — check permissions, or use the manual scan button instead.");
      }
    }

    // A static printed QR code doesn't need a 60fps decode attempt — 5/sec
    // is plenty to feel instant while using a fraction of the CPU/battery
    // that getImageData + jsQR at every animation frame would burn for
    // however long an officer holds the scanner open.
    const DECODE_INTERVAL_MS = 200;
    let lastAttempt = 0;

    function tick(now: number) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (now - lastAttempt >= DECODE_INTERVAL_MS && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        lastAttempt = now;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            onDetected(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <div className="card-header">
          <h2 style={{ fontSize: 16 }}>Scan checkpoint</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} aria-label="Close">
            <XIcon width={14} height={14} />
          </button>
        </div>
        {error ? (
          <p className="error-text">{error}</p>
        ) : (
          <>
            <div
              style={{
                position: "relative",
                borderRadius: 12,
                overflow: "hidden",
                background: "#000",
                aspectRatio: "1 / 1",
              }}
            >
              <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <p style={{ fontSize: 13, color: "var(--vetro-text-muted)", margin: "12px 0 0" }}>
              Point your camera at the checkpoint's QR code.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
