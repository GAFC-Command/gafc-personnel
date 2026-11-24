/* Builds a Counseling / Award PDF from a form definition and entered values.
   Layout mirrors the printed forms: Letter, 40pt margins, black and gold. */
(function (g) {
  var W = 612, H = 792, M = 40, FW = W - 2 * M;

  function fmtDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    return m ? m[2] + "/" + m[3] + "/" + m[1] : v || "";
  }

  async function buildPdf(opts) {
    var L = opts.PDFLib;
    var PDFDocument = L.PDFDocument, StandardFonts = L.StandardFonts, rgb = L.rgb;
    var spec = opts.form, values = opts.values || {};

    var GOLD = rgb(0.98, 0.72, 0.17), DARK = rgb(0.07, 0.07, 0.07);
    var BORDER = rgb(0.30, 0.30, 0.30), FIELD_BG = rgb(0.98, 0.96, 0.90);
    var BLACK = rgb(0, 0, 0), GREY = rgb(0.3, 0.3, 0.3), GOLDTXT = rgb(0.72, 0.50, 0.05);

    var doc = await PDFDocument.create();
    doc.setTitle("Global Armed Forces Command - " + spec.heading);
    doc.setCreator("Global Armed Forces Command");
    var page = doc.addPage([W, H]);
    var helv = await doc.embedFont(StandardFonts.Helvetica);
    var helvB = await doc.embedFont(StandardFonts.HelveticaBold);
    var helvO = await doc.embedFont(StandardFonts.HelveticaOblique);
    var helvBO = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
    var timesI = await doc.embedFont(StandardFonts.TimesRomanItalic);
    var logo = opts.logoBytes ? await doc.embedPng(opts.logoBytes) : null;
    var pf = opts.flatten ? null : doc.getForm();

    var charset = {};
    helv.getCharacterSet().forEach(function (cp) { charset[cp] = 1; });
    function clean(s, multi) {
      s = String(s == null ? "" : s).replace(/\r\n?/g, "\n").replace(/\t/g, " ");
      if (!multi) s = s.replace(/\n/g, " ");
      var out = "";
      for (var ch of s) {
        out += (ch === "\n" || charset[ch.codePointAt(0)]) ? ch : "?";
      }
      return out;
    }

    function wrap(text, font, size, maxW) {
      var lines = [];
      text.split("\n").forEach(function (para) {
        var cur = "";
        para.split(" ").forEach(function (w) {
          var t = cur ? cur + " " + w : w;
          if (font.widthOfTextAtSize(t, size) <= maxW) { cur = t; return; }
          if (cur) lines.push(cur);
          var word = w;
          while (font.widthOfTextAtSize(word, size) > maxW && word.length > 1) {
            var i = word.length;
            while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > maxW) i--;
            lines.push(word.slice(0, i));
            word = word.slice(i);
          }
          cur = word;
        });
        lines.push(cur);
      });
      return lines;
    }

    var overflow = [];
    var y = H - 28;

    function text(t, x, yy, size, font, color) {
      page.drawText(t, { x: x, y: yy, size: size, font: font, color: color || BLACK });
    }
    function center(t, cx, yy, size, font, color) {
      text(t, cx - font.widthOfTextAtSize(t, size) / 2, yy, size, font, color);
    }
    function label(x, t, yy) { text(clean(t), x, yy, 7, helv, BLACK); }

    function addText(name, x, bottom, w, h, raw, o) {
      o = o || {};
      var font = o.sig ? timesI : helv;
      var v = clean(raw, o.multi);
      var size = o.size || 9;
      if (o.multi) {
        var fit = false;
        for (size = 9; size >= 6; size -= 0.5) {
          var lines = wrap(v, font, size, w - 8);
          if (lines.length <= Math.floor((h - 4) / (size * 1.2))) { fit = true; break; }
        }
        if (!fit) { size = 6; overflow.push({ label: o.label || name, text: v }); }
      } else {
        size = o.size || (o.sig ? 11 : 9);
        while (size > 6.5 && font.widthOfTextAtSize(v, size) > w - 6) size -= 0.5;
      }
      if (opts.flatten) {
        page.drawRectangle({ x: x, y: bottom, width: w, height: h, color: FIELD_BG, borderColor: BORDER, borderWidth: 0.75 });
        if (!v) return;
        if (o.multi) {
          var ls = wrap(v, font, size, w - 8), step = size * 1.2;
          var max = Math.floor((h - 4) / step);
          ls.slice(0, max).forEach(function (ln, i) {
            text(ln, x + 4, bottom + h - 3 - size - i * step, size, font, BLACK);
          });
        } else {
          text(v, x + 4, bottom + h / 2 - size * 0.35, size, font, BLACK);
        }
        return;
      }
      var tf = pf.createTextField(name);
      if (o.multi) tf.enableMultiline();
      if (v) tf.setText(v);
      tf.addToPage(page, {
        x: x, y: bottom, width: w, height: h, font: font,
        borderWidth: 0.75, borderColor: BORDER, backgroundColor: FIELD_BG, textColor: BLACK
      });
      tf.setFontSize(size);
      tf.updateAppearances(font);
    }

    function addCheck(name, x, yy, checked) {
      if (opts.flatten) {
        page.drawRectangle({ x: x + 2, y: yy - 11, width: 11, height: 11, color: FIELD_BG, borderColor: BORDER, borderWidth: 0.75 });
        if (checked) {
          var bx = x + 2, by = yy - 11;
          page.drawLine({ start: { x: bx + 2, y: by + 5.5 }, end: { x: bx + 4.5, y: by + 2.5 }, thickness: 1.4, color: BLACK });
          page.drawLine({ start: { x: bx + 4.5, y: by + 2.5 }, end: { x: bx + 9, y: by + 9 }, thickness: 1.4, color: BLACK });
        }
        return;
      }
      var cb = pf.createCheckBox(name);
      cb.addToPage(page, {
        x: x + 2, y: yy - 11, width: 11, height: 11,
        borderWidth: 0.75, borderColor: BORDER, backgroundColor: FIELD_BG
      });
      if (checked) cb.check();
    }

    // ---- Letterhead ----
    var LOGO_H = 70, LOGO_W = logo ? LOGO_H * logo.width / logo.height : 0;
    if (logo) page.drawImage(logo, { x: M, y: y - LOGO_H, width: LOGO_W, height: LOGO_H });
    var cx = M + LOGO_W + (FW - LOGO_W) / 2;
    center("GLOBAL ARMED FORCES COMMAND", cx, y - 31, 20, helvB, BLACK);
    center(spec.heading, cx, y - 48, 11, helvB, GOLDTXT);
    center(spec.sub, cx, y - 60, 7.5, helv, GREY);
    y -= LOGO_H + 3;
    page.drawLine({ start: { x: M, y: y }, end: { x: W - M, y: y }, thickness: 2.5, color: GOLD });
    page.drawLine({ start: { x: M, y: y - 3 }, end: { x: W - M, y: y - 3 }, thickness: 0.75, color: DARK });
    y -= 9;

    // ---- Body ----
    spec.items.forEach(function (it) {
      if (it.k === "bar") {
        page.drawRectangle({ x: M, y: y - 15, width: FW, height: 15, color: DARK });
        text(it.text, M + 6, y - 15 + 4.5, 9, helvB, GOLD);
        y -= 18;
      } else if (it.k === "sub") {
        text(it.text, M, y - 6, 7.5, helvB, BLACK);
        y -= 9;
      } else if (it.k === "row") {
        var h = it.h || 18, gap = 8;
        var total = it.fields.reduce(function (a, f) { return a + f.w; }, 0);
        var usable = FW - gap * (it.fields.length - 1);
        var x = M;
        it.fields.forEach(function (f) {
          var w = usable * f.w / total;
          label(x, f.l, y - 7);
          var val = f.date ? fmtDate(values[f.n]) : values[f.n];
          addText(f.n, x, y - 10 - h, w, h, val, { sig: f.sig });
          x += w + gap;
        });
        y -= 10 + h + 4;
      } else if (it.k === "area") {
        label(M, it.l, y - 7);
        addText(it.n, M, y - 10 - it.h, FW, it.h, values[it.n], { multi: true, label: it.l });
        y -= 10 + it.h + 4;
      } else if (it.k === "checks") {
        var colw = FW / it.cols;
        it.items.forEach(function (c, i) {
          var r = Math.floor(i / it.cols), col = i % it.cols;
          var bx = M + col * colw, by = y - r * 16;
          addCheck(c[1], bx, by, !!values[c[1]]);
          text(clean(c[0]), bx + 17, by - 9, 8.5, helv, BLACK);
        });
        y -= Math.ceil(it.items.length / it.cols) * 16 + 2;
      } else if (it.k === "other") {
        addCheck(it.cb, M, y, !!values[it.cb]);
        text(it.l, M + 17, y - 9, 8.5, helv, BLACK);
        var fx = M + 100;
        addText(it.tn, fx, y - 14, W - M - fx, 15, values[it.tn], { size: 8.5 });
        y -= 20;
      } else if (it.k === "note") {
        text(it.text, M, y - 6, 7.5, helvBO, BLACK);
        y -= 10;
      } else if (it.k === "text") {
        text(it.text, M, y - 8, 8, helv, BLACK);
        y -= 12;
      }
    });

    center("Maintain a completed copy in the soldier's personnel file.", W / 2, 20, 7, helvO, GREY);

    // ---- Continuation pages for text that did not fit ----
    if (overflow.length) {
      var cp = doc.addPage([W, H]), cy = H - 60;
      cp.drawText("CONTINUATION", { x: M, y: cy, size: 14, font: helvB, color: BLACK });
      cy -= 12;
      cp.drawText(clean(spec.heading + (values[spec.nameField] ? "  |  " + values[spec.nameField] : "")),
        { x: M, y: cy, size: 8, font: helv, color: GREY });
      cy -= 26;
      overflow.forEach(function (o) {
        if (cy < 90) { cp = doc.addPage([W, H]); cy = H - 60; }
        cp.drawText(o.label, { x: M, y: cy, size: 9, font: helvB, color: BLACK });
        cy -= 14;
        wrap(o.text, helv, 10, FW).forEach(function (ln) {
          if (cy < 50) { cp = doc.addPage([W, H]); cy = H - 60; }
          cp.drawText(ln, { x: M, y: cy, size: 10, font: helv, color: BLACK });
          cy -= 13;
        });
        cy -= 14;
      });
    }

    return await doc.save({ useObjectStreams: false });
  }

  g.buildPdf = buildPdf;
  if (typeof module !== "undefined" && module.exports) module.exports = buildPdf;
})(typeof globalThis !== "undefined" ? globalThis : window);
