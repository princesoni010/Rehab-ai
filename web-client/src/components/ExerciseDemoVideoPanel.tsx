import { useEffect, useMemo, useRef, useState } from "react";
import { getExerciseVideoCandidates } from "../lib/exerciseVideo";

type ExerciseDemoVideoPanelProps = {
  exerciseName: string;
  assignmentId?: string;
  isPlaying: boolean;
};

export function ExerciseDemoVideoPanel({
  exerciseName,
  assignmentId,
  isPlaying,
}: ExerciseDemoVideoPanelProps) {
  const candidates = useMemo(
    () => getExerciseVideoCandidates(exerciseName),
    [exerciseName]
  );

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [missing, setMissing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevPlayingRef = useRef(isPlaying);

  const videoPath = candidates[candidateIndex] ?? "";

  // Reset source lookup and restart playback position when assigned exercise changes
  useEffect(() => {
    setCandidateIndex(0);
    setMissing(candidates.length === 0);
    const el = videoRef.current;
    if (el) {
      el.currentTime = 0;
    }
  }, [exerciseName, assignmentId, candidates.length]);

  // Sync play/pause state with the live exercise session
  useEffect(() => {
    const el = videoRef.current;
    if (!el || missing || !videoPath) return;

    el.muted = true;
    const justStarted = isPlaying && !prevPlayingRef.current;
    prevPlayingRef.current = isPlaying;

    if (isPlaying) {
      if (justStarted) {
        el.currentTime = 0;
      }
      void el.play().catch(() => {
        /* Ignore browser autoplay/abort rejections */
      });
    } else {
      el.pause();
    }
  }, [isPlaying, videoPath, missing]);

  // Keep fullscreen button icon synced when user exits fullscreen via ESC
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  if (!videoPath || missing) {
    return null;
  }

  const handleVideoError = () => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((prev) => prev + 1);
      return;
    }
    if (import.meta.env.DEV) {
      console.warn(
        `[ExerciseDemoVideo] Missing demo video for "${exerciseName}". Checked: ${candidates.join(", ")}`
      );
    }
    setMissing(true);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (videoRef.current?.requestFullscreen) {
        await videoRef.current.requestFullscreen();
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[ExerciseDemoVideo] Fullscreen toggle failed:", err);
      }
    }
  };

  return (
    <div ref={containerRef} className="demo-video-panel">
      <video
        ref={videoRef}
        src={videoPath}
        autoPlay
        loop
        muted
        playsInline
        className="demo-video-element"
        onLoadedMetadata={() => {
          const el = videoRef.current;
          if (!el) return;
          el.muted = true;
          if (isPlaying) {
            void el.play().catch(() => {});
          } else {
            el.pause();
          }
        }}
        onPlay={() => {
          if (!isPlaying) {
            videoRef.current?.pause();
          }
        }}
        onError={handleVideoError}
      />

      <button
        type="button"
        className="demo-video-fullscreen-btn"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? "Exit fullscreen video" : "Fullscreen video"}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        )}
      </button>
    </div>
  );
}
