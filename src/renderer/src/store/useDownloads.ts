import { create } from 'zustand'
import type { DownloadToolsStatus, YouTubeDownloadResult, YouTubeHit } from '@shared/types'
import { useApp } from './useApp'
import { usePlayer, ytId } from './usePlayer'

// Optional YouTube → MP3 downloads (Settings turns them on; the tools are fetched then). Holds the tools' status
// and the downloads in progress, for Settings and the music window.

type Job = { stage: 'download' | 'convert'; pct: number } | { error: Extract<YouTubeDownloadResult, { ok: false }>['error']; message?: string }

interface DownloadsState {
  tools: DownloadToolsStatus | null
  jobs: Record<string, Job>
  /** Downloads can start: turned on, both tools present. */
  ready: () => boolean
  download: (hit: YouTubeHit) => Promise<void>
  cancel: (videoId: string) => void
  dismiss: (videoId: string) => void
}

export const useDownloads = create<DownloadsState>()((set, get) => ({
  tools: null,
  jobs: {},
  ready: () => {
    const t = get().tools
    return !!t?.enabled && !!t.tools.ytdlp.installed && !!t.tools.ffmpeg.installed
  },
  download: async (hit) => {
    const id = hit.videoId
    if ('stage' in (get().jobs[id] ?? {})) return
    set((s) => ({ jobs: { ...s.jobs, [id]: { stage: 'download', pct: 0 } } }))
    const r = await window.nl.youtube.download(id, hit.title)
    if (!r.ok) {
      if (r.error === 'cancelled') get().dismiss(id)
      else set((s) => ({ jobs: { ...s.jobs, [id]: { error: r.error, message: r.message } } }))
      return
    }
    // Into the media library, and into the playlist in place of the YouTube video (after it, while it plays).
    useApp.setState((s) => ({ media: [r.media, ...s.media] }))
    const p = usePlayer.getState()
    const yid = ytId(id)
    const at = p.playlist.indexOf(yid)
    if (at < 0) p.add([r.media.id])
    else if (p.current === yid) usePlayer.setState({ playlist: [...p.playlist.slice(0, at + 1), r.media.id, ...p.playlist.slice(at + 1)] })
    else {
      const { [yid]: _gone, ...yt } = p.yt
      usePlayer.setState({ playlist: p.playlist.map((x) => (x === yid ? r.media.id : x)), yt })
    }
    set((s) => {
      const { [id]: _done, ...jobs } = s.jobs
      return { jobs }
    })
  },
  cancel: (videoId) => void window.nl.youtube.cancelDownload(videoId),
  dismiss: (videoId) =>
    set((s) => {
      const { [videoId]: _gone, ...jobs } = s.jobs
      return { jobs }
    })
}))

/** Load the status and follow changes (once, from the operator window). */
export function initDownloads(): void {
  if (!window.nl?.youtube?.tools) return
  window.nl.youtube.tools.status().then((tools) => useDownloads.setState({ tools }))
  window.nl.youtube.tools.onChange((tools) => useDownloads.setState({ tools }))
  window.nl.youtube.onDownloadProgress((p) =>
    useDownloads.setState((s) => (s.jobs[p.videoId] && 'stage' in s.jobs[p.videoId] ? { jobs: { ...s.jobs, [p.videoId]: { stage: p.stage, pct: p.pct } } } : {}))
  )
}
