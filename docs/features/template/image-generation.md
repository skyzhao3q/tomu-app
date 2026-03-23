# Image Generation

WorkTomo can generate images using AI and stores all generated images in a built-in gallery. Image generation requires a connected [media provider](../settings/media-providers.md) (Google Gemini).

## Prerequisites

Connect a media provider before using image generation:

1. Go to **Settings > Media Providers**.
2. Add your Google Gemini API key.
3. Select the Gemini model to use for image generation.

Once connected, the image generation mode becomes available in the chat input toolbar.

## Generating an image

1. Click the **image icon** in the chat input toolbar to switch to Image Generation mode. A badge appears confirming the mode is active.
2. Type your image prompt and press **Enter**.
3. The agent generates the image and it appears inline in the chat. It is also added to the Gallery automatically.

**Example prompts:**
- `A clean product diagram showing three microservices communicating via an event bus`
- `A watercolor illustration of a mountain sunrise`
- `A dark-mode UI mockup of a dashboard with charts and a sidebar`

## Gallery

All generated images are stored in the **Gallery**, accessible from the sidebar.

### Browsing the gallery

- Images appear in a responsive grid sorted by most recent.
- Click any image for a **fullscreen preview**.

### Filtering

Use the filter controls at the top to narrow the gallery:
- **All** — show everything
- **Favorites** — show only starred images
- **Tags** — filter by one or more tags

### Image actions

Right-click or hover an image to access:

| Action | Description |
|--------|-------------|
| **Favorite / Unfavorite** | Star an image for quick access |
| **Add tag** | Apply one or more tags |
| **View metadata** | See the prompt, model, aspect ratio, resolution, and date |
| **Open in system viewer** | Open with your OS's default image app |
| **Show in Finder / Explorer** | Reveal the file on disk |
| **Delete** | Remove the image from the gallery |

### Tags

Tags help you organize images by project, style, or any category you choose. To manage tags:
- Click **+ Tag** on any image to create a new tag or apply an existing one.
- Use the tag filter at the top of the gallery to filter by tag.
- Remove a tag from an image by clicking the tag badge and selecting **Remove**.

## Related

- [Media Providers Settings](../settings/media-providers.md)
- [Chat & AI Agent](chat-and-ai-agent.md)
