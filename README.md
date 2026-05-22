# EMPIRE BOT-WAN — Pairing Portal

Public web service that issues WhatsApp Session IDs for forks of EMPIRE BOT-WAN.

## Hosting

Deploy this to any persistent Node host:
- Back4App Web Deployment (free, no card)
- Render, Railway, Koyeb, Fly.io
- Any VPS

**Will not work on:​** Vercel, Netlify Functions, AWS Lambda, Cloudflare Workers
(Baileys requires a long-lived process and persistent WebSocket.)

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `HOST` | `0.0.0.0` | Bind address |
| `BRAND_NAME` | `EMPIRE BOT-WAN` | Shown in UI and WhatsApp browser fingerprint |
| `SESSION_PREFIX` | `EMPIRE~` | Prefix for generated Session IDs |
| `PAIR_TIMEOUT_MS` | `300000` | How long users have to complete pairing |
| `RATE_LIMIT_PER_HOUR` | `20` | Max pairings per IP per hour |
