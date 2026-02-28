# Larry Marketing

Social media marketing agent for App Factory apps.

## Inputs
- Project state with phase `submission_ready` or `marketing_active`
- Submission package (store listing, screenshots, video)

## Outputs
- Marketing content per platform
- Posting schedule
- Engagement metrics in `submission_ready/marketing/metrics.json`
- State → `marketing_active`

## Platforms
- X (Twitter) — threads with screenshots
- Reddit — detailed posts in relevant subreddits
- TikTok — short-form video captions
- Instagram — carousel posts

## Credential Isolation
Uses separate `LARRY_*` env var namespace. Never accesses main ZeroClaw credentials.
