/* =====================================================================
   Mario Spin — Digital Radio Tuner
   radio.js — live streaming radio via Radio Browser API (no key needed)
   CORS-enabled · community-driven · 30,000+ stations worldwide
   ===================================================================== */
/* global window, document, fetch */
window.RADIO = (() => {
  "use strict";

  /* ------------------------------------------------------------------
     RADIO BROWSER API — community mirrors, auto-failover
  ------------------------------------------------------------------ */
  const MIRRORS = [
    "https://de1.api.radio-browser.info/json",
    "https://nl1.api.radio-browser.info/json",
    "https://at1.api.radio-browser.info/json",
    "https://fi1.api.radio-browser.info/json",
  ];
  let mirrorIdx = 0;

  async function apiGet(path, params = {}) {
    let lastErr;
    for (let i = 0; i < MIRRORS.length; i++) {
      const base = MIRRORS[(mirrorIdx + i) % MIRRORS.length];
      try {
        const url = new URL(base + path);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
        const r = await fetch(url.toString(), {
          headers: { "User-Agent": "MarioSpinRadio/1.0", Accept: "application/json" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        mirrorIdx = (mirrorIdx + i) % MIRRORS.length;
        return await r.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("All Radio Browser mirrors failed.");
  }

  /* ------------------------------------------------------------------
     CURATED GENRE PRESETS — each maps to a Radio Browser tag
  ------------------------------------------------------------------ */
  const GENRES = [
    { label: "🎮 Gaming / Chiptune", tag: "chiptune" },
    { label: "🌟 Top Hits",          tag: "top40"    },
    { label: "🍄 8-bit / Retro",     tag: "8bit"     },
    { label: "🎵 Pop",               tag: "pop"      },
    { label: "🎸 Rock",              tag: "rock"     },
    { label: "🎷 Jazz",              tag: "jazz"     },
    { label: "🎹 Classical",         tag: "classical"},
    { label: "🔊 Electronic",        tag: "electronic"},
    { label: "🌍 World Music",       tag: "world"    },
    { label: "📰 News / Talk",       tag: "news"     },
    { label: "🎤 Hip-Hop",           tag: "hiphop"   },
    { label: "🌊 Lofi / Chill",      tag: "lofi"     },
    { label: "🌌 Space / Ambient",   tag: "ambient"  },
    { label: "🇬🇧 UK",               tag: "uk"       },
    { label: "🇺🇸 USA",              tag: "usa"      },
    { label: "🇯🇵 Japan",            tag: "japan"    },
  ];

  /* ------------------------------------------------------------------
     STATE
  ------------------------------------------------------------------ */
  let stations   = [];
  let stationIdx = -1;
  let audio      = null;
  let isPlaying  = false;
  let isBusy     = false;   // loading/connecting
  let scanTimer  = null;
  let isScanning = false;
  let volume     = 0.65;

  /* ------------------------------------------------------------------
     RENDER — inject the radio panel HTML into a mount element
  ------------------------------------------------------------------ */
  function render(mountId) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    mount.innerHTML = `
<section class="panel radio-panel" id="radioPanel">
  <div class="panel-head">
    <span class="panel-title">📻 Digital Radio Tuner</span>
    <div class="panel-head-actions">
      <span class="radio-signal" id="radioSignal" title="Signal">
        <span class="radio-bar" id="rb1"></span>
        <span class="radio-bar" id="rb2"></span>
        <span class="radio-bar" id="rb3"></span>
        <span class="radio-bar" id="rb4"></span>
      </span>
      <button class="btn btn-xs btn-ghost" id="radioMuteBtn" title="Mute/Unmute">🔊</button>
    </div>
  </div>
  <div class="panel-body">

    <!-- Now Playing -->
    <div class="radio-now-playing" id="radioNowPlaying">
      <div class="radio-lcd">
        <div class="radio-lcd-top">
          <span class="radio-station-name" id="radioStationName">— Select a genre to begin —</span>
          <span class="radio-status" id="radioStatus">STANDBY</span>
        </div>
        <div class="radio-lcd-bot">
          <span class="radio-station-meta" id="radioStationMeta"></span>
          <span class="radio-bitrate" id="radioBitrate"></span>
        </div>
      </div>
    </div>

    <!-- Volume -->
    <div class="radio-vol-row">
      <span class="radio-vol-label">🔉</span>
      <input type="range" id="radioVolume" class="radio-vol-slider"
             min="0" max="100" value="65" aria-label="Radio volume" />
      <span class="radio-vol-label">🔊</span>
    </div>

    <!-- Genre / Search -->
    <div class="radio-controls-row">
      <select id="radioGenre" class="filter-select radio-genre-select" aria-label="Select genre">
        <option value="">— Choose genre —</option>
        ${GENRES.map((g) => `<option value="${g.tag}">${g.label}</option>`).join("")}
      </select>
      <input type="text" id="radioSearch" class="form-input radio-search"
             placeholder="Search station…" aria-label="Search radio station" />
      <button class="btn btn-xs" id="radioSearchBtn">🔍</button>
    </div>

    <!-- Transport controls -->
    <div class="radio-transport">
      <button class="radio-btn" id="radioPrevBtn"  title="Previous station">⏮</button>
      <button class="radio-btn radio-btn-play" id="radioPlayBtn" title="Play / Pause">▶</button>
      <button class="radio-btn" id="radioNextBtn"  title="Next station">⏭</button>
      <button class="radio-btn radio-btn-scan ${isScanning ? "active" : ""}" id="radioScanBtn" title="Auto-scan">⟳ SCAN</button>
      <button class="radio-btn" id="radioStopBtn"  title="Stop">■</button>
    </div>

    <!-- Station list -->
    <div class="radio-station-list" id="radioStationList">
      <div class="radio-empty" id="radioEmpty">Choose a genre or search to load stations.</div>
    </div>

  </div>
</section>`;

    wireUI();
  }

  /* ------------------------------------------------------------------
     WIRE UI EVENTS
  ------------------------------------------------------------------ */
  function wireUI() {
    const genreSelect = document.getElementById("radioGenre");
    const searchInput = document.getElementById("radioSearch");
    const searchBtn   = document.getElementById("radioSearchBtn");
    const playBtn     = document.getElementById("radioPlayBtn");
    const prevBtn     = document.getElementById("radioPrevBtn");
    const nextBtn     = document.getElementById("radioNextBtn");
    const scanBtn     = document.getElementById("radioScanBtn");
    const stopBtn     = document.getElementById("radioStopBtn");
    const volSlider   = document.getElementById("radioVolume");
    const muteBtn     = document.getElementById("radioMuteBtn");

    genreSelect.addEventListener("change", () => {
      const tag = genreSelect.value;
      if (tag) loadByTag(tag);
    });

    searchBtn.addEventListener("click", () => {
      const q = searchInput.value.trim();
      if (q) loadBySearch(q);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); searchBtn.click(); }
    });

    playBtn.addEventListener("click", togglePlay);
    prevBtn.addEventListener("click", () => stepStation(-1));
    nextBtn.addEventListener("click", () => stepStation(1));
    stopBtn.addEventListener("click", stopRadio);
    scanBtn.addEventListener("click", toggleScan);

    volSlider.addEventListener("input", () => {
      volume = volSlider.value / 100;
      if (audio) audio.volume = volume;
    });

    muteBtn.addEventListener("click", () => {
      if (!audio) return;
      audio.muted = !audio.muted;
      muteBtn.textContent = audio.muted ? "🔇" : "🔊";
    });
  }

  /* ------------------------------------------------------------------
     LOAD STATIONS
  ------------------------------------------------------------------ */
  async function loadByTag(tag) {
    setBusy(true);
    setStatus("LOADING");
    setStationName(`Loading ${tag}…`);
    try {
      stations   = await apiGet(`/stations/bytag/${encodeURIComponent(tag)}`, {
        limit: 60, hidebroken: "true", order: "votes", reverse: "true",
      });
      stationIdx = 0;
      renderStationList();
      if (stations.length) {
        playStation(0);
      } else {
        setStationName("No stations found. Try another genre.");
        setStatus("EMPTY");
      }
    } catch (e) {
      setStationName(`Error: ${e.message}`);
      setStatus("ERR");
    } finally {
      setBusy(false);
    }
  }

  async function loadBySearch(query) {
    setBusy(true);
    setStatus("SEARCHING");
    setStationName(`Searching "${query}"…`);
    try {
      stations = await apiGet(`/stations/byname/${encodeURIComponent(query)}`, {
        limit: 60, hidebroken: "true", order: "votes", reverse: "true",
      });
      stationIdx = 0;
      renderStationList();
      if (stations.length) {
        playStation(0);
      } else {
        setStationName("No stations found.");
        setStatus("EMPTY");
      }
    } catch (e) {
      setStationName(`Error: ${e.message}`);
      setStatus("ERR");
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------------
     PLAYBACK
  ------------------------------------------------------------------ */
  function playStation(idx) {
    if (!stations.length) return;
    idx = Math.max(0, Math.min(idx, stations.length - 1));
    stationIdx = idx;

    const st = stations[idx];
    if (!st || !st.url_resolved) { stepStation(1); return; }

    stopRadio();

    setStatus("CONNECTING");
    setStationName(st.name || "Unknown Station");
    setStationMeta(`${st.country || ""} ${st.tags ? "· " + st.tags.slice(0, 40) : ""}`);
    setBitrate(st.bitrate ? st.bitrate + " kbps" : "");
    highlightRow(idx);
    animateSignal(true);

    audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.volume      = volume;
    audio.preload     = "none";

    audio.addEventListener("playing", () => {
      isPlaying = true;
      setStatus("ON AIR");
      animateSignal(true);
      updatePlayBtn();
      // Register play with community
      if (st.stationuuid) {
        apiGet(`/url/${st.stationuuid}`).catch(() => {});
      }
    });

    audio.addEventListener("waiting", () => { setStatus("BUFFERING"); animateSignal(false); });
    audio.addEventListener("stalled", () => { setStatus("STALLED");   animateSignal(false); });
    audio.addEventListener("error",   () => { setStatus("ERROR — skipping"); stepStation(1); });
    audio.addEventListener("ended",   () => { if (isScanning) return; stepStation(1); });
    audio.addEventListener("pause",   () => { if (!audio.ended) { isPlaying = false; setStatus("PAUSED"); animateSignal(false); updatePlayBtn(); } });

    audio.src = st.url_resolved;
    audio.play().catch(() => { setStatus("BLOCKED — click play"); updatePlayBtn(); });
  }

  function togglePlay() {
    if (!stations.length) return;
    if (!audio || audio.src === "" || audio.ended) {
      playStation(stationIdx >= 0 ? stationIdx : 0);
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function stopRadio() {
    clearScanTimer();
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    isPlaying = false;
    isScanning = false;
    setStatus("STOPPED");
    animateSignal(false);
    updatePlayBtn();
    updateScanBtn();
  }

  function stepStation(delta) {
    if (!stations.length) return;
    let next = stationIdx + delta;
    if (next < 0) next = stations.length - 1;
    if (next >= stations.length) next = 0;
    playStation(next);
  }

  /* ------------------------------------------------------------------
     AUTO-SCAN
  ------------------------------------------------------------------ */
  function toggleScan() {
    if (isScanning) {
      clearScanTimer();
      isScanning = false;
    } else {
      isScanning = true;
      startScan();
    }
    updateScanBtn();
  }

  function startScan() {
    if (!stations.length) return;
    playStation(stationIdx >= 0 ? stationIdx : 0);
    scanTimer = setInterval(() => {
      if (!isScanning) { clearScanTimer(); return; }
      stepStation(1);
    }, 8000);
  }

  function clearScanTimer() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  }

  /* ------------------------------------------------------------------
     STATION LIST RENDER
  ------------------------------------------------------------------ */
  function renderStationList() {
    const listEl = document.getElementById("radioStationList");
    const emptyEl = document.getElementById("radioEmpty");
    if (!listEl) return;

    listEl.innerHTML = "";

    if (!stations.length) {
      listEl.innerHTML = `<div class="radio-empty">No stations found.</div>`;
      return;
    }

    stations.forEach((st, i) => {
      const row = document.createElement("div");
      row.className = `radio-row${i === stationIdx ? " active" : ""}`;
      row.id = `radioRow${i}`;
      row.innerHTML = `
        <span class="radio-row-fav" title="Favourite" data-idx="${i}">☆</span>
        <span class="radio-row-name">${escH(st.name || "Unknown")}</span>
        <span class="radio-row-meta">${escH(st.country || "")}${st.bitrate ? " · " + st.bitrate + "k" : ""}</span>
      `;
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("radio-row-fav")) {
          toggleFav(i, e.target);
        } else {
          playStation(i);
        }
      });
      listEl.appendChild(row);
    });
  }

  function highlightRow(idx) {
    document.querySelectorAll(".radio-row").forEach((r, i) => {
      r.classList.toggle("active", i === idx);
    });
    const row = document.getElementById(`radioRow${idx}`);
    if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ------------------------------------------------------------------
     FAVOURITES (localStorage)
  ------------------------------------------------------------------ */
  const FAV_KEY = "ms_radio_favs_v1";

  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); }
    catch (_) { return []; }
  }

  function toggleFav(idx, starEl) {
    const st = stations[idx];
    if (!st) return;
    const favs = getFavs();
    const existing = favs.findIndex((f) => f.url_resolved === st.url_resolved);
    if (existing >= 0) {
      favs.splice(existing, 1);
      starEl.textContent = "☆";
    } else {
      favs.push({ name: st.name, url_resolved: st.url_resolved, country: st.country, bitrate: st.bitrate });
      starEl.textContent = "★";
    }
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  }

  /* ------------------------------------------------------------------
     SIGNAL ANIMATION
  ------------------------------------------------------------------ */
  let signalAnim = null;

  function animateSignal(active) {
    const bars = ["rb1", "rb2", "rb3", "rb4"].map((id) => document.getElementById(id));
    if (!active) {
      bars.forEach((b) => { if (b) { b.style.height = "4px"; b.classList.remove("live"); } });
      if (signalAnim) { clearInterval(signalAnim); signalAnim = null; }
      return;
    }
    if (signalAnim) return;
    const heights = [6, 10, 14, 18, 14, 10, 6, 4];
    let t = 0;
    signalAnim = setInterval(() => {
      bars.forEach((b, i) => {
        if (!b) return;
        const h = heights[(t + i * 2) % heights.length];
        b.style.height = h + "px";
        b.classList.add("live");
      });
      t++;
    }, 120);
  }

  /* ------------------------------------------------------------------
     UI HELPERS
  ------------------------------------------------------------------ */
  function setStatus(txt) {
    const el = document.getElementById("radioStatus");
    if (el) el.textContent = txt;
  }

  function setStationName(txt) {
    const el = document.getElementById("radioStationName");
    if (el) el.textContent = txt;
  }

  function setStationMeta(txt) {
    const el = document.getElementById("radioStationMeta");
    if (el) el.textContent = txt;
  }

  function setBitrate(txt) {
    const el = document.getElementById("radioBitrate");
    if (el) el.textContent = txt;
  }

  function setBusy(b) {
    isBusy = b;
    const playBtn = document.getElementById("radioPlayBtn");
    if (playBtn) playBtn.disabled = b;
  }

  function updatePlayBtn() {
    const btn = document.getElementById("radioPlayBtn");
    if (!btn) return;
    btn.textContent = isPlaying ? "⏸" : "▶";
  }

  function updateScanBtn() {
    const btn = document.getElementById("radioScanBtn");
    if (!btn) return;
    btn.classList.toggle("active", isScanning);
    btn.textContent = isScanning ? "⟳ SCANNING…" : "⟳ SCAN";
  }

  function escH(s) {
    return String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
    );
  }

  /* ------------------------------------------------------------------
     PUBLIC API
  ------------------------------------------------------------------ */
  return { render, loadByTag, loadBySearch, stopRadio, playStation };
})();
