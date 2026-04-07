'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { upsertLessonWatchTimeAction } from '@/modules/course/actions'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

interface VideoProgressPlayerProps {
  lessonId: string
  videoUrl: string
  initialWatchTime: number
  initialCompleted: boolean
  videoDuration?: number | null
}

type VideoSource =
  | { kind: 'html5'; src: string }
  | { kind: 'youtube'; src: string }
  | { kind: 'vimeo'; src: string }

function resolveVideoSource(url: string): VideoSource {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace('www.', '').toLowerCase()

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      if (id) {
        return { kind: 'youtube', src: `https://www.youtube.com/embed/${id}` }
      }
    }

    if (host.includes('youtube.com')) {
      const embedId = parsed.pathname.match(/\/embed\/([^/?]+)/)?.[1]
      const watchId = parsed.searchParams.get('v')
      const id = embedId || watchId

      if (id) {
        return { kind: 'youtube', src: `https://www.youtube.com/embed/${id}` }
      }
    }

    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.match(/\/(\d+)/)?.[1]
      if (id) {
        return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` }
      }
    }
  } catch {
    return { kind: 'html5', src: url }
  }

  return { kind: 'html5', src: url }
}

export function VideoProgressPlayer({
  lessonId,
  videoUrl,
  initialWatchTime,
  initialCompleted,
  videoDuration,
}: VideoProgressPlayerProps) {
  const source = resolveVideoSource(videoUrl)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastSavedRef = useRef<number>(initialWatchTime)
  const [isPending, startTransition] = useTransition()
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    if (source.kind !== 'html5') return

    const video = videoRef.current
    if (!video) return

    if (initialWatchTime > 0) {
      video.currentTime = initialWatchTime
    }

    const saveProgress = () => {
      const current = Math.floor(video.currentTime || 0)
      const duration = Math.floor(video.duration || videoDuration || 0)
      const completed =
        duration > 0 ? current >= Math.max(duration - 5, 1) : false

      if (!completed && Math.abs(current - lastSavedRef.current) < 10) return

      lastSavedRef.current = current
      startTransition(() => {
        upsertLessonWatchTimeAction({
          lessonId,
          watchTime: current,
          completed,
        })
      })
    }

    const onEnded = () => {
      const duration = Math.floor(video.duration || videoDuration || 0)
      startTransition(() => {
        upsertLessonWatchTimeAction({
          lessonId,
          watchTime: duration,
          completed: true,
        })
      })
    }

    const interval = window.setInterval(saveProgress, 12000)
    video.addEventListener('ended', onEnded)

    return () => {
      window.clearInterval(interval)
      video.removeEventListener('ended', onEnded)
      saveProgress()
    }
  }, [initialWatchTime, lessonId, source.kind, videoDuration])

  // Sync playback speed to video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
  }, [speed])

  if (source.kind !== 'html5') {
    return (
      <div className="space-y-2">
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            src={source.src}
            title="Vídeo da aula"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Reprodução em player externo. Para registrar conclusão, use o botão
          Marcar da aula.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full rounded-xl border border-border bg-black"
        src={source.src}
      />
      {/* Speed controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Velocidade:</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`h-6 px-2 rounded text-xs font-medium border transition-colors ${
              speed === s
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {s === 1 ? '1x' : `${s}x`}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {isPending
          ? 'Salvando progresso...'
          : initialCompleted
            ? 'Aula concluída.'
            : 'O progresso é salvo automaticamente.'}
      </p>
    </div>
  )
}
