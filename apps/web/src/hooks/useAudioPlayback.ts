import { useCallback, useEffect, useRef } from "react";
import type { AudioChunkPayload } from "./useIntercomStore";

/**
 * Decodes a base64 Int16 PCM payload, resamples to the AudioContext rate,
 * and schedules it for gapless playback using a running timestamp cursor.
 */
export function useAudioPlayback(
  setAudioChunkHandler: (fn: ((p: AudioChunkPayload) => void) | null) => void,
  /** optional: only play chunks for these channel IDs (empty = play all) */
  listenChannels?: Set<string>,
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nextTimeRef = useRef(0);
  const listenRef = useRef(listenChannels);

  useEffect(() => {
    listenRef.current = listenChannels;
  });

  function ensureCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 1;
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
      nextTimeRef.current = 0;
    }
    return ctxRef.current;
  }

  const playChunk = useCallback((payload: AudioChunkPayload) => {
    const listen = listenRef.current;
    if (listen && listen.size > 0 && !listen.has(payload.channelId)) return;

    try {
      const ctx = ensureCtx();
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      // Decode base64 → Int16Array
      const binaryStr = atob(payload.audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      if (int16.length === 0) return;

      // Int16 → Float32
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      // Resample to ctx.sampleRate if needed
      const srcRate = payload.sampleRate;
      const dstRate = ctx.sampleRate;
      let samples: Float32Array;
      if (srcRate !== dstRate) {
        const ratio = dstRate / srcRate;
        samples = new Float32Array(Math.round(float32.length * ratio));
        for (let i = 0; i < samples.length; i++) {
          const srcIdx = i / ratio;
          const lo = Math.floor(srcIdx);
          const hi = Math.min(lo + 1, float32.length - 1);
          const frac = srcIdx - lo;
          samples[i] = float32[lo] * (1 - frac) + float32[hi] * frac;
        }
      } else {
        samples = float32;
      }

      const buffer = ctx.createBuffer(1, samples.length, dstRate);
      buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainRef.current ?? ctx.destination);

      const now = ctx.currentTime;
      // Allow a small look-ahead buffer (50ms) to avoid gaps on slow JS
      const startAt = Math.max(now + 0.01, nextTimeRef.current);
      source.start(startAt);
      nextTimeRef.current = startAt + buffer.duration;
    } catch {
      // Ignore playback errors (e.g. context not yet allowed)
    }
  }, []);

  useEffect(() => {
    setAudioChunkHandler(playChunk);
    return () => setAudioChunkHandler(null);
  }, [setAudioChunkHandler, playChunk]);

  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);
}
