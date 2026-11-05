/* Edit mode ("Rediger siden") on top of the real site. Loaded by rediger.js only when
   the page is opened with ?rediger=1 (the /rediger/ link redirects there).
   Works on any site that marks editable text with data-felt="key" and the gallery
   with data-bilder. The backend address is "api" in content.json.
   UX requirements: see editor/UX_CHECKLIST.md */
(function () {
  "use strict";
  var PIN = "", content = null, edits = {}, newPhotos = [], removePhotos = [];
  var KEY = location.pathname;                      // per-site keys in browser storage
  var store = {                                     // storage can be blocked (private mode): never let that break editing
    get: function (k) { try { return JSON.parse(localStorage.getItem(k + KEY)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k + KEY, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k + KEY); } catch (e) { } }
  };

  /* ---------- styles (prefixed rd- so they never clash with the site) ---------- */
  var css = document.createElement("style");
  css.textContent = [
    ".rd-ui,.rd-ui *{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:normal;text-transform:none;-webkit-tap-highlight-color:transparent}",
    ".rd-edit{outline:2px dashed rgba(31,111,178,.75)!important;outline-offset:4px;cursor:pointer!important;position:relative;min-height:1em;border-radius:2px;transition:outline-color .2s,background-color .2s}",
    ".rd-edit:active{background-color:rgba(31,111,178,.08)!important}",
    ".rd-edit.rd-changed{outline-style:solid!important;outline-color:#e07b00!important}",
    ".rd-pen{position:absolute;top:-15px;right:-12px;width:30px;height:30px;border-radius:50%;background:#1f6fb2;color:#fff;font:14px/30px system-ui;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.25);z-index:5;pointer-events:none}",
    ".rd-hello .rd-pen{animation:rd-pop .5s cubic-bezier(.2,.8,.2,1.4) both}",
    "@keyframes rd-pop{0%{transform:scale(0)}100%{transform:scale(1)}}",
    ".rd-empty{display:block!important;opacity:.8;font-style:italic}",
    ".rd-add{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;border:2px dashed #1f6fb2;border-radius:10px;min-height:150px;background:rgba(31,111,178,.06);color:#1f6fb2;font:600 16px system-ui;cursor:pointer;transition:background .2s,transform .15s}",
    ".rd-add:active{transform:scale(.97);background:rgba(31,111,178,.14)}",
    ".rd-add b{font-size:44px;line-height:1;font-weight:400}",
    ".rd-ph{position:relative;transition:opacity .25s,transform .25s}",
    ".rd-x{position:absolute;top:8px;right:8px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font:20px/40px system-ui;cursor:pointer;backdrop-filter:blur(4px)}",
    ".rd-ph.rd-gone{opacity:.35}",
    ".rd-ph.rd-new{outline:3px solid #e07b00;outline-offset:2px;border-radius:8px;animation:rd-in .35s ease-out both}",
    "@keyframes rd-in{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}",
    ".rd-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);color:#1d1d1b;border-top:1px solid #e3e1db;box-shadow:0 -4px 16px rgba(0,0,0,.08);padding:10px 12px calc(10px + env(safe-area-inset-bottom))}",
    ".rd-row{display:flex;gap:8px;align-items:center;max-width:720px;margin:0 auto}",
    ".rd-btn{font:600 16px system-ui;border:0;border-radius:12px;padding:14px 16px;min-height:48px;cursor:pointer;background:#ecebe6;color:#1d1d1b;transition:transform .12s,background .2s,opacity .2s}",
    ".rd-btn:active{transform:scale(.97)}",
    ".rd-btn.rd-main{background:#1f6fb2;color:#fff;flex:1}",
    ".rd-btn.rd-quiet{background:transparent;color:#1f6fb2}",
    ".rd-btn:disabled{opacity:.45}",
    ".rd-status{max-width:720px;margin:6px auto 0;font:14px/1.4 system-ui;color:#555;min-height:1.2em}",
    ".rd-status.rd-ok{color:#2e7d32;font-weight:600}.rd-status.rd-err{color:#b3261e}",
    ".rd-prog{height:3px;border-radius:2px;background:#e3e1db;overflow:hidden;max-width:720px;margin:6px auto 0}",
    ".rd-prog i{display:block;height:100%;width:40%;background:#1f6fb2;animation:rd-slide 1.2s ease-in-out infinite}",
    "@keyframes rd-slide{from{transform:translateX(-100%)}to{transform:translateX(250%)}}",
    ".rd-top{position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#1d1d1b;color:#fff;font:14px/1.4 system-ui;padding:9px 12px;text-align:center;transition:background .3s}",
    ".rd-top.rd-off{background:#b3261e}",
    ".rd-top small{display:block;opacity:.7;font-size:12px}",
    ".rd-shade{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2147483000;opacity:0;transition:opacity .25s}",
    ".rd-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483001;background:#fff;color:#1d1d1b;border-radius:18px 18px 0 0;box-shadow:0 -6px 30px rgba(0,0,0,.2);padding:10px 16px calc(16px + env(safe-area-inset-bottom));max-height:85vh;overflow:auto;transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1)}",
    ".rd-open .rd-shade{opacity:1}.rd-open .rd-sheet{transform:none}",
    ".rd-grab{width:40px;height:5px;border-radius:3px;background:#d6d4ce;margin:0 auto 12px}",
    ".rd-sheet .rd-in{max-width:720px;margin:0 auto}",
    ".rd-sheet h3{margin:0 0 4px;font:700 19px system-ui}",
    ".rd-hint{font:14px/1.45 system-ui;color:#666;margin:4px 0 10px}",
    ".rd-sheet textarea,.rd-sheet input[type=password],.rd-sheet input[type=text],.rd-sheet input:not([type]){width:100%;font:17px/1.45 system-ui;padding:12px;border:1px solid #cfcdc7;border-radius:10px;background:#fff;color:#1d1d1b;transition:border-color .2s,box-shadow .2s}",
    ".rd-sheet textarea:focus,.rd-sheet input:focus{outline:0;border-color:#1f6fb2;box-shadow:0 0 0 3px rgba(31,111,178,.18)}",
    ".rd-sheet textarea{min-height:130px;resize:vertical}",
    ".rd-check{display:flex;gap:10px;align-items:center;font:15px system-ui;margin:12px 0}",
    ".rd-check input{width:22px;height:22px}",
    ".rd-count{text-align:right;font:13px system-ui;color:#888;margin-top:4px}",
    ".rd-count.rd-near{color:#e07b00}",
    ".rd-list button{display:block;width:100%;text-align:left;margin:6px 0}",
    ".rd-notice{background:#fff8e1;border:1px solid #f0d98a;border-radius:10px;padding:9px 11px;font:14px/1.4 system-ui;margin:8px 0}",
    ".rd-steps{font:15px/1.6 system-ui;padding-left:20px;margin:8px 0 14px}",
    ".rd-toast{position:fixed;left:50%;bottom:120px;z-index:2147483002;background:#1d1d1b;color:#fff;font:600 15px system-ui;padding:12px 18px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);transform:translate(-50%,20px);opacity:0;transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .3s;pointer-events:none;white-space:nowrap}",
    ".rd-toast.rd-show{transform:translate(-50%,0);opacity:1}",
    ".rd-shake{animation:rd-shake .35s}",
    "@keyframes rd-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}",
    "body.rd-on{padding-bottom:150px!important}",
    "@media (prefers-reduced-motion:reduce){.rd-ui,.rd-ui *,.rd-edit,.rd-ph{animation:none!important;transition:none!important}}"
  ].join("\n");
  document.head.appendChild(css);

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- backend ---------- */
  function call(action) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (!navigator.onLine) return Promise.reject(new Error("Du er uten nett. Endringene er tatt vare på, prøv igjen når du har dekning."));
    return fetch(content.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: action, args: args }) })
      .catch(function () { throw new Error("Får ikke kontakt. Endringene er tatt vare på, prøv igjen om litt."); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "Noe gikk galt. Prøv igjen om litt." }; }); })
      .then(function (d) { if (!d.ok) throw new Error(d.error); return d.result; });
  }

  /* ---------- bottom sheets ---------- */
  var wrap = null;
  function openSheet(html, opts) {
    closeSheet(true);
    wrap = el("div", "rd-ui");
    var shade = el("div", "rd-shade"), sheet = el("div", "rd-sheet", '<div class="rd-grab"></div><div class="rd-in">' + html + "</div>");
    if (!(opts && opts.locked)) shade.onclick = function () { closeSheet(); };
    wrap.appendChild(shade); wrap.appendChild(sheet); document.body.appendChild(wrap);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (wrap) wrap.classList.add("rd-open"); }); });
    fitKeyboard();
    return sheet;
  }
  function closeSheet(now) {
    if (!wrap) return;
    var w = wrap; wrap = null;
    if (now) { w.remove(); return; }
    w.classList.remove("rd-open");
    setTimeout(function () { w.remove(); }, 320);
  }
  /* iPhone keyboard: keep the sheet just above it */
  function fitKeyboard() {
    var vv = window.visualViewport; if (!vv || !wrap) return;
    var sheet = wrap.querySelector(".rd-sheet");
    sheet.style.bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + "px";
  }
  if (window.visualViewport) { visualViewport.addEventListener("resize", fitKeyboard); visualViewport.addEventListener("scroll", fitKeyboard); }

  var toastEl = null, toastTimer = null;
  function toast(text) {
    if (!toastEl) { toastEl = el("div", "rd-ui rd-toast"); document.body.appendChild(toastEl); }
    toastEl.textContent = text;
    requestAnimationFrame(function () { toastEl.classList.add("rd-show"); });
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("rd-show"); }, 2600);
  }

  /* ---------- PIN ---------- */
  function askPin(msg) {
    var s = openSheet('<h3>Rediger siden</h3><p class="rd-hint">Skriv inn PIN-koden du har fått.</p>' +
      '<input type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" id="rd-pin">' +
      '<label class="rd-check"><input type="checkbox" id="rd-remember" checked> Husk meg på denne telefonen</label>' +
      '<p class="rd-hint" id="rd-pinmsg" style="color:#b3261e;min-height:1.2em">' + esc(msg || "") + "</p>" +
      '<button class="rd-btn rd-main" id="rd-go" style="width:100%">Åpne</button>', { locked: true });
    var inp = s.querySelector("#rd-pin"), go = s.querySelector("#rd-go");
    function submit() {
      var pin = inp.value.trim(); if (!pin) return;
      go.disabled = true; go.textContent = "Åpner...";
      login(pin).then(function () {
        if (s.querySelector("#rd-remember").checked) store.set("rd-pin:", pin); else store.del("rd-pin:");
        closeSheet(); start();
      }).catch(function (e) {
        go.disabled = false; go.textContent = "Åpne";
        s.querySelector("#rd-pinmsg").textContent = e.message;
        inp.classList.remove("rd-shake"); void inp.offsetWidth; inp.classList.add("rd-shake");
        inp.select();
      });
    }
    go.onclick = submit;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    setTimeout(function () { inp.focus(); }, 350);
  }
  function login(pin) {
    return call("login", pin).then(function (r) {
      PIN = pin;
      content.fields = r.content.fields; content.photos = r.content.photos || [];
      content.photosEnabled = r.content.photosEnabled; content.updated = r.content.updated;
    });
  }

  /* ---------- edit mode ---------- */
  function field(key) { return content.fields.filter(function (f) { return f.key === key; })[0]; }
  function value(f) { return f.key in edits ? edits[f.key] : (f.value || ""); }
  function changes() { return Object.keys(edits).length + newPhotos.length + removePhotos.length; }
  var topBar = null;

  function start() {
    document.body.classList.add("rd-on", "rd-hello");
    setTimeout(function () { document.body.classList.remove("rd-hello"); }, 1500);
    // Home screen name, so it looks like an app
    var name = (document.title.split(/[|–\-]/)[0] || "").trim();
    document.title = "Rediger " + name;
    var meta = el("meta"); meta.name = "apple-mobile-web-app-title"; meta.content = document.title; document.head.appendChild(meta);

    topBar = el("div", "rd-ui rd-top"); document.body.appendChild(topBar); drawTop();
    window.addEventListener("online", drawTop); window.addEventListener("offline", drawTop);

    // Links, buttons and forms on the site do nothing while editing
    document.addEventListener("click", function (e) {
      if (e.target.closest(".rd-ui,.rd-edit,.rd-add,.rd-x")) return;
      if (e.target.closest("a,button,form,input,select,label")) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener("submit", function (e) { e.preventDefault(); }, true);

    markFields();
    if (content.photosEnabled) drawGallery();
    drawBar();
    window.addEventListener("beforeunload", function (e) { if (changes()) { e.preventDefault(); e.returnValue = ""; } });

    var draft = store.get("rd-draft:");
    if (draft && (Object.keys(draft.edits || {}).length || (draft.newPhotos || []).length || (draft.removePhotos || []).length)) offerDraft(draft);
    else if (!store.get("rd-seen:")) firstTime();
  }

  function drawTop() {
    if (!topBar) return;
    if (!navigator.onLine) { topBar.className = "rd-ui rd-top rd-off"; topBar.innerHTML = "Du er uten nett. Endringene dine er tatt vare på."; }
    else {
      topBar.className = "rd-ui rd-top";
      topBar.innerHTML = "Trykk på det du vil endre" + (content.updated ? "<small>Sist endret " + esc(when(content.updated)) + "</small>" : "");
    }
    document.body.style.paddingTop = topBar.offsetHeight + "px";
  }
  function when(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) + " kl " + d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  }

  function firstTime() {
    var s = openSheet('<h3>Slik gjør du</h3><ol class="rd-steps"><li>Trykk på en tekst med ✏️ for å endre den.</li>' +
      (content.photosEnabled ? "<li>Trykk på + for å legge til bilder.</li>" : "") +
      "<li>Trykk <b>Lagre</b> når du er fornøyd. Før det er ingenting endret på siden.</li></ol>" +
      '<button class="rd-btn rd-main" id="rd-ok" style="width:100%">Skjønner</button>');
    s.querySelector("#rd-ok").onclick = function () { store.set("rd-seen:", 1); closeSheet(); };
  }

  /* ---------- drafts: unsaved work survives a phone call or a reload ---------- */
  var draftTimer = null;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      if (!changes()) { store.del("rd-draft:"); return; }
      if (!store.set("rd-draft:", { edits: edits, newPhotos: newPhotos, removePhotos: removePhotos }))
        store.set("rd-draft:", { edits: edits, newPhotos: [], removePhotos: removePhotos });   // photos too big for storage: keep the text at least
    }, 400);
  }
  function offerDraft(d) {
    var n = Object.keys(d.edits || {}).length + (d.newPhotos || []).length + (d.removePhotos || []).length;
    var s = openSheet("<h3>Du har ulagrede endringer</h3><p class=\"rd-hint\">Fra sist du redigerte (" + n + (n === 1 ? " endring" : " endringer") + "). Vil du fortsette der du slapp?</p>" +
      '<div class="rd-row"><button class="rd-btn" id="rd-drop">Forkast</button><button class="rd-btn rd-main" id="rd-keep">Fortsett</button></div>', { locked: true });
    s.querySelector("#rd-keep").onclick = function () {
      edits = d.edits || {}; newPhotos = d.newPhotos || [];
      removePhotos = (d.removePhotos || []).filter(function (src) { return (content.photos || []).some(function (p) { return p.src === src; }); });
      Object.keys(edits).forEach(function (k) { if (!field(k)) delete edits[k]; else refresh(k); });
      if (content.photosEnabled) drawGallery();
      drawBar(); closeSheet(); toast("Endringene er hentet tilbake");
    };
    s.querySelector("#rd-drop").onclick = function () { store.del("rd-draft:"); closeSheet(); };
  }

  /* ---------- text fields ---------- */
  function markFields() {
    content.fields.forEach(function (f) {
      document.querySelectorAll('[data-felt="' + f.key + '"]').forEach(function (node) {
        node.classList.add("rd-edit");
        if (!node.querySelector(".rd-pen")) node.appendChild(el("span", "rd-ui rd-pen", "✏️"));
        show(node, f);
        node.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); editField(f.key); }, true);
      });
    });
  }
  /* Put the text in, keep the pencil, and show empty optional fields as "+ Legg til ..." */
  function show(node, f) {
    var v = value(f), pen = node.querySelector(".rd-pen");
    node.textContent = v || "+ Legg til " + f.label.toLowerCase();
    node.style.whiteSpace = "pre-line";
    if (pen) node.appendChild(pen);
    node.hidden = false;
    node.classList.toggle("rd-empty", !v);
    node.classList.toggle("rd-changed", f.key in edits);
    document.querySelectorAll('[data-skjul-hvis-tom="' + f.key + '"]').forEach(function (box) { box.hidden = false; });
  }
  function refresh(key) {
    var f = field(key);
    document.querySelectorAll('[data-felt="' + key + '"]').forEach(function (n) { show(n, f); });
    drawBar(); saveDraft();
  }

  function editField(key) {
    var f = field(key), tag = f.multiline ? "textarea" : "input";
    var s = openSheet("<h3>" + esc(f.label) + "</h3>" + '<p class="rd-hint">' + esc(f.hint || "Siden oppdateres mens du skriver.") + "</p>" +
      "<" + tag + ' id="rd-val"' + (tag === "input" ? ' type="text"' : "") + (f.max ? ' maxlength="' + f.max + '"' : "") + "></" + tag + ">" +
      '<div class="rd-count" id="rd-n"></div>' +
      '<div class="rd-row" style="margin-top:10px"><button class="rd-btn" id="rd-undo">Angre</button><button class="rd-btn rd-main" id="rd-done">Ferdig</button></div>');
    var inp = s.querySelector("#rd-val"), n = s.querySelector("#rd-n"), undo = s.querySelector("#rd-undo");
    inp.value = value(f);
    function sync() {
      if (f.max) { n.textContent = inp.value.length + " / " + f.max; n.className = "rd-count" + (inp.value.length > f.max * 0.9 ? " rd-near" : ""); }
      undo.disabled = !(key in edits);
    }
    inp.addEventListener("input", function () {
      if (inp.value === (f.value || "")) delete edits[key]; else edits[key] = inp.value;
      sync(); refresh(key); status("");
    });
    undo.onclick = function () { delete edits[key]; inp.value = f.value || ""; sync(); refresh(key); };
    s.querySelector("#rd-done").onclick = function () { closeSheet(); if (key in edits) toast("Klar til å lagres"); };
    sync();
    setTimeout(function () { inp.focus(); if (inp.setSelectionRange) inp.setSelectionRange(inp.value.length, inp.value.length); }, 350);
  }

  /* ---------- photos ---------- */
  function drawGallery() {
    document.querySelectorAll("[data-bilder]").forEach(function (box) {
      var section = box.closest("[data-bilder-seksjon]"); if (section) section.hidden = false;
      box.innerHTML = "";
      var add = el("div", "rd-ui rd-add", "<b>+</b>Legg til bilde");
      add.onclick = pickPhoto;
      box.appendChild(add);
      newPhotos.forEach(function (p, i) {
        box.appendChild(photoTile(p.dataUrl, p.caption, "rd-new", function () { newPhotos.splice(i, 1); drawGallery(); drawBar(); saveDraft(); }, function () { captionFor(p); }));
      });
      (content.photos || []).forEach(function (p) {
        var gone = removePhotos.indexOf(p.src) >= 0;
        box.appendChild(photoTile(p.src, p.caption, gone ? "rd-gone" : "", function () {
          if (gone) removePhotos = removePhotos.filter(function (s) { return s !== p.src; });
          else { removePhotos.push(p.src); toast("Bildet slettes når du lagrer"); }
          drawGallery(); drawBar(); saveDraft();
        }, null, gone));
      });
    });
  }
  function photoTile(src, caption, cls, onX, onTap, gone) {
    var fig = el("figure", "rd-ph " + cls);
    var img = el("img"); img.src = src; img.alt = caption || ""; fig.appendChild(img);
    if (caption) { var c = el("figcaption"); c.textContent = caption; fig.appendChild(c); }
    var x = el("button", "rd-ui rd-x", gone ? "↺" : "✕");
    x.setAttribute("aria-label", gone ? "Angre sletting" : "Slett bildet");
    x.onclick = function (e) { e.preventDefault(); e.stopPropagation(); onX(); };
    fig.appendChild(x);
    if (onTap) { fig.style.cursor = "pointer"; fig.onclick = onTap; }
    return fig;
  }
  var picker = null;
  function pickPhoto() {
    if (!picker) {
      picker = el("input"); picker.type = "file"; picker.accept = "image/*"; picker.multiple = true; picker.hidden = true;
      document.body.appendChild(picker);
      picker.onchange = function () {
        var files = Array.prototype.slice.call(picker.files); picker.value = "";
        if (!files.length) return;
        status("Gjør klar " + (files.length > 1 ? files.length + " bilder" : "bildet") + "...");
        files.reduce(function (p, f) {
          return p.then(function () { return shrink(f).then(function (url) { newPhotos.unshift({ dataUrl: url, caption: "" }); }); });
        }, Promise.resolve()).then(function () {
          status(""); drawGallery(); drawBar(); saveDraft(); captionFor(newPhotos[0]);
        }).catch(function () { status("Bildet kunne ikke leses. Prøv et annet bilde.", "err"); });
      };
    }
    picker.click();
  }
  function captionFor(p) {
    var s = openSheet('<h3>Tekst under bildet</h3><p class="rd-hint">Valgfritt. For eksempel hva slags jobb det var.</p>' +
      '<p class="rd-notice">Viser bildet noens hjem eller personer? Spør dem først før du legger det ut.</p>' +
      '<input type="text" id="rd-cap" maxlength="120" placeholder="For eksempel: Nytt tak på bolighus i Brumunddal">' +
      '<div class="rd-row" style="margin-top:10px"><button class="rd-btn rd-main" id="rd-done">Ferdig</button></div>');
    var inp = s.querySelector("#rd-cap"); inp.value = p.caption;
    inp.oninput = function () { p.caption = inp.value; saveDraft(); };
    s.querySelector("#rd-done").onclick = function () { closeSheet(); drawGallery(); };
  }
  /* Resize on the phone: max 1600 px, JPEG. Re-encoding also drops GPS/EXIF data.
     Browsers draw iPhone photos upright (EXIF rotation) before we re-encode. */
  function shrink(file) {
    return new Promise(function (ok, fail) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        var q = 0.85, url = c.toDataURL("image/jpeg", q);
        while (url.length * 0.75 > 850 * 1024 && q > 0.5) { q -= 0.1; url = c.toDataURL("image/jpeg", q); }
        URL.revokeObjectURL(img.src); ok(url);
      };
      img.onerror = fail;
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- bottom bar, save, menu ---------- */
  var bar = null, saving = false;
  function drawBar() {
    if (!bar) {
      bar = el("div", "rd-ui rd-bar", '<div class="rd-row"><button class="rd-btn" id="rd-menu" aria-label="Meny">⋯</button>' +
        '<button class="rd-btn rd-main" id="rd-save"></button></div><div class="rd-prog" id="rd-prog" hidden><i></i></div><div class="rd-status" id="rd-status"></div>');
      document.body.appendChild(bar);
      bar.querySelector("#rd-save").onclick = save;
      bar.querySelector("#rd-menu").onclick = menu;
    }
    var n = changes(), b = bar.querySelector("#rd-save");
    if (!saving) {
      b.textContent = n ? "Lagre (" + n + (n === 1 ? " endring)" : " endringer)") : "Ingen endringer";
      b.disabled = !n;
    }
  }
  function status(t, cls) { var s = document.getElementById("rd-status"); if (!s) return; s.textContent = t; s.className = "rd-status" + (cls ? " rd-" + cls : ""); }
  function progress(on) { var p = document.getElementById("rd-prog"); if (p) p.hidden = !on; }

  function save() {
    if (saving || !changes()) return;
    saving = true;
    var b = bar.querySelector("#rd-save"); b.disabled = true; b.textContent = "Lagrer...";
    progress(true); status(newPhotos.length ? "Laster opp bilder..." : "");
    call("save", PIN, { fields: edits, newPhotos: newPhotos, removePhotos: removePhotos }).then(function (r) {
      saving = false;
      content.fields = r.content.fields; content.photos = r.content.photos || []; content.updated = r.content.updated;
      edits = {}; newPhotos = []; removePhotos = []; store.del("rd-draft:");
      content.fields.forEach(function (f) { refresh(f.key); });
      if (content.photosEnabled) drawGallery();
      drawBar(); drawTop();
      toast("Lagret ✓");
      status("Publiserer på siden. Det kan ta 1 til 6 minutter. Du kan lukke denne siden, endringen kommer uansett.");
      waitUntilLive(r.version, Date.now());
    }).catch(function (e) { saving = false; progress(false); drawBar(); status(e.message, "err"); });
  }
  /* Only says "ute" when the live site really serves the new version */
  function waitUntilLive(version, started) {
    fetch("content.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (c) {
      if (c.version !== version) throw 0;
      progress(false); status("✓ Nå er det ute på siden!", "ok"); toast("Nå er det ute på siden ✓");
    }).catch(function () {
      if (Date.now() - started > 10 * 60 * 1000) { progress(false); status("Lagret. Det tar litt lengre tid enn vanlig, men endringen kommer. Sjekk siden om noen minutter."); return; }
      setTimeout(function () { waitUntilLive(version, started); }, 8000);
    });
  }

  function menu() {
    var list = content.fields.map(function (f) { return '<button class="rd-btn" data-k="' + esc(f.key) + '">' + esc(f.label) + (f.key in edits ? " •" : "") + "</button>"; }).join("");
    var s = openSheet('<h3>Alt du kan endre</h3><div class="rd-list">' + list + "</div>" +
      (changes() ? '<button class="rd-btn rd-quiet" id="rd-discard" style="width:100%">Forkast alle ulagrede endringer</button>' : "") +
      '<h3 style="margin-top:16px">PIN-kode</h3><input type="password" inputmode="numeric" maxlength="8" id="rd-newpin" placeholder="Ny PIN (6 til 8 siffer)">' +
      '<p class="rd-hint" id="rd-pinmsg"></p><button class="rd-btn" id="rd-setpin" style="width:100%">Bytt PIN-kode</button>' +
      '<p class="rd-hint" style="margin-top:14px">Trenger du hjelp, eller vil du ha en ny lenke? Send en melding til Elias, det er gratis.</p>' +
      '<div class="rd-row"><button class="rd-btn" id="rd-out">Logg ut</button><button class="rd-btn" id="rd-view">Se siden</button><button class="rd-btn rd-main" id="rd-close">Lukk</button></div>');
    s.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { var k = b.getAttribute("data-k"); closeSheet(true); editField(k); }; });
    s.querySelector("#rd-close").onclick = function () { closeSheet(); };
    s.querySelector("#rd-view").onclick = function () { location.href = location.pathname; };
    s.querySelector("#rd-out").onclick = function () { store.del("rd-pin:"); location.href = location.pathname; };
    var d = s.querySelector("#rd-discard");
    if (d) d.onclick = function () {
      edits = {}; newPhotos = []; removePhotos = []; store.del("rd-draft:");
      content.fields.forEach(function (f) { refresh(f.key); });
      if (content.photosEnabled) drawGallery();
      drawBar(); closeSheet(); toast("Endringene er forkastet");
    };
    s.querySelector("#rd-setpin").onclick = function () {
      var np = s.querySelector("#rd-newpin").value.trim(), msg = s.querySelector("#rd-pinmsg");
      if (!/^\d{6,8}$/.test(np)) { msg.textContent = "PIN må være 6 til 8 siffer."; return; }
      call("changePin", PIN, np).then(function () {
        PIN = np; if (store.get("rd-pin:")) store.set("rd-pin:", np);
        msg.textContent = "Ny PIN er lagret. Husk den!"; s.querySelector("#rd-newpin").value = "";
      }).catch(function (e) { msg.textContent = e.message; });
    };
  }

  /* ---------- go ---------- */
  fetch("content.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (c) {
    content = c;
    if (!content.api) throw 0;
    var saved = store.get("rd-pin:");
    if (saved) login(saved).then(start).catch(function () { store.del("rd-pin:"); askPin(); });
    else askPin();
  }).catch(function () {
    document.body.appendChild(el("div", "rd-ui rd-top", "Redigering er ikke satt opp for denne siden ennå."));
  });
})();
