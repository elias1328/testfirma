/* Reads content.json (written by "Rediger siden") and fills the page.
   Markup:  <p data-felt="omoss">fallback text</p>
            <div data-bilder></div>   (gallery, optional)
   The text already in the HTML stays if content.json can't be read. */
(function () {
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

  // Edit mode (/rediger/ sends people here): load the editor on top of the page instead
  if (/[?&]rediger=1/.test(location.search)) {
    var sc = document.createElement("script");
    sc.src = "rediger-modus.js?t=" + Date.now();
    document.head.appendChild(sc);
    return;
  }

  fetch("content.json?t=" + Date.now(), { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(apply)
    .catch(function () { /* keep the built-in text */ });
})();
