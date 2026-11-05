/* Edit mode ("Rediger siden") on top of the real site. Loaded by rediger.js only when
   the page is opened with ?rediger=1 (the /rediger/ link redirects there).
   Works on any site that marks editable text with data-felt="key" and the gallery
   with data-bilder. The backend address is "api" in content.json. */
(function () {
  "use strict";
  var PIN = "", content = null, edits = {}, newPhotos = [], removePhotos = [], openKey = null;

  /* ---------- styles (prefixed rd- so they never clash with the site) ---------- */
  var css = document.createElement("style");
  css.textContent = [
    ".rd-ui,.rd-ui *{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:normal;text-transform:none}",
    ".rd-edit{outline:2px dashed #1f6fb2!important;outline-offset:3px;cursor:pointer!important;position:relative;min-height:1em}",
    ".rd-edit.rd-changed{outline-style:solid!important;outline-color:#e07b00!important}",
    ".rd-pen{position:absolute;top:-14px;right:-10px;width:28px;height:28px;border-radius:50%;background:#1f6fb2;color:#fff;font:14px/28px system-ui;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3);z-index:5;pointer-events:none}",
    ".rd-empty{display:block!important;opacity:.85}",
    ".rd-add{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;border:2px dashed #1f6fb2;border-radius:8px;min-height:140px;background:rgba(31,111,178,.06);color:#1f6fb2;font:600 16px system-ui;cursor:pointer}",
    ".rd-add b{font-size:40px;line-height:1}",
    ".rd-ph{position:relative}",
    ".rd-x{position:absolute;top:6px;right:6px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font:20px/34px system-ui;cursor:pointer}",
    ".rd-ph.rd-gone img{opacity:.25}",
    ".rd-ph.rd-new{outline:3px solid #e07b00;outline-offset:2px;border-radius:8px}",
    ".rd-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#fff;color:#1d1d1b;border-top:1px solid #ddd;box-shadow:0 -2px 12px rgba(0,0,0,.12);padding:10px 12px calc(10px + env(safe-area-inset-bottom))}",
    ".rd-row{display:flex;gap:8px;align-items:center;max-width:720px;margin:0 auto}",
    ".rd-btn{font:600 16px system-ui;border:0;border-radius:10px;padding:13px 16px;cursor:pointer;background:#e9e7e1;color:#1d1d1b}",
    ".rd-btn.rd-main{background:#1f6fb2;color:#fff;flex:1}",
    ".rd-btn:disabled{opacity:.5}",
    ".rd-status{max-width:720px;margin:6px auto 0;font:14px/1.4 system-ui;color:#555;min-height:1.2em}",
    ".rd-status.rd-ok{color:#2e7d32;font-weight:600}.rd-status.rd-err{color:#b3261e}",
    ".rd-top{position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#1d1d1b;color:#fff;font:14px/1.4 system-ui;padding:8px 12px;text-align:center}",
    ".rd-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483001;background:#fff;color:#1d1d1b;border-radius:16px 16px 0 0;box-shadow:0 -4px 24px rgba(0,0,0,.25);padding:16px 16px calc(16px + env(safe-area-inset-bottom));max-height:85vh;overflow:auto}",
    ".rd-sheet .rd-in{max-width:720px;margin:0 auto}",
    ".rd-sheet h3{margin:0 0 4px;font:700 18px system-ui}",
    ".rd-hint{font:14px/1.4 system-ui;color:#666;margin:4px 0 10px}",
    ".rd-sheet textarea,.rd-sheet input{width:100%;font:17px/1.4 system-ui;padding:12px;border:1px solid #ccc;border-radius:8px;background:#fff;color:#1d1d1b}",
    ".rd-sheet textarea{min-height:120px;resize:vertical}",
    ".rd-count{text-align:right;font:13px system-ui;color:#888;margin-top:4px}",
    ".rd-shade{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483000}",
    ".rd-list button{display:block;width:100%;text-align:left;margin:6px 0}",
    ".rd-notice{background:#fff8e1;border:1px solid #f0d98a;border-radius:8px;padding:8px 10px;font:14px/1.4 system-ui;margin:8px 0}",
    "body.rd-on{padding-bottom:140px!important}"
  ].join("\n");
  document.head.appendChild(css);

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- backend ---------- */
  function call(action) {
    var args = Array.prototype.slice.call(arguments, 1);
    return fetch(content.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: action, args: args }) })
      .catch(function () { throw new Error("Får ikke kontakt. Sjekk internett og prøv igjen."); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "Noe gikk galt. Prøv igjen om litt." }; }); })
      .then(function (d) { if (!d.ok) throw new Error(d.error); return d.result; });
  }

  /* ---------- sheets (bottom panels) ---------- */
  var shade = null, sheet = null;
  function openSheet(html) {
    closeSheet();
    shade = el("div", "rd-ui rd-shade"); shade.onclick = closeSheet;
    sheet = el("div", "rd-ui rd-sheet", '<div class="rd-in">' + html + "</div>");
    document.body.appendChild(shade); document.body.appendChild(sheet);
    return sheet;
  }
  function closeSheet() {
    if (shade) shade.remove(); if (sheet) sheet.remove(); shade = sheet = null; openKey = null;
  }

  /* ---------- PIN ---------- */
  function askPin(msg) {
    var s = openSheet('<h3>Rediger siden</h3><p class="rd-hint">Skriv inn PIN-koden du har fått.</p>' +
      '<input type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" id="rd-pin">' +
      '<p class="rd-hint" id="rd-pinmsg" style="color:#b3261e">' + esc(msg || "") + '</p>' +
      '<button class="rd-btn rd-main" id="rd-go" style="width:100%">Åpne</button>' +
      '<p class="rd-hint">Tips: Legg denne siden til på hjemskjermen, så finner du den igjen som en app.</p>');
    shade.onclick = null;   // can't close the PIN box by tapping outside
    var inp = s.querySelector("#rd-pin"), go = s.querySelector("#rd-go");
    function login() {
      var pin = inp.value.trim(); if (!pin) return;
      go.disabled = true; s.querySelector("#rd-pinmsg").textContent = "Åpner...";
      call("login", pin).then(function (r) {
        PIN = pin; content.fields = r.content.fields; content.photos = r.content.photos || [];
        content.photosEnabled = r.content.photosEnabled;
        closeSheet(); start();
      }).catch(function (e) { go.disabled = false; s.querySelector("#rd-pinmsg").textContent = e.message; });
    }
    go.onclick = login;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") login(); });
    setTimeout(function () { inp.focus(); }, 50);
  }

  /* ---------- edit mode ---------- */
  function field(key) { return content.fields.filter(function (f) { return f.key === key; })[0]; }
  function value(f) { return f.key in edits ? edits[f.key] : (f.value || ""); }
  function changes() { return Object.keys(edits).length + newPhotos.length + removePhotos.length; }

  function start() {
    document.body.classList.add("rd-on");
    var top = el("div", "rd-ui rd-top", "Redigering: trykk på det du vil endre. Ingenting er lagret før du trykker Lagre.");
    document.body.appendChild(top);
    document.body.style.paddingTop = top.offsetHeight + "px";

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
  }

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
  }
  function refresh(key) {
    var f = field(key);
    document.querySelectorAll('[data-felt="' + key + '"]').forEach(function (n) { show(n, f); });
    drawBar();
  }

  function editField(key) {
    var f = field(key), tag = f.multiline ? "textarea" : "input";
    var s = openSheet("<h3>" + esc(f.label) + "</h3>" + (f.hint ? '<p class="rd-hint">' + esc(f.hint) + "</p>" : '<p class="rd-hint">Siden oppdateres mens du skriver.</p>') +
      "<" + tag + ' id="rd-val"' + (f.max ? ' maxlength="' + f.max + '"' : "") + "></" + tag + ">" +
      '<div class="rd-count" id="rd-n"></div>' +
      '<div class="rd-row" style="margin-top:10px"><button class="rd-btn" id="rd-undo">Angre</button><button class="rd-btn rd-main" id="rd-done">Ferdig</button></div>');
    openKey = key;
    var inp = s.querySelector("#rd-val"); inp.value = value(f);
    function count() { if (f.max) s.querySelector("#rd-n").textContent = inp.value.length + " / " + f.max; }
    inp.addEventListener("input", function () {
      if (inp.value === (f.value || "")) delete edits[key]; else edits[key] = inp.value;
      count(); refresh(key); status("");
    });
    s.querySelector("#rd-undo").onclick = function () { delete edits[key]; inp.value = f.value || ""; count(); refresh(key); };
    s.querySelector("#rd-done").onclick = closeSheet;
    count();
    setTimeout(function () { inp.focus(); }, 50);
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
        box.appendChild(photoTile(p.dataUrl, p.caption, "rd-new", function () { newPhotos.splice(i, 1); drawGallery(); drawBar(); }, function () { captionFor(p); }));
      });
      (content.photos || []).forEach(function (p) {
        var gone = removePhotos.indexOf(p.src) >= 0;
        box.appendChild(photoTile(p.src, p.caption, gone ? "rd-gone" : "", function () {
          if (gone) removePhotos = removePhotos.filter(function (s) { return s !== p.src; }); else removePhotos.push(p.src);
          drawGallery(); drawBar();
        }, null, gone));
      });
    });
  }
  function photoTile(src, caption, cls, onX, onTap, gone) {
    var fig = el("figure", "rd-ph " + cls);
    var img = el("img"); img.src = src; img.alt = caption || ""; fig.appendChild(img);
    if (caption) { var c = el("figcaption"); c.textContent = caption; fig.appendChild(c); }
    var x = el("button", "rd-ui rd-x", gone ? "↺" : "✕");
    x.title = gone ? "Angre sletting" : "Slett bildet";
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
        status("Gjør klar bildet...");
        files.reduce(function (p, f) {
          return p.then(function () { return shrink(f).then(function (url) { newPhotos.unshift({ dataUrl: url, caption: "" }); }); });
        }, Promise.resolve()).then(function () {
          status(""); drawGallery(); drawBar(); if (newPhotos.length) captionFor(newPhotos[0]);
        }).catch(function () { status("Bildet kunne ikke leses. Prøv et annet bilde.", "err"); });
      };
    }
    picker.click();
  }
  function captionFor(p) {
    var s = openSheet('<h3>Tekst under bildet</h3><p class="rd-hint">Valgfritt. For eksempel hva slags jobb det var.</p>' +
      '<p class="rd-notice">Viser bildet noens hjem eller personer? Spør dem først før du legger det ut.</p>' +
      '<input id="rd-cap" maxlength="120"><div class="rd-row" style="margin-top:10px"><button class="rd-btn rd-main" id="rd-done">Ferdig</button></div>');
    var inp = s.querySelector("#rd-cap"); inp.value = p.caption;
    inp.oninput = function () { p.caption = inp.value; };
    s.querySelector("#rd-done").onclick = function () { closeSheet(); drawGallery(); };
  }
  /* Resize on the phone: max 1600 px, JPEG. Re-encoding also drops GPS/EXIF data. */
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
  var bar = null;
  function drawBar() {
    if (!bar) {
      bar = el("div", "rd-ui rd-bar", '<div class="rd-row"><button class="rd-btn" id="rd-menu">⋯</button>' +
        '<button class="rd-btn rd-main" id="rd-save"></button></div><div class="rd-status" id="rd-status"></div>');
      document.body.appendChild(bar);
      bar.querySelector("#rd-save").onclick = save;
      bar.querySelector("#rd-menu").onclick = menu;
    }
    var n = changes(), b = bar.querySelector("#rd-save");
    b.textContent = n ? "Lagre (" + n + (n === 1 ? " endring)" : " endringer)") : "Lagre";
    b.disabled = !n;
  }
  function status(t, cls) { var s = document.getElementById("rd-status"); if (!s) return; s.textContent = t; s.className = "rd-status" + (cls ? " rd-" + cls : ""); }

  function save() {
    var b = bar.querySelector("#rd-save"); b.disabled = true; status("Lagrer...");
    call("save", PIN, { fields: edits, newPhotos: newPhotos, removePhotos: removePhotos }).then(function (r) {
      content.fields = r.content.fields; content.photos = r.content.photos || [];
      edits = {}; newPhotos = []; removePhotos = [];
      content.fields.forEach(function (f) { refresh(f.key); });
      if (content.photosEnabled) drawGallery();
      drawBar();
      status("Lagret! Det kan ta 1 til 6 minutter før det vises på siden. Du kan lukke denne siden, endringen kommer uansett.");
      waitUntilLive(r.version, Date.now());
    }).catch(function (e) { drawBar(); status(e.message, "err"); });
  }
  /* Only says "ute" when the live site really serves the new version */
  function waitUntilLive(version, started) {
    fetch("content.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (c) {
      if (c.version === version) { status("✓ Nå er det ute på siden!", "ok"); return; }
      throw 0;
    }).catch(function () {
      if (Date.now() - started > 10 * 60 * 1000) { status("Lagret. Det tar litt lengre tid enn vanlig, men endringen kommer. Sjekk siden om noen minutter."); return; }
      setTimeout(function () { waitUntilLive(version, started); }, 10000);
    });
  }

  function menu() {
    var list = content.fields.map(function (f) { return '<button class="rd-btn" data-k="' + esc(f.key) + '">' + esc(f.label) + "</button>"; }).join("");
    var s = openSheet('<h3>Alt du kan endre</h3><div class="rd-list">' + list + "</div>" +
      '<h3 style="margin-top:16px">PIN-kode</h3><input type="password" inputmode="numeric" maxlength="8" id="rd-newpin" placeholder="Ny PIN (6 til 8 siffer)">' +
      '<p class="rd-hint" id="rd-pinmsg"></p><button class="rd-btn" id="rd-setpin" style="width:100%">Bytt PIN-kode</button>' +
      '<p class="rd-hint">Trenger du hjelp, eller vil du ha en ny lenke? Send en melding til Elias, det er gratis.</p>' +
      '<button class="rd-btn rd-main" id="rd-close" style="width:100%">Lukk</button>');
    s.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { var k = b.getAttribute("data-k"); closeSheet(); editField(k); }; });
    s.querySelector("#rd-close").onclick = closeSheet;
    s.querySelector("#rd-setpin").onclick = function () {
      var np = s.querySelector("#rd-newpin").value.trim(), msg = s.querySelector("#rd-pinmsg");
      if (!/^\d{6,8}$/.test(np)) { msg.textContent = "PIN må være 6 til 8 siffer."; return; }
      call("changePin", PIN, np).then(function () { PIN = np; msg.textContent = "Ny PIN er lagret. Husk den!"; s.querySelector("#rd-newpin").value = ""; })
        .catch(function (e) { msg.textContent = e.message; });
    };
  }

  /* ---------- go ---------- */
  fetch("content.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (c) {
    content = c;
    if (!content.api) throw 0;
    askPin();
  }).catch(function () {
    document.body.appendChild(el("div", "rd-ui rd-top", "Redigering er ikke satt opp for denne siden ennå."));
  });
})();
