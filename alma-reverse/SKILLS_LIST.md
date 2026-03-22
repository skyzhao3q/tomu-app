# Alma (Protan) 🌟 Skills List

Almaに同梱されている全 30 種類の標準スキル（拡張機能）の一覧です。
各スキルの詳細な Markdown 実装は `alma-prj/skills-design/` フォルダ内に 1スキル1ファイル で保存されています。

| Skill Name | 概要 (Description) |
| :--- | :--- |
| `browser` | Browser automation for AI agents. Use when the user needs to interact with websites — navigating, filling forms, clicking buttons, extracting data, taking screenshots, or automating any browser task. PinchTab (primary) for fresh automation, Chrome Relay (fallback) for the user's existing browser tabs. |
| `discord` | 'Interact with Discord: send messages, photos, files to any channel. Manage Discord bot integration with Alma.' |
| `file-manager` | Find, organize, and manage files on the user's computer. Search by name, type, size, or date. Move, rename, compress, and clean up files. |
| `image-gen` | "Generate and edit images using AI. Use when users ask to: create/draw/generate images, edit/modify photos, change backgrounds, add elements to images, create avatars, make logos, etc. Covers requests like 'draw a cat', 'change the background to blue', 'generate a logo'. NOT for selfies — use the selfie skill for 'send a selfie', 'send me a selfie', 'take a selfie'." |
| `memory-management` | Search and manage Alma's memory and conversation history. Use when the user asks about past conversations, personal facts, preferences, or anything that requires recalling information ("do you know my...", "we talked about before...", "do you remember...", "help me find what we said about..."). Also used to store new memories and search through archived chat threads. |
| `music-gen` | "Generate original songs with lyrics and vocals. Use when users ask to sing, create a song, make music, compose, or generate audio. Supports style prompts, custom lyrics, duration control, and instrumental mode." |
| `music-listener` | "Listen to and appreciate music files. Analyze audio for genre, mood, tempo, and lyrics. Use when users share audio/music files, ask about songs, or want music analysis." |
| `notebook` | Edit Jupyter notebook (.ipynb) cells — insert, replace, or delete cells. Use when working with notebooks. |
| `plan-mode` | Switch into structured planning mode before outlining multi-step solutions, and exit when done. |
| `reactions` | React to a message with an emoji. Works on Telegram, Discord, and Feishu. |
| `scheduler` | Create, manage, and delete scheduled tasks (cron jobs) and configure heartbeat. Use when users ask for reminders, recurring tasks, daily summaries, periodic checks, or anything time-based. Also manages HEARTBEAT.md for periodic awareness checks. |
| `screenshot` | Take screenshots of the screen using macOS screencapture. Use when users ask to see the screen, debug UI, or capture what's displayed. Resize before returning to avoid blowing up model context. |
| `self-management` | Read and update Alma's own settings via the `alma` CLI. MUST USE when users ask to change voice, TTS, models, or any configuration. Run `alma voices` to list voices, `alma config list` to see all settings. ALWAYS use this skill instead of guessing. |
| `self-reflection` | Daily self-reflection and personal growth. Triggered by heartbeat at end of day. Review the day's experiences, extract lessons, update personality, and write a diary entry. |
| `selfie` | "Take selfies with consistent face/appearance. Use when users ask for selfies, self-portraits, or say things like 'send a selfie', 'take a selfie', 'snap one'. NOT for general image generation or editing — use image-gen for those." |
| `send-file` | "Send files, photos, audio, or videos to the current conversation (channel chat or GUI thread). MUST use whenever you need to deliver any file to the user. Covers: sending images, selfies, generated art, documents, music, videos, voice messages, screenshots, or ANY file the user asks to see. Triggers: 'send it to me', 'send it over', 'let me see', 'send me', 'show me', 'send photo', 'send file', sharing any file path. NEVER paste raw file paths in text — ALWAYS use this skill to send files." |
| `skill-hub` | Search, install, and manage Alma skills from the skills.sh ecosystem. Use when the user needs a capability Alma doesn't have yet, or when you encounter a task you can't do with current skills. |
| `skill-search` | Search and install new skills to extend your capabilities. Use when you encounter a task beyond your current skills. |
| `system-info` | Get system information — OS version, disk usage, memory, running processes, network status. Use when users ask about their computer status or system health. |
| `tasks` | Global multi-step task tracking. Create, update, and monitor long-running tasks across threads. Tasks persist across restarts and are visible in all conversations. |
| `telegram` | "Interact with Telegram Bot API: send messages/photos/files/videos/audio/stickers/polls to any chat/group/channel, manage groups (pin/unpin/ban/kick/promote/restrict/set title/description/photo), forward/copy/delete/edit messages, react to messages, create invite links, manage forum topics, inline keyboards, and more. Use for ANY Telegram operation." |
| `thread-management` | Manage chat threads — create, list, switch, delete, and search conversations. Use when users want to organize their chats. |
| `todo` | Manage a structured task list using a Markdown file in the workspace. Track progress on complex multi-step tasks. File-based — just Read and Write the todo file. |
| `travel` | Virtual travel system. Explore real destinations, experience local culture, write travel diaries, and grow your personality through travel experiences. Manages departure, daily exploration, events, return, and personality evolution. |
| `twitter-media` | "Extract content from Twitter/X links — text, images, videos, and thumbnails. Use when users share any twitter.com or x.com URL, or when you need to fetch media from a tweet. Triggers: any URL containing twitter.com or x.com, 'what did they post', 'what's in this tweet', 'show me that tweet'." |
| `video-reader` | Read, watch, and listen to video/audio files. Use Gemini for native video understanding, or extract key frames + Whisper transcription as fallback. Use when a user sends a video/audio and asks about its content, what's in it, what someone said, etc. |
| `voice` | Generate voice messages using local Qwen3-TTS (offline, Apple Silicon). Convert text to speech with customizable voices, emotions, and speed. Use when user asks for voice reply, audio, or TTS. |
| `web-fetch` | Fetch and read web pages, APIs, and online content. Use when users share URLs or ask about web content. |
| `web-search` | Search the web for information using the built-in WebSearch tool. Use when users ask questions requiring up-to-date information, research, or fact-checking. |
| `xiaohongshu-cli` | "Use for ANY Xiaohongshu / 小红书 / Rednote / Little Red Book task: login, account status, search notes/users/topics, read note details/comments, browse feed and hot lists, like/favorite/comment/reply, follow/unfollow, check favorites/notifications/my-notes, post image notes, and delete your own notes." |
