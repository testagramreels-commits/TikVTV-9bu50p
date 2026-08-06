/**
 * Auto-clip recorder: captures 45 seconds of a live stream via
 * MediaRecorder (canvas + audio from video element) and uploads to Supabase.
 * Triggered when a channel has been actively watched for CLIP_TRIGGER_SECS seconds.
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { IPTVChannel } from '@/types';

const CLIP_DURATION_MS  = 45_000; // 45 seconds
const CLIP_TRIGGER_SECS = 15;     // start recording after 15s of watching

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
      const ext  = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : 'mp4';
      const userId = user?.id || 'anon';
      const path = `${userId}/${channelId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('channel-clips')
        .upload(path, blob, { contentType: blob.type, upsert: false });

      if (uploadError) { console.warn('[Clip] upload failed:', uploadError.message); return; }

      const { data: { publicUrl } } = supabase.storage.from('channel-clips').getPublicUrl(path);

      const { error: dbError } = await supabase.from('channel_clips').insert({
        channel_id:  channelId,
        storage_path: path,
        public_url:  publicUrl,
        duration_secs: Math.round(CLIP_DURATION_MS / 1000),
        recorded_by: user?.id || null,
        expires_at:  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      if (dbError) console.warn('[Clip] db insert failed:', dbError.message);
      else console.log('[Clip] saved:', publicUrl);
    } catch (e) {
      console.warn('[Clip] error:', e);
    }
  }, [user]);

  const startRecording = useCallback(() => {
    if (!videoEl || recordingRef.current) return;
    if (recordedChannels.current.has(channel.id)) return; // don't re-record same session

    try {
      // Capture video stream from the video element
      const stream = (videoEl as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
        .captureStream?.() ?? (videoEl as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();

      if (!stream) { console.log('[Clip] captureStream not supported'); return; }

      // Find best supported format
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/ogg', '']
        .find(m => !m || MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current   = [];
      recordingRef.current = true;
      recordedChannels.current.add(channel.id);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        recordingRef.current = false;
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        if (blob.size > 50000) { // >50KB, worth saving
          uploadClip(blob, channel.id);
        }
      };

      recorder.start(1000); // collect data every second
      console.log('[Clip] Recording started for', channel.name);

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

    // Schedule recording after CLIP_TRIGGER_SECS of watching
    watchTimer.current = setTimeout(() => {
      startRecording();
    }, CLIP_TRIGGER_SECS * 1000);

    return () => {
      clearTimeout(watchTimer.current);
    };
  }, [isActive, videoEl, channel.id, startRecording, stopRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimeout(watchTimer.current);
      stopRecording();
    };
  }, [stopRecording]);
}
