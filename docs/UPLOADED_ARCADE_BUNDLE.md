# Uploaded Synch Pipe Arcade Bundle

## Status

This document records the August 5, 2026 audit of the uploaded Mario/Infinity arcade prototypes. The files were inspected locally and grouped for integration into `www-infinity4/Mario-spin`.

## Canonical candidates

### Primary arcade shell

**Source:** `mario3.html`

- Title: `Mario × Infinity — Synch Pipe Arcade`
- 1,644 lines
- Full-screen app shell
- Archive.org video portals
- EmulatorJS loader support
- localStorage state
- Mario shop, media, arcade, and Infinity visual language

This is the strongest all-in-one shell and should become the canonical `prototype/synch-pipe-arcade.html` after dependency cleanup.

### Primary playable level

**Source:** `mario-full.html`

- Title: `Mario × Infinity — Full Level`
- 1,128 lines
- Canvas-based level
- Mobile controller
- Capacitor meter
- Archive.org media links
- localStorage state

This should remain a separate playable experience rather than replacing the arcade shell.

### Compact alternate level

**Source:** `mario-full (1).html`

- 515 lines
- Smaller, simpler canvas implementation
- Useful as a low-memory fallback

Keep as `archive/mario-full-compact.html`.

### AI gateway

**Source:** `mario-nes-ai.html`

- Title: `Mario × Infinity AI — NES Gateway`
- Canvas world
- Wikipedia, Wikidata, DuckDuckGo, and AllOrigins requests
- localStorage state

Do not ship its public-proxy search path unchanged. Replace AllOrigins with a controlled server-side proxy or direct approved APIs.

### Emulator station

**Source:** `nes-emulator.html`

- Title: `NES Emulator — Synch Pipe Arcade`
- Internet Archive search and metadata calls
- EmulatorJS CDN loader
- ROM discovery interface

This is a useful emulator shell, but deployment must not imply that every discovered ROM is licensed for playback. Add an allowlist, rights notice, and user-owned-ROM mode.

### Shop world

**Source:** `mario-shop-world.html`

- Title: `Mario Shop World — Infinity Ignition`
- Pixel storefront
- Capacitor meter and world strip
- localStorage state
- depends on `/shared-components.js`

Integrate as a themed storefront/demo. Do not represent Nintendo-owned characters or branding as officially licensed.

### Reviews dataset

**Source:** `super-mario-bros-ost-sfx_reviews.xml`

- Two Archive-style review records
- One request asks for track titles
- One five-star nostalgia/phone-tone review
- average rating field: 5.00

Treat this as imported metadata, not verified product testimonials.

## File hashes

```text
mario3.html                         7f9b13d443277603
mario-full.html                    f1fc2f1be7d47095
mario-full (1).html                16089e4d8cfc4bf6
mario-nes-ai.html                  ae9a2f34105326d8
mario-shop-world.html              237c451e3070fba1
nes-emulator.html                  86c8003a585ba1dd
super-mario-bros-ost-sfx_reviews.xml 216a92b7d358236b
```

Hashes are the first 16 hexadecimal characters of SHA-256 and can be used to detect accidental changes during import.

## Required hardening before deployment

1. Remove Google-hosted fonts or self-host approved fonts.
2. Add a strict Content Security Policy.
3. Replace inline event handlers where present.
4. Restrict Archive.org embeds to approved identifiers.
5. Remove or replace public CORS proxy dependencies.
6. Add visible third-party trademark and licensing disclosures.
7. Keep ROM loading user-initiated and rights-aware.
8. Sanitize all query strings before inserting them into the page.
9. Version localStorage keys and provide a reset control.
10. Add reduced-motion mode and readable phone-size controls.
11. Do not use `user-scalable=no` as the only mobile strategy; the UI should remain readable while browser zoom stays available.
12. Keep each major experience as a separate route so one failure does not break the whole arcade.

## Proposed route map

```text
/
├── arcade/                 Synch Pipe launch hall
├── play/full-level/        Canonical playable level
├── play/compact/           Low-memory fallback
├── ai-gateway/             Infinity AI themed gateway
├── emulator/               Rights-aware emulator station
├── shop/                   Mario Shop World prototype
├── media/                  Approved Archive.org media
└── archive/                Original uploaded variants
```

## Deployment decision

Do not overwrite the current `main` entry point with the uploaded files. Import them on this branch, preserve their originals in an archive directory, then rebuild the canonical routes from the strongest sections.