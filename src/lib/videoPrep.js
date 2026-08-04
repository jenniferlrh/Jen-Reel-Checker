// Client-side video prep: pull out only what the analysis needs — a handful of
// JPEG frames and a small mono 16kHz WAV — so a 300MB phone video uploads as
// ~3MB and never hits the server's size limit. Falls back to raw upload when
// the browser can't decode the file (e.g. HEVC .mov on some desktop browsers).

const FRAME_WIDTH = 480
const AUDIO_RATE = 16000
const MAX_AUDIO_DECODE_BYTES = 200 * 1024 * 1024

function frameCount(duration) {
  // Longer video, more frames — extraction is local and cheap, so cover the
  // whole thing rather than sampling a 90s ad at one frame per 11 seconds.
  if (duration <= 20) return 8
  if (duration <= 45) return 12
  return 16
}

function coverTimestamps(duration) {
  // Dense in the opening (that's where covers come from), then spread out.
  const early = [0.3, 1, 2, 3].filter((t) => t < duration)
  const restN = Math.max(frameCount(duration) - early.length, 2)
  const start = Math.min(4, duration)
  const step = Math.max((duration - start) / restN, 0.1)
  const rest = []
  for (let i = 0; i < restN; i++) {
    rest.push(Math.min(start + step * i + step / 2, Math.max(duration - 0.3, 0)))
  }
  return [...early, ...rest]
}

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.duration || !isFinite(video.duration)) {
        reject(new Error('browser cannot decode this video'))
        return
      }
      resolve(video)
    }
    video.onerror = () => reject(new Error('browser cannot decode this video'))
  })
}

function seekTo(video, time) {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('seeked', done)
      resolve()
    }
    const fail = () => {
      video.removeEventListener('error', fail)
      reject(new Error('seek failed'))
    }
    video.addEventListener('seeked', done, { once: true })
    video.addEventListener('error', fail, { once: true })
    video.currentTime = time
  })
}

async function extractFrames(video, timestamps, onProgress) {
  const scale = FRAME_WIDTH / video.videoWidth
  const canvas = document.createElement('canvas')
  canvas.width = FRAME_WIDTH
  canvas.height = Math.round(video.videoHeight * scale)
  const ctx = canvas.getContext('2d')

  const frames = []
  const kept = []
  for (let i = 0; i < timestamps.length; i++) {
    try {
      await seekTo(video, timestamps[i])
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
      const b64 = dataUrl.split(',')[1]
      if (b64 && b64.length > 500) {
        frames.push(b64)
        kept.push(Math.round(timestamps[i] * 10) / 10)
      }
    } catch {
      // skip unreadable positions
    }
    onProgress?.(Math.round(((i + 1) / timestamps.length) * 70))
  }
  return { frames, timestamps: kept }
}

function encodeWav(channelData, sampleRate) {
  const n = channelData.length
  const buffer = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buffer)
  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, n * 2, true)
  let off = 44
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Uint8Array(buffer)
}

function toBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function extractAudio(file) {
  if (file.size > MAX_AUDIO_DECODE_BYTES) return null
  const AC = window.AudioContext || window.webkitAudioContext
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!AC || !OAC) return null

  const ctx = new AC()
  let decoded
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer())
  } catch {
    return null // no audio track, or a codec the browser won't decode
  } finally {
    ctx.close?.()
  }

  const frames = Math.ceil(decoded.duration * AUDIO_RATE)
  const offline = new OAC(1, frames, AUDIO_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return toBase64(encodeWav(rendered.getChannelData(0), AUDIO_RATE))
}

/**
 * Returns { frames, timestamps, duration, audioWav } or throws if the browser
 * can't read the file at all (caller should fall back to a raw upload).
 */
export async function prepVideo(file, onProgress) {
  const video = await loadVideo(file)
  try {
    const duration = video.duration
    const { frames, timestamps } = await extractFrames(video, coverTimestamps(duration), onProgress)
    if (!frames.length) throw new Error('no frames extracted')
    onProgress?.(75)
    const audioWav = await extractAudio(file)
    onProgress?.(95)
    return { frames, timestamps, duration: Math.round(duration * 10) / 10, audioWav }
  } finally {
    URL.revokeObjectURL(video.src)
    video.src = ''
  }
}
