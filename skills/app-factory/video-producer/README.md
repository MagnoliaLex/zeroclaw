# Video Producer

Promotional video generation for App Store listings.

## Inputs
- Project state with phase `icon_generation` (after icons are done)
- Screenshots from `submission_ready/screenshots/`
- Store listing for text overlays

## Outputs
- `submission_ready/promo_video.mp4`
- State → `submission_ready`

## Methods
1. **Votion API** (primary) — AI-generated promo video
2. **Slideshow fallback** — ffmpeg-based slideshow from screenshots

## Environment Variables
- `VOTION_API_KEY` — Votion API access
- `VOTION_API_URL` — Custom API endpoint (optional)
