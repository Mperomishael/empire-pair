# EMPIRE BOT-WAN — Pairing Portal

Public web service that issues WhatsApp Session IDs for forks of EMPIRE BOT-WAN.

## ⚠️ Hosting requirements

This service **must run on a persistent Node.js host**. It will not work on Vercel,
Netlify Functions, or AWS Lambda — Baileys requires a long-lived process that holds
an open WebSocket to WhatsApp for the entire pairing window (up to 5 minutes).

**Supported hosts:​**
- Render (free tier OK)
- Railway
- Koyeb (free tier OK)
- Fly.io
- Any VPS (DigitalOcean, Hetzner, Vultr, etc.)

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
