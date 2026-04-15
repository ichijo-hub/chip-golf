'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  onScan: (roomCode: string) => void;
  onClose: () => void;
}

function extractRoomCode(text: string): string | null {
  const raw = text.trim();
  try {
    const url = new URL(raw);
    const roomParam = url.searchParams.get('room');
    if (roomParam && roomParam.length === 6) return roomParam.toUpperCase();
    const parts = url.pathname.split('/').filter(Boolean);
    const gameIdx = parts.indexOf('game');
    if (gameIdx !== -1 && parts[gameIdx + 1]?.length === 6) {
      return parts[gameIdx + 1].toUpperCase();
    }
  } catch {
    // not a URL
  }
  if (/^[A-Z0-9]{6}$/i.test(raw)) return raw.toUpperCase();
  return null;
}

export default function QRScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();

        const jsQR = (await import('jsqr')).default;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        function tick() {
          if (!active || doneRef.current) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(imageData.data, imageData.width, imageData.height);
            if (result) {
              const code = extractRoomCode(result.data);
              if (code) {
                doneRef.current = true;
                stop();
                onScan(code);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        onClose();
      }
    }

    start();
    return () => {
      active = false;
      stop();
    };
  }, [onScan, onClose, stop]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div
        className="flex items-center justify-between px-4 pb-3 bg-black"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <p className="text-white font-semibold">QRコードをスキャン</p>
        <button onClick={() => { stop(); onClose(); }} className="text-white text-2xl leading-none px-2">✕</button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
        />
        {/* 照準枠 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 border-2 border-white rounded-lg opacity-70" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
