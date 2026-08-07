/**
 * Auto-clip recorder: captures 60 seconds of a live stream with audio
 * via MediaRecorder and uploads to Supabase.
 * Triggered after CLIP_TRIGGER_SECS of watching.
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { IPTVChannel } from '@/types';

const CLIP_DURATION_MS  = 60_000;  // 60 seconds
const CLIP_TRIGGER_SECS = 15;      // start after 15s of watching

interface Opts {
  channel:  IPTVChannel;
  videoEl:  HTMLVideoElement | null;
  isActive: boolean;
}

export function useAutoClipRecorder({ channel, videoEl, isActive }: Opts) {
  const { user }         = useAuthStore();
  const watchTimer       = useRef<ReturnType<typeof setTimeout>>();
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const recordingRef     = useRef(false);
  const recordedChannels = useRef<Set<string>>(new Set());

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const uploadClip = useCallback(async (blob: Blob, channelId: string) => {
    try {
      const ext    = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : 'mp4';
      const userId = user?.id || 'anon';
      const path   = `${userId}/${channelId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('channel-clips')
        .upload(path, blob, { contentType: blob.type, upsert: false });

      if (uploadError) { console.warn('[Clip] upload failed:', uploadError.message); return; }

      const { data: { publicUrl } } = supabase.storage.from('channel-clips').getPublicUrl(path);

      const { error: dbError } = await supabase.from('channel_clips').insert({
        channel_id:   channelId,
        storage_path: path,
        public_url:   publicUrl,
        duration_secs: Math.round(CLIP_DURATION_MS / 1000),
        recorded_by:  user?.id || null,
        expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      if (dbError) console.warn('[Clip] db insert failed:', dbError.message);
      else console.log('[Clip] saved 60s clip with audio:', publicUrl);
    } catch (e) {
      console.warn('[Clip] error:', e);
    }
  }, [user]);

  const startRecording = useCallback(() => {
    if (!videoEl || recordingRef.current) return;
    if (recordedChannels.current.has(channel.id)) return;

    try {
      // Capture stream including audio tracks
      type VideoWithCapture = HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const stream = (videoEl as VideoWithCapture).captureStream?.()
        ?? (videoEl as VideoWithCapture).mozCaptureStream?.();

      if (!stream) { console.log('[Clip] captureStream not supported'); return; }

      // Prefer formats that include audio
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/ogg;codecs=vp8,opus',
        'video/ogg',
        '',
      ].find(m => !m || MediaRecorder.isTypeSupported(m)) || '';

      // Ensure audio tracks are included in stream
      const audioTracks = videoEl.srcObject
        ? (videoEl.srcObject as MediaStream).getAudioTracks()
        : stream.getAudioTracks();

      let recordStream = stream;
      // If the captured stream has no audio, try to get it from srcObject
      if (stream.getAudioTracks().length === 0 && audioTracks.length > 0) {
        const combined = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);
        recordStream = combined;
      }

      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) recorderOptions.mimeType = mimeType;
      // Request higher audio bitrate for quality
      recorderOptions.audioBitsPerSecond = 128000;
      recorderOptions.videoBitsPerSecond = 1500000;

      const recorder = new MediaRecorder(recordStream, recorderOptions);
      recorderRef.current  = recorder;
      chunksRef.current    = [];
      recordingRef.current = true;
      recordedChannels.current.add(channel.id);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        recordingRef.current = false;
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        if (blob.size > 80000) { // > 80KB worth saving (audio + video)
          uploadClip(blob, channel.id);
        }
      };

      recorder.start(500); // collect chunks every 500ms for smoother audio
      console.log('[Clip] Recording 60s clip with audio for', channel.name);

      // Stop after CLIP_DURATION_MS
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, CLIP_DURATION_MS);

    } catch (e) {
      console.warn('[Clip] MediaRecorder error:', e);
      recordingRef.current = false;
    }
  }, [videoEl, channel, uploadClip]);

  useEffect(() => {
    clearTimeout(watchTimer.current);

    if (!isActive || !videoEl) {
      stopRecording();
      return;
    }

    watchTimer.current = setTimeout(() => {
      startRecording();
    }, CLIP_TRIGGER_SECS * 1000);

    return () => {
      clearTimeout(watchTimer.current);
    };
  }, [isActive, videoEl, channel.id, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      clearTimeout(watchTimer.current);
      stopRecording();
    };
  }, [stopRecording]);
}
