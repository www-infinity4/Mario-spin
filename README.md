# Mario Spin 🍄

A Mario Bros themed slot machine game built on the ∞ Infinity System.

Spin the reels featuring real Mario Bros character images — Mushroom, Super Star, Goomba, Mario, Luigi, and Coin. Every spin generates a unique scientific research token committed to the repository.

## Features

- 🎰 5-reel slot machine with Mario Bros character images
- 🌟 Jackpot, Big Win, Super Win, and pair tiers
- 🔬 Auto-generated research tokens per spin (signal physics, electromagnetics, bioelectric fields, and more)
- 🤖 AI research chat (DuckDuckGo + Archive.org)
- 🔐 User auth with encrypted profile storage
- 📡 GitHub Actions integration to commit spin records
- 🪪 Unique device identity per browser
- 📦 Export spin history as HTML report
- ₿ **BTC Harvest** — every spin generates a simulated Bitcoin transaction; you earn **8%**, the ∞ treasury earns **92%**

## Symbols

| Symbol | Label | Value | Rarity | Research Domain |
|--------|-------|-------|--------|-----------------|
| Mushroom | MUSHROOM | 6 | Common | Mycology · Biochemistry · Electromagnetic Signals |
| Super Star | STAR | 10 | Rare | Astrophysics · Nuclear Fusion · Scalar Wave Physics |
| Goomba | GOOMBA | 2 | Very Common | Solid State Physics · Nanotechnology · Bioelectric Fields |
| NES Mario Scene | MARIO | 8 | Uncommon | Signal Medicine · Bioelectric Fields · EM Signals |
| Green Character | LUIGI | 5 | Common | Plasma Physics · Thermodynamics · Scalar Waves |
| Yellow Character | COIN | 3 | Very Common | Cryptography · Number Theory · Information Theory |

## Play

Open `index.html` in your browser or visit the GitHub Pages deployment.

Press **SPIN & GO!** or hit **Space** to spin the reels.

## BTC Harvest Setup

Each spin produces a simulated BTC transaction. Users receive **8%** and the ∞ Infinity treasury receives **92%**.

To register your Bitcoin address, sign in and use the **₿ BTC Harvest** panel. Your address is recorded in every spin token and included in the committed research file.

## GitHub Actions Setup (GHP Secret)

The app commits a research JSON file to the `spins/` directory on every spin via the `save-spin.yml` workflow. To enable this:

1. **Create a GitHub Personal Access Token (PAT)** with these permissions:
   - `Actions: Write` (to trigger `workflow_dispatch`)
   - `Contents: Write` (used by `save-spin.yml` to commit spin files)
2. **Add the PAT as a repository secret** named `GHP`:
   - Go to **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `GHP`, Value: your PAT
3. **Deploy** — the `deploy.yml` workflow injects the token into `assets/cfg.js` automatically on every push to `main`

> ⚠️ The `GHP` token is embedded in the deployed JavaScript. Keep its scope limited to Actions Write + Contents Write only.
