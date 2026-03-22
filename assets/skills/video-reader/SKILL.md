---
name: video-reader
description: Read, watch, and listen to video/audio files. Use Gemini for native video understanding, or extract key frames + Whisper transcription as fallback. Use when a user sends a video/audio and asks about its content, what's in it, what someone said, etc.
tools: [Bash]
---

# Video Reader Skill

## Primary Method: Gemini Native Video Understanding

### 🚨 MANDATORY: Use `tomu video analyze` for ALL video tasks. DO NOT use ffmpeg frame extraction unless `tomu video analyze` explicitly fails. Frame extraction is a LAST RESORT, not a default.

**Always use this** — Gemini can understand video natively (visual + audio).

```bash
# Analyze a video with Gemini (uploads to Gemini Files API)
tomu video analyze "/path/to/video.mp4" "Describe what's happening in this video"

# Custom prompts
tomu video analyze "/path/to/video.mp4" "What language are they speaking? Summarize what they said"
tomu video analyze "/path/to/video.mp4" "Is this video funny? Why?"
tomu video analyze "/path/to/video.mp4" "Transcribe all spoken words in this video"
```

This uses Gemini's native multimodal video input — no frame extraction needed. Works with mp4, mov, webm, avi, mkv, m4v, 3gp. Max file size: 2GB.

**When to use Gemini:**
- Any video understanding task
- "What's in this video", "What did they say", "Summarize this"
- Best quality results — sees motion, hears audio, understands context

## Fallback Method: Frame Extraction + Whisper

Use this if Gemini fails (no Google provider, API error, unsupported format):

```bash
# Get video info
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json "$VIDEO_PATH"

# Extract key frames (1 per second, max 12 frames)
OUTDIR=/tmp/tomu-frames-$(date +%s)
mkdir -p "$OUTDIR"
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO_PATH" | cut -d. -f1)
FPS_RATE=$(echo "scale=2; 12 / $DURATION" | bc 2>/dev/null || echo "1")
if (( $(echo "$FPS_RATE > 1" | bc -l 2>/dev/null || echo 0) )); then FPS_RATE=1; fi
ffmpeg -hide_banner -loglevel error -i "$VIDEO_PATH" -vf "fps=$FPS_RATE,scale=720:-1" -frames:v 12 "$OUTDIR/frame_%02d.jpg"
ls "$OUTDIR"
```

### Audio Transcription (Whisper)

```bash
# Extract audio
ffmpeg -hide_banner -loglevel error -i "$VIDEO_PATH" -vn -acodec pcm_s16le -ar 16000 -ac 1 "/tmp/tomu-audio-$(date +%s).wav"

# Transcribe
whisper "/tmp/tomu-audio.wav" --model turbo --output_format txt --output_dir /tmp/tomu-whisper
cat /tmp/tomu-whisper/*.txt
```

### Thumbnail Grid (quick overview)

```bash
ffmpeg -hide_banner -loglevel error -i "$VIDEO_PATH" \
  -vf "fps=1/$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO_PATH" | awk '{printf "%.1f", $1/9}'),scale=320:-1,tile=3x3" \
  -frames:v 1 "$OUTDIR/grid.jpg"
```

## Decision Flow

1. **ALWAYS**: Use `tomu video analyze` (Gemini native) — this is the ONLY correct first choice
2. **ONLY if `tomu video analyze` returns an error**: Fall back to frame extraction + Whisper
3. **Audio only** ("what did they say"): Can use Whisper directly
4. **Always clean up**: `rm -rf "$OUTDIR" /tmp/tomu-whisper /tmp/tomu-audio*.wav`

⚠️ **NEVER skip step 1.** Frame extraction loses motion, audio, and context. Gemini native video understanding is dramatically better. If you find yourself writing `ffmpeg` or `ffprobe` for video analysis WITHOUT first trying `tomu video analyze`, you are doing it wrong.
