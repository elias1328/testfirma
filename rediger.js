/* Reads content.json (written by "Rediger siden") and fills the page.
   Markup:  <p data-felt="omoss">fallback text</p>
            <div data-bilder></div>   (gallery, optional)
   The text already in the HTML stays if content.json can't be read. */
(function () {
  var previewing = false;   // once the edit page sends a preview, the saved version must not overwrite it
  function apply(c) {
    (c.fields || []).forEach(function (f) {
      document.querySelectorAll('[data-felt="' + f.key + '"]').forEach(function (el) {
        if (f.value) { el.textContent = f.value; el.style.whiteSpace = "pre-line"; el.hidden = false; }
        else if (el.hasAttribute("data-skjul-tom")) el.hidden = true;
      });
    });
    document.querySelectorAll("[data-bilder]").forEach(function (box) {
      var photos = (c.photos || []).filter(function (p) {
        return /^bilder\/[\w.-]+\.jpg$/.test(p.src) || /^data:image\/jpeg;base64,/.test(p.src);
      });
      box.innerHTML = "";
      photos.forEach(function (p) {
        var fig = document.createElement("figure");
        var img = document.createElement("img");
        img.src = p.src; img.alt = p.caption || ""; img.loading = "lazy";
        fig.appendChild(img);
        if (p.caption) { var cap = document.createElement("figcaption"); cap.textContent = p.caption; fig.appendChild(cap); }
        box.appendChild(fig);
      });
      var section = box.closest("[data-bilder-seksjon]");
      if (section) section.hidden = photos.length === 0;
    });
  }

  fetch("content.json?t=" + Date.now(), { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (c) { if (!previewing) apply(c); })
    .catch(function () { /* keep the built-in text */ });

  // Preview from the edit page: only shows on that screen, nothing is saved
  if (/[?&]forhandsvisning=1/.test(location.search)) {
    window.addEventListener("message", function (e) {
      if (e.data && e.data.type === "rediger-preview" && e.data.content) { previewing = true; apply(e.data.content); }
    });
  }
})();
