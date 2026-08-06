/**
 * useClips — captures 45-second preview clips from live streams and
 * stores them in Supabase Storage so new visitors see engaged content
 * while waiting for live streams to connect.
 */
import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuthUser, ChannelClip, IPTVChannel } from '@/types';

const CLIP_DURATION_MS = 45_000;
const MIN_RECORD_DELAY_MS = 8_000; // wait 8 s after stream is ready before recording

// In-memory set to avoid double-recording same channel in same session
const recordedThisSession = new Set<string>();

/**
 * Fetch a fresh clip for a given channel (not expired).
 */
export async function fetchClipForChannel(channelId: string): Promise<ChannelClip | null> {
  try {
    const { data, error } = await supabase
      .from('channel_clips')
      .select('*')
      .eq('channel_id', channelId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as ChannelClip;
  } catch {
    return null;
  }
}

/**
 * Fetch the most recent clips across all channels (for cold-start feed).
 */
export async function fetchRecentClips(limit = 20): Promise<ChannelClip[]> {
  try {
    const { data, error } = await supabase
      .from('channel_clips')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as ChannelClip[];
  } catch {
    return [];
  }
}

/**
 * Hook that provides clip recording capability for VideoPlayer.
 * Only records once per channel per session, and only when user is logged in.
 */
export function useClipRecorder(channel: IPTVChannel, user: AuthUser | null) {
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timerRef     = useRef<ReturnType<typeof setTimeout>>();
  const [recording, setRecording] = useState(false);

  const startRecording = useCallback(async (videoElement: HTMLVideoElement) => {
    // Only record once per channel per session
    if (recordedThisSession.has(channel.id)) return;
    // Must be authenticated to save
    if (!user) return;
    // Video must be playing
    if (videoElement.paused || videoElement.readyState < 2) return;

    // Check if a fresh clip already exists
    const existing = await fetchClipForChannel(channel.id);
    if (existing) {
      recordedThisSession.add(channel.id); // don't re-record
      return;
    }

    try {
      // Capture the video stream
      const stream = (videoElement as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
      if (!stream) return;

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
      if (!mimeType) return;

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setRecording(false);
        if (chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 10_000) return; // skip tiny/empty clips

        try {
          const ext       = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const path      = `${user.id}/${channel.id}-${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('channel-clips')
            .upload(path, blob, { contentType: mimeType, upsert: false });

          if (uploadErr) {
            console.warn('[Clip] Upload failed:', uploadErr.message);
            return;
          }

          const { data: urlData } = supabase.storage
            .from('channel-clips')
            .getPublicUrl(path);

          if (!urlData?.publicUrl) return;

          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          await supabase.from('channel_clips').insert({
            channel_id:   channel.id,
            storage_path: path,
            public_url:   urlData.publicUrl,
            duration_secs: 45,
            recorded_by:  user.id,
            expires_at:   expiresAt,
          });

          recordedThisSession.add(channel.id);
          console.log('[Clip] Saved for', channel.name);
        } catch (e) {
          console.warn('[Clip] DB insert failed:', e);
        }
      };

      recorder.start(1000); // collect in 1-second chunks
      setRecording(true);

      // Stop after 45 seconds
      timerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, CLIP_DURATION_MS);

    } catch (e) {
      console.warn('[Clip] Recording failed:', e);
    }
  }, [channel, user]);

  /**
   * Called by VideoPlayer ~8s after stream becomes ready + active.
   */
  const scheduleRecording = useCallback((videoElement: HTMLVideoElement) => {
    if (recordedThisSession.has(channel.id) || !user) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => startRecording(videoElement), MIN_RECORD_DELAY_MS);
  }, [channel.id, user, startRecording]);

  const stopRecording = useCallback(() => {
    clearTimeout(timerRef.current);
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  return { recording, scheduleRecording, stopRecording };
}
