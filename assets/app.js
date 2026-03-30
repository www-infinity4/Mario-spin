/* =====================================================================
   Mario Spin — ∞ Infinity Slot Machine
   app.js — spin logic, reel animation, research integration,
            auth wiring, AI chat, GitHub API commit
   ===================================================================== */
(() => {
  "use strict";

  /* ------------------------------------------------------------------
     SYMBOLS — Mario Bros themed, using uploaded image assets
  ------------------------------------------------------------------ */
  const SYMBOLS = [
    { img: "assets/images/1200px-SMP_Dash_Mushroom.png",
      label: "MUSHROOM", value: 6, weight: 6 },
    { img: "assets/images/Cute-3D-Mario-Super-Star-PNG-Vector-Golden-Color-Cartoon-Nintendo.jpg",
      label: "STAR", value: 10, weight: 3 },
    { img: "assets/images/Goomba_by_Shigehisa_Nakaue.png",
      label: "GOOMBA",   value: 2, weight: 10 },
    { img: "assets/images/Recordando-Super-Mario-Bros-NES-10.jpg",
      label: "MARIO",    value: 8, weight: 4 },
    { img: "assets/images/3a083df05201781d56433d893565e39edca3e161_large.jpg",
      label: "LUIGI",    value: 5, weight: 7 },
    { img: "assets/images/3d2e69f35ad37e1d79141b16ab2f341c.jpg",
      label: "COIN",     value: 3, weight: 10 },
  ];

  const REEL_COUNT    = 5;
  const SYMBOL_HEIGHT = 160;

  /* ------------------------------------------------------------------
     STATE
  ------------------------------------------------------------------ */
  let spinCount  = 0;
  let totalScore = 0;
  let totalBtcEarned = 0;
  let isSpinning = false;
  let history    = [];   // { spinData, commitInfo, article }
  let lastArticle = null;
  let cfg = { owner: "", repo: "", branch: "main" };

  /* ------------------------------------------------------------------
     DOM REFS
  ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const strips         = Array.from({ length: REEL_COUNT }, (_, i) => $(`strip${i}`));
  const spinBtn        = $("spinBtn");
  const spinCounterEl  = $("spinCounter");
  const scoreCounterEl = $("scoreCounter");
  const resultBar      = $("resultBar");
  const resultText     = $("resultText");
  const consoleLog     = $("consoleLog");
  const historyEl      = $("history");
  const histCountEl    = $("histCount");
  const winOverlay     = $("winOverlay");
  const lever          = $("lever");
  const chatInput      = $("chatInput");

  /* ------------------------------------------------------------------
     WEIGHTED RANDOM SYMBOL PICK
  ------------------------------------------------------------------ */
  const totalWeight = SYMBOLS.reduce((a, s) => a + s.weight, 0);
  function pickSymbol() {
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) { r -= s.weight; if (r <= 0) return s; }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  /* ------------------------------------------------------------------
     BUILD A REEL SYMBOL ELEMENT
  ------------------------------------------------------------------ */
  function makeSymbolEl(sym) {
    const div = document.createElement("div");
    div.className = "reel-symbol";
    const img = document.createElement("img");
    img.src = sym.img;
    img.alt = sym.label;
    img.className = "sym-img";
    img.draggable = false;
    const lbl = document.createElement("span");
    lbl.className = "sym-label";
    lbl.textContent = sym.label;
    div.appendChild(img);
    div.appendChild(lbl);
    return div;
  }

  /* ------------------------------------------------------------------
     REEL INIT
  ------------------------------------------------------------------ */
  function buildStrip(stripEl) {
    stripEl.innerHTML = "";
    for (let i = 0; i < 24; i++) {
      stripEl.appendChild(makeSymbolEl(pickSymbol()));
    }
  }
  function initReels() { strips.forEach((s) => buildStrip(s)); }

  /* ------------------------------------------------------------------
     SPIN ANIMATION
  ------------------------------------------------------------------ */
  function animateReel(reelEl, stripEl, finalSymbol, delay, duration) {
    return new Promise((resolve) => {
      setTimeout(() => {
        stripEl.innerHTML = "";
        const count = 20;
        for (let i = 0; i < count; i++) {
          const sym = (i === count - 1) ? finalSymbol : pickSymbol();
          stripEl.appendChild(makeSymbolEl(sym));
        }
        const farY = (count - 2) * SYMBOL_HEIGHT;
        stripEl.style.transition = "none";
        stripEl.style.transform  = `translateY(${farY}px)`;
        void stripEl.offsetHeight;
        stripEl.style.transition = `transform ${duration}ms cubic-bezier(.17,.67,.35,1.05)`;
        const endY = -(count - 1) * SYMBOL_HEIGHT;
        stripEl.style.transform  = `translateY(${endY}px)`;

        let settled = false;
        function settleReel() {
          if (settled) return;
          settled = true;
          stripEl.innerHTML = "";
          stripEl.appendChild(makeSymbolEl(finalSymbol));
          stripEl.style.transition = "none";
          stripEl.style.transform  = "translateY(0)";
          reelEl.classList.remove("spinning");
          resolve();
        }
        stripEl.addEventListener("transitionend", settleReel, { once: true });
        setTimeout(settleReel, duration + 500);
      }, delay);
    });
  }

  /* ------------------------------------------------------------------
     EVALUATE RESULT
  ------------------------------------------------------------------ */
  function evaluate(symbols) {
    const counts = {};
    symbols.forEach((s) => { counts[s.label] = (counts[s.label] || 0) + 1; });
    const max   = Math.max(...Object.values(counts));
    const total = symbols.reduce((a, s) => a + s.value, 0);
    if (max === 5) return { tier: "jackpot",    label: "🌟 SUPER STAR! ALL MATCH!",       score: total * 50 };
    if (max === 4) return { tier: "win-big",    label: "🍄 POWER-UP! 4 of a kind!",       score: total * 12 };
    if (max === 3) return { tier: "win-medium", label: "⭐ SUPER WIN! 3 of a kind!",      score: total * 5  };
    if (max === 2) return { tier: "win-small",  label: "✅ WIN! Pair found!",              score: total * 2  };
    return           { tier: "lose",          label: "🔄 No match. Try again!",           score: 0          };
  }

  /* ------------------------------------------------------------------
     AUTH TOKEN
  ------------------------------------------------------------------ */
  function getAuthToken() { return (window.MARIO_SPIN_TOKEN || "").trim(); }

  /* ------------------------------------------------------------------
     BTC HARVEST — simulated Bitcoin reward per spin
     Treasury keeps 92 %; user earns 8 %.
     Base amount in BTC per tier (very small amounts, game mechanic).
  ------------------------------------------------------------------ */
  const BTC_TIER = {
    jackpot:    0.00005,   // 5000 satoshis
    "win-big":  0.000012,  // 1200 satoshis
    "win-medium":0.000005, //  500 satoshis
    "win-small":0.000002,  //  200 satoshis
    lose:       0.0000001, //   10 satoshis
  };
  const BTC_USER_PCT    = 0.08;   // 8 % to user
  const BTC_TREASURY    = 0.92;   // 92 % to ∞ treasury
  const TREASURY_ADDR   = "bc1qinfinity4treasury0000000000000000000000000";

  function calcBtcReward(tier) {
    const total   = BTC_TIER[tier] || BTC_TIER.lose;
    const user    = parseFloat((total * BTC_USER_PCT).toFixed(8));
    const treasury = parseFloat((total * BTC_TREASURY).toFixed(8));
    return { btcTransaction: total, btcUserShare: user, btcTreasury: treasury };
  }

  /* ------------------------------------------------------------------
     GITHUB API — TRIGGER SAVE-SPIN WORKFLOW
  ------------------------------------------------------------------ */
  async function commitSpinRecord(spinData) {
    const token = getAuthToken();
    const { owner, repo, branch } = cfg;
    if (!token || !owner || !repo) {
      log("⚠️  GHP secret not available — skipping repo commit (local spin only).", "warn");
      return null;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `spins/spin-${ts}.json`;
    if (!/^spins\/spin-[\dT-]+\.json$/.test(filename)) {
      log("❌ Invalid spin filename — aborting commit.", "err");
      return null;
    }
    const targetBranch = branch || "main";
    const dispatchUrl =
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/save-spin.yml/dispatches`;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    try {
      log(`📡 Submitting spin → ${filename}`, "");
      const res = await fetch(dispatchUrl, {
        method: "POST", headers,
        body: JSON.stringify({
          ref: targetBranch,
          inputs: { spin_data: JSON.stringify(spinData, null, 2), filename },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        log(`❌ GitHub API error ${res.status}: ${err.message || res.statusText}`, "err");
        return null;
      }
      const actionsUrl = `https://github.com/${owner}/${repo}/actions`;
      log(`✅ Spin queued → ${filename} (workflow running…)`, "ok");
      return { sha: null, url: actionsUrl, filename };
    } catch (e) {
      log(`❌ Network error: ${e.message}`, "err");
      return null;
    }
  }

  /* ------------------------------------------------------------------
     COIN BURST
  ------------------------------------------------------------------ */
  function burstCoins(count = 6) {
    const machine = $("machine");
    const emojis  = ["🪙", "⭐", "🍄", "🌟", "💰", "🎮"];
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el   = document.createElement("div");
        el.className = "coin-burst";
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left  = `${10 + Math.random() * 80}%`;
        el.style.top   = `${20 + Math.random() * 50}%`;
        const dx = (Math.random() - .5) * 160;
        const dy = -(60 + Math.random() * 120);
        el.style.setProperty("--dx", `${dx}px`);
        el.style.setProperty("--dy", `${dy}px`);
        machine.appendChild(el);
        el.addEventListener("animationend", () => el.remove(), { once: true });
      }, i * 80);
    }
  }

  /* ------------------------------------------------------------------
     LEVER
  ------------------------------------------------------------------ */
  function pullLever() {
    lever.classList.add("pulled");
    setTimeout(() => lever.classList.remove("pulled"), 500);
  }

  /* ------------------------------------------------------------------
     LOGGER
  ------------------------------------------------------------------ */
  function log(msg, type = "") {
    const ts   = new Date().toLocaleTimeString();
    const line = `[${ts}] ${msg}\n`;
    if (type === "err")  consoleLog.innerHTML += `<span class="log-err">${escHtml(line)}</span>`;
    else if (type === "ok")   consoleLog.innerHTML += `<span class="log-ok">${escHtml(line)}</span>`;
    else if (type === "warn") consoleLog.innerHTML += `<span class="log-warn">${escHtml(line)}</span>`;
    else consoleLog.textContent += line;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  function escHtml(s) {
    return s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
    );
  }

  /* ------------------------------------------------------------------
     RESEARCH PANEL — preview after spin
  ------------------------------------------------------------------ */
  function renderResearchPreview(article) {
    const panel   = $("researchPanel");
    const preview = $("researchPreview");
    const meta    = $("researchPanelMeta");
    if (!panel || !preview || !article) return;
    meta.textContent = `IF: ${article.impactFactor} · ${(article.domains || []).slice(0, 2).join(", ").replace(/_/g, " ")}`;
    const btcLine = article.btcTransaction != null
      ? `<div class="res-btc">₿ BTC Harvest: <strong>${article.btcTransaction.toFixed(8)}</strong> total — You earn <strong>${article.btcUserShare.toFixed(8)} BTC</strong> (8%) · Treasury: ${article.btcTreasury.toFixed(8)} BTC (92%)${article.btcAddress ? ` → <code>${escHtml(article.btcAddress)}</code>` : ""}</div>`
      : "";
    preview.innerHTML = `
      <div class="res-title">${escHtml(article.title)}</div>
      <div class="res-meta">
        <span>👥 ${escHtml((article.authors || []).join(", "))}</span>
        <span>📰 ${escHtml(article.journal)} (${article.year})</span>
        <span>DOI: ${escHtml(article.doi)}</span>
      </div>
      <div class="res-keywords">${(article.keywords || []).map((k) => `<span class="res-kw">${escHtml(k)}</span>`).join("")}</div>
      ${btcLine}
      <div class="res-abstract">${escHtml(article.abstract)}</div>
    `;
    panel.style.display = "";
  }

  /* ------------------------------------------------------------------
     BTC DISPLAY — update user badge + BTC panel
  ------------------------------------------------------------------ */
  function updateBtcDisplay() {
    const val = `₿ ${totalBtcEarned.toFixed(8)}`;
    const btcBadge = $("btcBadge");
    if (btcBadge) btcBadge.textContent = val;
    const btcBadgePanel = $("btcBadgePanel");
    if (btcBadgePanel) btcBadgePanel.textContent = val;
  }

  /* ------------------------------------------------------------------
     RESEARCH MODAL — full article
  ------------------------------------------------------------------ */
  function showResearchModal(article) {
    if (!article) return;
    const body   = $("researchModalBody");
    const extCtx = article.externalContext
      ? `<div class="res-section"><h4>🦆 DuckDuckGo Context <span class="res-source">(${escHtml(article.externalContext.source)})</span></h4>
          <p>${escHtml(article.externalContext.abstract)}</p>
          ${article.externalContext.url ? `<a class="res-link" href="${escHtml(article.externalContext.url)}" target="_blank" rel="noopener noreferrer">↗ Read more</a>` : ""}
          ${(article.externalContext.relatedTopics || []).length
            ? `<div class="res-related">${article.externalContext.relatedTopics.map((t) => `<span class="res-kw">${escHtml(t)}</span>`).join("")}</div>`
            : ""}
        </div>` : "";

    const archSrc = (article.archiveSources || []).length
      ? `<div class="res-section"><h4>🗄️ Archive.org Sources</h4>
          <ul class="res-refs">${article.archiveSources.map((s) =>
            `<li><a class="res-link" href="${escHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escHtml(s.title || s.id)}</a>${s.description ? " — " + escHtml(s.description) : ""}</li>`
          ).join("")}</ul>
        </div>` : "";

    body.innerHTML = `
      <div class="res-title-big">${escHtml(article.title)}</div>
      <div class="res-meta-big">
        <span>👥 ${escHtml((article.authors || []).join(", "))}</span>
        <span>📰 ${escHtml(article.journal)} ${article.year}</span>
        <span>IF: ${article.impactFactor}</span>
        <span>DOI: ${escHtml(article.doi)}</span>
        <span>Spin #${article.spinNumber} · Score: ${article.tokenValue}</span>
        ${article.searchEnriched ? '<span class="res-badge enriched">🌐 Search Enriched</span>' : ""}
      </div>
      <div class="res-keywords">${(article.keywords || []).map((k) => `<span class="res-kw">${escHtml(k)}</span>`).join("")}</div>
      ${article.btcTransaction != null ? `<div class="res-btc">₿ <strong>BTC Harvest:</strong> ${article.btcTransaction.toFixed(8)} BTC total — <strong>You earn ${article.btcUserShare.toFixed(8)} BTC (8%)</strong>${article.btcAddress ? ` → <code>${escHtml(article.btcAddress)}</code>` : " (no BTC address set — update your profile)"} — Treasury: ${article.btcTreasury.toFixed(8)} BTC (92%)</div>` : ""}
      <div class="res-section"><h4>Abstract</h4><p>${escHtml(article.abstract)}</p></div>
      <div class="res-section"><h4>1. Introduction</h4><p>${escHtml(article.introduction)}</p></div>
      <div class="res-section"><h4>2. Materials &amp; Methods</h4><p>${escHtml(article.methods)}</p></div>
      <div class="res-section"><h4>3. Results</h4><p>${escHtml(article.results)}</p></div>
      <div class="res-section"><h4>4. Discussion</h4><p>${escHtml(article.discussion)}</p></div>
      <div class="res-section"><h4>5. Conclusion</h4><p>${escHtml(article.conclusion)}</p></div>
      ${extCtx}
      ${archSrc}
      <div class="res-section"><h4>References</h4>
        <ul class="res-refs">${(article.references || []).map((r) => `<li>${escHtml(r)}</li>`).join("")}</ul>
      </div>
    `;
    const overlay = $("researchOverlay");
    overlay.removeAttribute("aria-hidden");
    overlay.style.display = "flex";
  }

  function closeResearchModal() {
    const overlay = $("researchOverlay");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.display = "none";
  }

  /* ------------------------------------------------------------------
     DOWNLOAD RECEIPT
  ------------------------------------------------------------------ */
  function downloadReceipt(spinData, commitInfo, article) {
    const receipt = Object.assign({}, spinData, {
      receipt: true,
      commitFilename: commitInfo ? commitInfo.filename : null,
      commitSha:      commitInfo ? commitInfo.sha      : null,
      commitUrl:      commitInfo ? commitInfo.url      : null,
      researchArticle: article || null,
    });
    const blob = new Blob([JSON.stringify(receipt, null, 2) + "\n"], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const ts   = new Date(spinData.timestamp).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a    = document.createElement("a");
    a.href = url; a.download = `receipt-spin-${ts}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    log(`📥 Receipt downloaded: receipt-spin-${ts}.json`, "ok");
  }

  /* ------------------------------------------------------------------
     EXPORT ALL SPINS
  ------------------------------------------------------------------ */
  function exportAllSpins() {
    if (!history.length) { log("ℹ️  No spins to export yet.", "warn"); return; }
    window.RESEARCH.downloadExport(history);
    log(`📦 Exported ${history.length} spin${history.length !== 1 ? "s" : ""} as HTML report.`, "ok");
  }

  /* ------------------------------------------------------------------
     HISTORY RENDER
  ------------------------------------------------------------------ */
  function addHistoryItem(spinData, commitInfo, article) {
    history.unshift({ spinData, commitInfo, article });
    histCountEl.textContent = `${history.length} spin${history.length !== 1 ? "s" : ""}`;

    const item      = document.createElement("div");
    const isJackpot = spinData.tier === "jackpot";
    const isWin     = spinData.tier !== "lose";
    item.className  = `hist-item${isJackpot ? " jackpot-item" : ""}`;

    const resultClass = isJackpot ? "jackpot" : isWin ? "win" : "";
    const commitHtml  = commitInfo
      ? commitInfo.sha
        ? `<div class="hist-commit">📝 <a href="${escHtml(commitInfo.url)}" target="_blank" rel="noreferrer">${escHtml(commitInfo.sha)}</a> — ${escHtml(commitInfo.filename)}</div>`
        : `<div class="hist-commit">📡 <a href="${escHtml(commitInfo.url)}" target="_blank" rel="noreferrer">queued</a> — ${escHtml(commitInfo.filename)}</div>`
      : `<div class="hist-commit" style="color:var(--muted2)">⚡ local only</div>`;

    const artSnippet = article
      ? `<div class="hist-research">🔬 ${escHtml(article.title.slice(0, 80))}${article.title.length > 80 ? "…" : ""}</div>`
      : "";

    const btcSnippet = spinData.btcUserShare != null
      ? `<div class="hist-btc">₿ +${spinData.btcUserShare.toFixed(8)} BTC (8% of ${spinData.btcTransaction.toFixed(8)})</div>`
      : "";

    // Thumbnail row using uploaded images
    const thumbs = spinData.symbolImgs
      ? spinData.symbolImgs.map((src) =>
          `<img src="${escHtml(src)}" alt="" class="hist-thumb" />`
        ).join("")
      : spinData.symbols.join(" ");

    item.innerHTML = `
      <div class="hist-symbols">${thumbs}</div>
      <div class="hist-result ${resultClass}">${escHtml(spinData.result)}</div>
      <div class="hist-time">Spin #${spinData.spinNumber} · +${spinData.score} pts · ${new Date(spinData.timestamp).toLocaleTimeString()}</div>
      ${btcSnippet}
      ${artSnippet}
      ${commitHtml}
    `;

    const receiptBtn = document.createElement("button");
    receiptBtn.className = "btn btn-xs btn-ghost hist-receipt-btn";
    receiptBtn.textContent = "📥 Receipt";
    receiptBtn.addEventListener("click", () => downloadReceipt(spinData, commitInfo, article));
    item.appendChild(receiptBtn);

    if (article) {
      const viewBtn = document.createElement("button");
      viewBtn.className = "btn btn-xs btn-ghost hist-receipt-btn";
      viewBtn.textContent = "🔬 Research";
      viewBtn.addEventListener("click", () => showResearchModal(article));
      item.appendChild(viewBtn);
    }

    if (!historyEl.children.length) historyEl.appendChild(item);
    else historyEl.insertBefore(item, historyEl.firstChild);

    runAiAnalysis();
  }

  /* ------------------------------------------------------------------
     MAIN SPIN FUNCTION
  ------------------------------------------------------------------ */
  async function spin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;

    pullLever();
    resultBar.className = "result-bar";
    resultText.textContent = "Spinning…";
    winOverlay.textContent = "";
    winOverlay.className = "win-overlay";

    const finalSymbols = Array.from({ length: REEL_COUNT }, () => pickSymbol());
    log(`🎮 SPIN #${spinCount + 1} — rolling reels…`);

    const BASE_DURATION = 900;
    const promises = strips.map((strip, i) => {
      const reelEl = $(`reel${i}`);
      reelEl.classList.add("spinning");
      return animateReel(reelEl, strip, finalSymbols[i], i * 220, BASE_DURATION + i * 180);
    });
    await Promise.all(promises);

    spinCount++;
    spinCounterEl.textContent = spinCount;

    const evalResult = evaluate(finalSymbols);
    totalScore += evalResult.score;
    scoreCounterEl.textContent = totalScore;

    resultBar.className = `result-bar ${evalResult.tier !== "lose" ? evalResult.tier : ""}`;
    resultText.textContent = evalResult.label;

    if (evalResult.tier === "jackpot") {
      winOverlay.textContent = "🌟 SUPER STAR! 🌟";
      winOverlay.className = "win-overlay show";
      burstCoins(14);
      setTimeout(() => { winOverlay.className = "win-overlay"; }, 2800);
    } else if (evalResult.tier === "win-big")    burstCoins(8);
    else if (evalResult.tier === "win-medium")   burstCoins(4);

    const spinData = {
      spinNumber:   spinCount,
      timestamp:    new Date().toISOString(),
      symbols:      finalSymbols.map((s) => s.label),
      symbolImgs:   finalSymbols.map((s) => s.img),
      symbolValues: finalSymbols.map((s) => s.value),
      result:       evalResult.label,
      tier:         evalResult.tier,
      score:        evalResult.score,
      totalScore,
      repo: cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : "unset",
      deviceId: deviceId.join(" "),
      // BTC harvest
      ...calcBtcReward(evalResult.tier),
      btcAddress: (window.AUTH && window.AUTH.currentUser())
        ? window.AUTH.getBtcAddress(window.AUTH.currentUser().username)
        : "",
    };

    log(`   Result: ${evalResult.label} (+${evalResult.score} pts, total: ${totalScore})`);
    log(`   ₿ BTC: ${spinData.btcTransaction.toFixed(8)} BTC → you: ${spinData.btcUserShare.toFixed(8)} BTC (8%) · treasury: ${spinData.btcTreasury.toFixed(8)} BTC (92%)`, "ok");

    // 1. Generate research article immediately
    let article = null;
    try {
      article = window.RESEARCH.generateResearchArticle(spinData);
      log(`🔬 Power-Up Token generated: "${article.title.slice(0, 60)}…"`, "ok");
      renderResearchPreview(article);
      lastArticle = article;
    } catch (e) {
      log(`⚠️  Research generation failed: ${e.message}`, "warn");
    }

    if (article) spinData.researchArticle = article;

    // 2. Commit to GitHub
    const commitInfo = await commitSpinRecord(spinData);

    // 3. Enrich article in background
    if (article) {
      window.RESEARCH.enrichWithSearch(article).then((enriched) => {
        lastArticle = enriched;
        renderResearchPreview(enriched);
        log(`🌐 Research enriched with DDG + archive data.`, "ok");
        if (history.length > 0) history[0].article = enriched;
      }).catch(() => {});
    }

    addHistoryItem(spinData, commitInfo, article);

    // 4. Update auth stats if logged in
    const user = window.AUTH ? window.AUTH.currentUser() : null;
    if (user) {
      totalBtcEarned += spinData.btcUserShare;
      window.AUTH.updateUserStats(user.username, spinCount, totalScore, totalBtcEarned);
      if (article) {
        window.AUTH.addTokenToUser(user.username, {
          spinNumber:   spinData.spinNumber,
          timestamp:    spinData.timestamp,
          tier:         spinData.tier,
          score:        spinData.score,
          title:        article.title,
          doi:          article.doi,
          btcUserShare: spinData.btcUserShare,
          btcAddress:   spinData.btcAddress,
        });
      }
      updateBtcDisplay();
    }

    isSpinning = false;
    spinBtn.disabled = false;
  }

  /* ------------------------------------------------------------------
     TICKER ANIMATION
  ------------------------------------------------------------------ */
  function animateTicker() {
    const ticker = $("ticker");
    const msg    = "MUSHROOM KINGDOM ACTIVE — SPIN TO POWER UP — COLLECT STARS — BEAT GOOMBA — ₿ BTC HARVEST ACTIVE — 8% TO YOU — 92% TO ∞ TREASURY — RESEARCH COMMITTED EVERY SPIN — ∞ ∞ ∞   ";
    ticker.innerHTML = `<span class="tick-inner">${msg}${msg}</span>`;
  }

  /* ------------------------------------------------------------------
     DEVICE IDENTITY
  ------------------------------------------------------------------ */
  const IDENTITY_KEY = "ms_device_id_v1";
  let deviceId = [];

  function genBlock() {
    return Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  function genDeviceId() {
    return Array.from({ length: 8 }, () => genBlock());
  }
  function loadDeviceId() {
    try {
      const saved = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "null");
      if (Array.isArray(saved) && saved.length === 8) return saved;
    } catch (_) {}
    return null;
  }
  function saveDeviceId(id) {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
  }
  function renderDeviceId() {
    const blocks = $("identityBlocks");
    const meta   = $("identityMeta");
    if (!blocks) return;
    blocks.textContent = deviceId.join(" · ");
    if (meta) {
      const ts = localStorage.getItem(IDENTITY_KEY + "_ts") || "";
      meta.textContent = ts ? `Generated: ${new Date(ts).toLocaleString()}` : "";
    }
  }
  function wireIdentity() {
    $("btnCopyId").addEventListener("click", () => {
      navigator.clipboard.writeText(deviceId.join(" · ")).then(() =>
        log("📋 Device ID copied to clipboard.", "ok")
      ).catch(() => log("⚠️ Clipboard copy failed.", "warn"));
    });
    $("btnRegenId").addEventListener("click", () => {
      deviceId = genDeviceId();
      saveDeviceId(deviceId);
      localStorage.setItem(IDENTITY_KEY + "_ts", new Date().toISOString());
      renderDeviceId();
      log("🔄 Device ID regenerated.", "warn");
    });
  }

  /* ------------------------------------------------------------------
     AI SIGNAL ANALYSIS
  ------------------------------------------------------------------ */
  const aiLogEl = $("aiLog");
  function aiLog(msg) {
    if (!aiLogEl) return;
    aiLogEl.textContent += msg + "\n";
    aiLogEl.scrollTop = aiLogEl.scrollHeight;
  }
  function setAiStatus(cls, text) {
    const dot  = $("aiDot");
    const span = $("aiStatusText");
    if (dot)  { dot.className = `ai-dot${cls ? " " + cls : ""}`; }
    if (span) { span.textContent = text; }
  }
  function runAiAnalysis() {
    if (history.length < 3) return;
    setAiStatus("working", "Analysing spin patterns…");
    setTimeout(() => {
      const tiers  = history.slice(0, 10).map((h) => h.spinData.tier);
      const wins   = tiers.filter((t) => t !== "lose").length;
      const rate   = ((wins / tiers.length) * 100).toFixed(0);
      const labels = history.slice(0, 10).flatMap((h) => h.spinData.symbols);
      const freq   = {};
      labels.forEach((l) => { freq[l] = (freq[l] || 0) + 1; });
      const top    = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
      const pred   = $("aiPrediction");
      if (pred) pred.textContent = `Win rate: ${rate}% · Hot symbols: ${top.join(", ")}`;
      aiLog(`[AI] Win rate ${rate}% across last ${tiers.length} spins. Hot: ${top.join(", ")}`);
      setAiStatus("active", "Pattern analysis complete");
    }, 600);
  }

  /* ------------------------------------------------------------------
     AI CHAT
  ------------------------------------------------------------------ */
  async function handleChat() {
    const input = chatInput.value.trim();
    if (!input) return;
    chatInput.value = "";
    appendChat("user", input);
    const thinking = appendChat("ai", "🤔 Searching…");
    try {
      let response = "";
      if (window.RESEARCH && window.RESEARCH.handleChat) {
        response = await window.RESEARCH.handleChat(input);
      } else {
        response = "Research AI unavailable. Please check your connection.";
      }
      thinking.querySelector(".chat-bubble").textContent = response;
    } catch (e) {
      thinking.querySelector(".chat-bubble").textContent = `❌ Error: ${e.message}`;
    }
    if (window.AUTH && window.AUTH.currentUser()) {
      const u = window.AUTH.currentUser();
      window.AUTH.saveConversation(u.username, input,
        thinking.querySelector(".chat-bubble").textContent
      ).catch(() => {});
    }
  }
  function appendChat(role, text) {
    const log   = $("chatLog");
    const msg   = document.createElement("div");
    msg.className = `chat-msg ${role}`;
    msg.innerHTML = `<span class="chat-avatar">${role === "ai" ? "🤖" : "🧑"}</span><span class="chat-bubble">${escHtml(text)}</span>`;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  /* ------------------------------------------------------------------
     CONFIG
  ------------------------------------------------------------------ */
  const CFG_KEY = "ms_cfg_v1";

  function prefillFromRepoMeta() {
    cfg.owner  = "www-infinity4";
    cfg.repo   = "Mario-spin";
    cfg.branch = "main";
  }
  function saveCfg() {
    cfg.owner  = $("cfgOwner").value.trim()  || cfg.owner;
    cfg.repo   = $("cfgRepo").value.trim()   || cfg.repo;
    cfg.branch = $("cfgBranch").value.trim() || cfg.branch;
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    pushCfgToInputs();
    log(`💾 Config saved: ${cfg.owner}/${cfg.repo} (${cfg.branch})`, "ok");
    updateRepoLink();
  }
  function loadCfg() {
    try {
      const saved = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
      if (saved && saved.owner) cfg = Object.assign(cfg, saved);
    } catch (_) {}
  }
  function clearCfg() {
    localStorage.removeItem(CFG_KEY);
    prefillFromRepoMeta();
    pushCfgToInputs();
    log("🗑️ Config cleared.", "warn");
    updateRepoLink();
  }
  function pushCfgToInputs() {
    $("cfgOwner").value  = cfg.owner;
    $("cfgRepo").value   = cfg.repo;
    $("cfgBranch").value = cfg.branch;
    updateRepoLink();
  }
  function updateRepoLink() {
    const row  = $("repoLinkRow");
    const link = $("repoLink");
    if (!row || !link) return;
    if (cfg.owner && cfg.repo) {
      link.href = `https://github.com/${cfg.owner}/${cfg.repo}`;
      link.textContent = `🔗 ${cfg.owner}/${cfg.repo}`;
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }

  /* ------------------------------------------------------------------
     AUTH UI
  ------------------------------------------------------------------ */
  function updateAuthUI() {
    const user = window.AUTH ? window.AUTH.currentUser() : null;
    const badge = $("userBadge");
    const loginBtn = $("loginBtn");
    const adminPanel = $("adminPanel");
    if (user) {
      badge.style.display = "";
      $("userBadgeName").textContent = user.username;
      $("userBadgeRole").textContent = user.role;
      loginBtn.style.display = "none";
      if (adminPanel) adminPanel.style.display = window.AUTH.isAdmin() ? "" : "none";
      if (window.AUTH.isAdmin()) renderAdminUserList();
      // Pre-fill BTC address input if the panel exists
      const btcInput = $("btcAddressInput");
      if (btcInput) btcInput.value = window.AUTH.getBtcAddress(user.username);
      updateBtcDisplay();
    } else {
      badge.style.display = "none";
      loginBtn.style.display = "";
      if (adminPanel) adminPanel.style.display = "none";
    }
  }
  function renderAdminUserList() {
    const el = $("adminUserList");
    if (!el || !window.AUTH) return;
    const users = window.AUTH.getUserList();
    el.innerHTML = `<div style="font-weight:800;font-size:13px;margin-bottom:8px;color:var(--mario-gold)">👥 Users (${users.length})</div>` +
      users.map((u) =>
        `<div style="font-size:12px;color:var(--muted);padding:4px 0;border-bottom:1px solid var(--stroke)">
          <strong style="color:var(--text)">${escHtml(u.username)}</strong>
          (${escHtml(u.role)}) — ${u.spinCount} spins · ${u.totalScore} coins · ₿ ${(u.btcEarned || 0).toFixed(8)}
        </div>`
      ).join("");
  }

  function openLoginModal() {
    const overlay = $("loginOverlay");
    overlay.removeAttribute("aria-hidden");
    overlay.style.display = "flex";
    $("loginUser").focus();
  }
  function closeLoginModal() {
    const overlay = $("loginOverlay");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.display = "none";
  }

  function wireAuth() {
    const overlay = $("loginOverlay");

    $("tabLogin").addEventListener("click", () => {
      $("tabLogin").classList.add("active");
      $("tabRegister").classList.remove("active");
      $("loginForm").style.display = "";
      $("registerForm").style.display = "none";
    });
    $("tabRegister").addEventListener("click", () => {
      $("tabRegister").classList.add("active");
      $("tabLogin").classList.remove("active");
      $("loginForm").style.display = "none";
      $("registerForm").style.display = "";
      $("regUser").focus();
    });

    $("loginBtn").addEventListener("click", openLoginModal);
    $("loginClose").addEventListener("click", closeLoginModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLoginModal(); });

    $("btnLogin").addEventListener("click", async () => {
      const msg = $("loginMsg");
      msg.textContent = "Signing in…";
      msg.className = "auth-msg";
      try {
        const u = await window.AUTH.login($("loginUser").value.trim(), $("loginPass").value);
        msg.textContent = `✅ Welcome back, ${u.username}!`;
        msg.className = "auth-msg ok";
        setTimeout(() => {
          closeLoginModal();
          updateAuthUI();
          log(`✅ Signed in as ${u.username} (${u.role}).`, "ok");
          if (getAuthToken() && cfg.owner && cfg.repo) {
            window.AUTH.saveProfileToRepo(u.username, getAuthToken(), cfg.owner, cfg.repo, cfg.branch);
          }
        }, 800);
      } catch (e) {
        msg.textContent = `❌ ${e.message}`;
        msg.className = "auth-msg err";
      }
    });

    $("btnRegister").addEventListener("click", async () => {
      const msg = $("registerMsg");
      msg.textContent = "Creating account…";
      msg.className = "auth-msg";
      try {
        const u = await window.AUTH.register(
          $("regUser").value.trim(),
          $("regEmail").value.trim(),
          $("regPass").value
        );
        msg.textContent = `✅ Account created! Welcome, ${u.username}!`;
        msg.className = "auth-msg ok";
        setTimeout(() => {
          closeLoginModal();
          updateAuthUI();
          log(`✅ Registered and signed in as ${u.username}.`, "ok");
          if (getAuthToken() && cfg.owner && cfg.repo) {
            window.AUTH.saveProfileToRepo(u.username, getAuthToken(), cfg.owner, cfg.repo, cfg.branch);
          }
        }, 800);
      } catch (e) {
        msg.textContent = `❌ ${e.message}`;
        msg.className = "auth-msg err";
      }
    });

    $("logoutBtn").addEventListener("click", () => {
      window.AUTH.logout();
      totalBtcEarned = 0;
      updateBtcDisplay();
      updateAuthUI();
      log("👋 Signed out.", "warn");
    });

    [$("loginUser"), $("loginPass")].forEach((el) => {
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnLogin").click(); });
    });
    [$("regUser"), $("regEmail"), $("regPass")].forEach((el) => {
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnRegister").click(); });
    });

    // BTC address save
    const btnSaveBtc = $("btnSaveBtc");
    if (btnSaveBtc) {
      btnSaveBtc.addEventListener("click", () => {
        const user = window.AUTH ? window.AUTH.currentUser() : null;
        if (!user) { log("⚠️  Sign in to save your BTC address.", "warn"); return; }
        const addr = ($("btcAddressInput") || {}).value || "";
        const ok = window.AUTH.setBtcAddress(user.username, addr.trim());
        if (ok) {
          log(`₿ BTC address saved: ${addr.trim() || "(cleared)"}`, "ok");
        } else {
          log("❌ Invalid Bitcoin address format.", "err");
        }
      });
    }
  }

  /* ------------------------------------------------------------------
     HAMBURGER MENU
  ------------------------------------------------------------------ */
  function wireHamburger() {
    const hamBtn     = $("hamBtn");
    const hamDrawer  = $("hamDrawer");
    const hamOverlay = $("hamOverlay");
    const hamClose   = $("hamClose");

    function openHam() {
      hamDrawer.classList.add("open");
      hamOverlay.classList.add("visible");
      hamBtn.setAttribute("aria-expanded", "true");
      hamDrawer.removeAttribute("aria-hidden");
    }
    function closeHam() {
      hamDrawer.classList.remove("open");
      hamOverlay.classList.remove("visible");
      hamBtn.setAttribute("aria-expanded", "false");
      hamDrawer.setAttribute("aria-hidden", "true");
    }
    hamBtn.addEventListener("click", openHam);
    hamClose.addEventListener("click", closeHam);
    hamOverlay.addEventListener("click", closeHam);
  }

  /* ------------------------------------------------------------------
     WIRE EVENTS
  ------------------------------------------------------------------ */
  function wireEvents() {
    spinBtn.addEventListener("click", spin);
    lever.addEventListener("click", () => { if (!isSpinning) spin(); });
    lever.closest(".lever-wrap").addEventListener("click", () => { if (!isSpinning) spin(); });

    $("btnSaveCfg").addEventListener("click", saveCfg);
    $("btnLoadCfg").addEventListener("click", loadCfg);
    $("btnClearCfg").addEventListener("click", clearCfg);
    $("clearLog").addEventListener("click", () => { consoleLog.textContent = ""; });
    $("exportAllBtn").addEventListener("click", exportAllSpins);

    $("viewResearchBtn").addEventListener("click", () => { if (lastArticle) showResearchModal(lastArticle); });
    $("researchClose").addEventListener("click", closeResearchModal);
    $("researchOverlay").addEventListener("click", (e) => {
      if (e.target === $("researchOverlay")) closeResearchModal();
    });

    $("chatSendBtn").addEventListener("click", handleChat);
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); }
    });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.target.matches("input,textarea,button")) {
        e.preventDefault();
        if (!isSpinning) spin();
      }
    });

    wireIdentity();
    wireAuth();
    wireHamburger();
  }

  /* ------------------------------------------------------------------
     INIT
  ------------------------------------------------------------------ */
  async function init() {
    prefillFromRepoMeta();
    loadCfg();
    pushCfgToInputs();

    deviceId = loadDeviceId() || genDeviceId();
    saveDeviceId(deviceId);

    initReels();
    animateTicker();
    wireEvents();

    if (!localStorage.getItem(IDENTITY_KEY + "_ts")) {
      localStorage.setItem(IDENTITY_KEY + "_ts", new Date().toISOString());
    }
    renderDeviceId();
    aiLog(`🪪 Device ID: ${deviceId.join(" · ")}`);
    setAiStatus("", "Signal engine ready — awaiting spin data");

    if (window.AUTH) {
      await window.AUTH.ensureAdmin();
      updateAuthUI();
    }

    log("🍄 Mario Spin — Infinity Slot Machine v1 ready.");
    if (window.MARIO_SPIN_TOKEN && cfg.owner && cfg.repo) {
      log(`✅ Repo: ${cfg.owner}/${cfg.repo} (branch: ${cfg.branch}) — GHP active, spins will be committed.`, "ok");
    } else {
      log("⚠️  GHP secret not found — spins are local only.", "warn");
    }
    log("🎮 Hit SPIN & GO! (or press Space) to start your adventure!");
    log("🔐 Sign in to save power-up tokens and build your profile.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
