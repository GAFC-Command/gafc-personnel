(function () {
  "use strict";
  var hl = document.getElementById("hdrlogo"); if (hl && window.GAFC_LOGO) { hl.src = window.GAFC_LOGO; hl.style.display = ""; }
  var C = window.GAFC_CONFIG, FORMS = window.FORMS;
  var sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } });
  var S = { session: null, me: null, ranks: [], billets: [], units: [], articles: [], names: {}, logo: null, busy: false };
  var $ = function (s) { return document.querySelector(s); };

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (a) {
      var v = attrs[a];
      if (v === undefined || v === null || v === false) return;
      if (a === "text") e.textContent = v;
      else if (a === "onclick") e.addEventListener("click", v);
      else if (a === "onchange") e.addEventListener("change", v);
      else if (a === "oninput") e.addEventListener("input", v);
      else if (a === "value") e.value = v;
      else if (v === true) e.setAttribute(a, "");
      else e.setAttribute(a, v);
    });
    (kids || []).forEach(function (k) { if (k !== null && k !== undefined) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return e;
  }
  function toast(msg, bad) { var t = $("#toast"); t.textContent = msg; t.style.borderColor = bad ? "var(--red)" : "var(--gold)"; t.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(function () { t.style.display = "none"; }, 4500); }
  function role(r) { return !!(S.me && S.me.site_roles && S.me.site_roles.indexOf(r) >= 0); }
  function isLeader() { return role("fll") || role("s1") || role("commander"); }
  function rankName(id) { var r = S.ranks.find(function (x) { return x.id === id; }); return r ? r.abbr : ""; }
  function billetName(id) { var b = S.billets.find(function (x) { return x.id === id; }); return b ? b.name : ""; }
  function unitName(id) { var u = S.units.find(function (x) { return x.id === id; }); return u ? u.name : ""; }
  function nm(id) { return S.names[id] || id; }
  function fmtDate(v) { if (!v) return ""; var d = new Date(v); return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function rpc(name, args) { return sb.rpc(name, args).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; }); }
  function fail(e) { toast(e.message || String(e), true); }

  // ---------- Sign-in ----------
  function clearSyncFlags() { try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf("gafc_synced_") === 0) sessionStorage.removeItem(k); }); } catch (e) { /* storage unavailable */ } }
  function signIn() {
    clearSyncFlags();
    sb.auth.signInWithOAuth({ provider: "discord", options: { scopes: "identify guilds guilds.members.read", redirectTo: location.origin + location.pathname } });
  }
  async function signOut() { clearSyncFlags(); await sb.auth.signOut(); S.me = null; location.hash = ""; boot(); }
  function viewSignIn(msg) {
    var m = $("#main"); m.textContent = "";
    $("#nav").textContent = "";
    m.appendChild(h("div", { class: "center" }, [
      window.GAFC_LOGO ? h("img", { src: window.GAFC_LOGO, alt: "", style: "width:120px" }) : null, h("h1", { text: "GAFC Personnel" }),
      h("p", { class: "muted", text: "Sign in with Discord. You see only what your role allows." }),
      msg ? h("p", { class: "err", text: msg }) : null,
      h("button", { class: "primary", text: "Sign in with Discord", onclick: signIn })
    ]));
  }
  async function syncMe(session) {
    var r = await fetch(C.functions + "/sync-me", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ provider_token: session.provider_token }) });
    var b = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(b.error || "Sign-in check failed");
  }
  async function boot() {
    if (S.busy) return;
    S.busy = true;
    try { await bootInner(); } finally { S.busy = false; }
  }
  async function bootInner() {
    var s = (await sb.auth.getSession()).data.session;
    S.session = s;
    if (!s) return viewSignIn();
    try {
      if (s.provider_token && !sessionStorage.getItem("gafc_synced_" + s.user.id)) { await syncMe(s); sessionStorage.setItem("gafc_synced_" + s.user.id, "1"); }
      var q = await sb.from("members").select("*").eq("user_id", s.user.id).maybeSingle();
      if (!q.data) { await sb.auth.signOut(); return viewSignIn("No active GAFC record for this Discord account. Ask your S1 or J1."); }
      if (["active", "on_loa"].indexOf(q.data.status) < 0) { await sb.auth.signOut(); return viewSignIn("Your record is not active."); }
      S.me = q.data;
      await loadLists();
      route();
    } catch (e) { await sb.auth.signOut(); viewSignIn(e.message); }
  }
  async function loadLists() {
    var r = await Promise.all([sb.from("ranks").select("*").order("sort"), sb.from("billets").select("*").order("name"), sb.from("units").select("*").order("name"),
      sb.from("infraction_articles").select("*").eq("retired", false).order("article_no"), sb.from("roster").select("*")]);
    S.ranks = r[0].data || []; S.billets = r[1].data || []; S.units = r[2].data || []; S.articles = r[3].data || [];
    S.names = {}; (r[4].data || []).forEach(function (m) { S.names[m.discord_id] = m.username; });
    S.roster = r[4].data || [];
  }

  // ---------- Router ----------
  function nav() {
    var n = $("#nav"); n.textContent = ""; var cur = location.hash || "#/";
    var items = [["#/", "Home"], ["#/roster", "Roster"]];
    if (isLeader()) items.push(["#/new/counseling", "New counseling"], ["#/new/award", "New award"]);
    if (role("admin")) items.push(["#/admin", "Admin"]);
    items.forEach(function (i) { n.appendChild(h("a", { href: i[0], class: cur === i[0] ? "on" : "", text: i[1] })); });
    n.appendChild(h("button", { text: "Sign out (" + S.me.username + ")", onclick: signOut }));
  }
  function route() {
    if (!S.me) return boot();
    nav();
    var p = (location.hash || "#/").replace(/^#/, "").split("?")[0].split("/").filter(Boolean);
    var m = $("#main"); m.textContent = "";
    var done = function (e) { fail(e); };
    if (!p.length) return viewHome().catch(done);
    if (p[0] === "roster") return viewRoster().catch(done);
    if (p[0] === "member") return viewMember(p[1]).catch(done);
    if (p[0] === "new") return viewForm(p[1], null).catch(done);
    if (p[0] === "edit") return viewForm(null, p[1]).catch(done);
    if (p[0] === "doc") return viewDoc(p[1]).catch(done);
    if (p[0] === "admin") return viewAdmin(p[1] || "members").catch(done);
    m.appendChild(h("p", { text: "Not found." }));
  }
  window.addEventListener("hashchange", function () { if (S.me) route(); });
  sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_IN" && !S.me) setTimeout(boot, 0); });

  // ---------- Documents ----------
  function kindLabel(k) { return k === "award" ? "Award recommendation" : "Counseling"; }
  function statusPill(d) {
    var t = d.status === "filed" ? "Filed" : d.status === "submitted" ? "Awaiting commander" : d.status === "draft" ? "Draft" : "Disapproved";
    var c = d.status === "filed" ? "green" : d.status === "disapproved" ? "red" : "gold";
    return h("span", { class: "pill " + c, text: t });
  }
  function docRow(d) {
    return h("tr", {}, [
      h("td", {}, [h("a", { href: "#/doc/" + d.id, text: kindLabel(d.kind) })]),
      h("td", { text: nm(d.soldier_id) }), h("td", { text: nm(d.author_id) }), h("td", {}, [statusPill(d)]), h("td", { text: fmtDate(d.updated_at) })
    ]);
  }
  function docTable(rows) {
    if (!rows.length) return h("p", { class: "muted", text: "Nothing here." });
    return h("table", {}, [h("tr", {}, ["Document", "Soldier", "Author", "Status", "Updated"].map(function (x) { return h("th", { text: x }); }))].concat(rows.map(docRow)));
  }
  async function pdfFor(d) {
    if (!S.logo && window.GAFC_LOGO) S.logo = new Uint8Array(await (await fetch(window.GAFC_LOGO)).arrayBuffer());
    return window.buildPdf({ PDFLib: window.PDFLib, form: FORMS[d.kind], values: d.values, logoBytes: S.logo, flatten: true });
  }
  function download(bytes, name) {
    var a = h("a", { href: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), download: name }); document.body.appendChild(a); a.click(); a.remove();
  }
  function toB64(u8) { var s = "", i; for (i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  async function driveSave(d) {
    var bytes = await pdfFor(d);
    var r = await fetch(C.functions + "/drive-save", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + S.session.access_token }, body: JSON.stringify({ id: d.id, pdf_base64: toB64(bytes) }) });
    return r.ok;
  }
  async function retryDrive(limit) {
    var q = await sb.from("documents").select("*").eq("status", "filed").in("drive_status", ["pending", "failed"]).limit(limit || 3);
    var n = 0; for (var d of (q.data || [])) { try { if (await driveSave(d)) n++; } catch (e) { /* retried on the next visit */ } }
    return n;
  }

  async function viewHome() {
    var m = $("#main"), me = S.me;
    m.appendChild(h("h1", { text: "Welcome, " + me.username }));
    m.appendChild(h("div", { class: "card" }, [h("div", {}, [h("strong", { text: [rankName(me.rank_id), me.username].filter(Boolean).join(" ") })]),
      h("div", { class: "muted", text: [billetName(me.billet_id), unitName(me.unit_id)].filter(Boolean).join(" / ") || "No billet or unit set" }),
      h("div", {}, me.site_roles.map(function (r) { return h("span", { class: "pill", text: r, style: "margin-right:6px" }); }))]));
    var jobs = [];
    var q = function (f) { return f(sb.from("documents").select("*").order("updated_at", { ascending: false })); };
    if (isLeader()) jobs.push(["Your drafts", q(function (x) { return x.eq("status", "draft").eq("author_id", me.discord_id); })]);
    if (role("commander")) jobs.push(["Awaiting your decision", q(function (x) { return x.eq("status", "submitted"); })]);
    if (role("s1")) jobs.push(["Rejected counselings for S1 review", q(function (x) { return x.eq("soldier_response", "rejected").is("s1_decision", null); })]);
    jobs.push(["Counselings waiting for your response", q(function (x) { return x.eq("soldier_id", me.discord_id).eq("kind", "counseling").eq("status", "filed").is("soldier_response", null); })]);
    for (var j of jobs) { var r = await j[1]; m.appendChild(h("h2", { text: j[0] })); m.appendChild(docTable(r.data || [])); }
    m.appendChild(h("h2", { text: "Your documents" }));
    var mine = await q(function (x) { return x.eq("soldier_id", me.discord_id).eq("status", "filed"); });
    m.appendChild(docTable(mine.data || []));
    if (isLeader()) retryDrive(3);
  }

  async function viewRoster() {
    var m = $("#main"); m.appendChild(h("h1", { text: "Roster" }));
    var search = h("input", { placeholder: "Search by username", oninput: draw });
    var unitFilter = opt(S.units, "Unit", "id", function (u) { return u.name; }, "All units"); unitFilter.onchange = function () { draw(); }; m.appendChild(h("div", { class: "row" }, [search, unitFilter])); var box = h("div"); m.appendChild(box);
    var rows = S.roster.slice().sort(function (a, b) { return (b.rank_id ? S.ranks.findIndex(function (r) { return r.id === b.rank_id; }) : -1) - (a.rank_id ? S.ranks.findIndex(function (r) { return r.id === a.rank_id; }) : -1); });
    function draw() {
      var t = search.value.toLowerCase(); box.textContent = "";
      var uf = unitFilter.value ? parseInt(unitFilter.value, 10) : null; var list = rows.filter(function (r) { return (!t || r.username.toLowerCase().indexOf(t) >= 0) && (uf === null || r.unit_id === uf); });
      box.appendChild(h("table", {}, [h("tr", {}, ["Rank", "Username", "Billet", "Unit", "Status"].map(function (x) { return h("th", { text: x }); }))].concat(list.map(function (r) {
        return h("tr", {}, [h("td", { text: rankName(r.rank_id) }), h("td", {}, [isLeader() ? h("a", { href: "#/member/" + r.discord_id, text: r.username }) : r.username]),
          h("td", { text: billetName(r.billet_id) }), h("td", { text: unitName(r.unit_id) }), h("td", { text: r.status === "on_loa" ? "On LOA" : "Active" })]);
      }))));
    }
    draw();
  }

  async function viewMember(id) {
    var m = $("#main");
    var mem = await sb.from("members").select("*").eq("discord_id", id).maybeSingle();
    if (!mem.data) { m.appendChild(h("p", { class: "err", text: "You cannot view that member." })); return; }
    var x = mem.data;
    m.appendChild(h("h1", { text: [rankName(x.rank_id), x.username].filter(Boolean).join(" ") }));
    m.appendChild(h("div", { class: "card" }, [h("div", { class: "muted", text: [billetName(x.billet_id), unitName(x.unit_id), "Status: " + x.status].filter(Boolean).join(" / ") }),
      h("div", { class: "muted", text: "Discord ID " + x.discord_id })]));
    m.appendChild(h("div", { class: "row" }, [h("a", { class: "btn primary", href: "#/new/counseling?s=" + x.discord_id, text: "New counseling" }), h("a", { class: "btn", href: "#/new/award?s=" + x.discord_id, text: "New award recommendation" })]));
    var d = await sb.from("documents").select("*").eq("soldier_id", id).order("updated_at", { ascending: false });
    m.appendChild(h("h2", { text: "Soldier file" })); m.appendChild(docTable(d.data || []));
    var hs = await sb.from("history").select("*").eq("subject_id", id).order("created_at", { ascending: false }).limit(200);
    if (hs.data && (role("s1") || role("commander") || role("admin"))) {
      m.appendChild(h("h2", { text: "History file" }));
      m.appendChild(hs.data.length ? h("table", {}, [h("tr", {}, ["When", "Action", "By"].map(function (z) { return h("th", { text: z }); }))].concat(hs.data.map(function (e) {
        return h("tr", {}, [h("td", { text: fmtDate(e.created_at) }), h("td", { text: e.action.replace(/_/g, " ") }), h("td", { text: (e.actor_username || "") + " (" + (e.actor_roles || []).join(", ") + ")" })]);
      }))) : h("p", { class: "muted", text: "No entries yet." }));
    }
  }

  // ---------- New / edit form ----------
  var AUTO = { unit: 1, soldier_rank: 1, soldier_name: 1, soldier_discord_id: 1, counselor_rank: 1, counselor_name: 1, counselor_position: 1, fll_rank: 1, fll_name: 1, fll_position: 1 };
  function authored(kind) {
    var bar = 0, out = [];
    FORMS[kind].items.forEach(function (it) {
      if (it.k === "bar") { bar++; if (bar <= 3) out.push(it); return; }
      if (bar < 1 || bar > 3) return;
      if (it.k === "sub" && /SOLDIER BEING|PERSON COMPLETING|RECOMMENDING/.test(it.text)) return;
      if (it.k === "row") {
        var fs = it.fields.filter(function (f) { return !AUTO[f.n]; });
        if (!fs.length) return;
        it = Object.assign({}, it, { fields: fs });
      }
      out.push(it);
    });
    return out;
  }
  async function viewForm(kind, editId) {
    var m = $("#main"), vals = {}, soldier = (location.hash.match(/[?&]s=(\d+)/) || [])[1] || "", doc = null;
    if (editId) {
      var q = await sb.from("documents").select("*").eq("id", editId).maybeSingle(); doc = q.data;
      if (!doc || doc.status !== "draft") { m.appendChild(h("p", { class: "err", text: "Only your own drafts can be edited." })); return; }
      kind = doc.kind; vals = Object.assign({}, doc.values); soldier = doc.soldier_id;
    } else { FORMS[kind].items.forEach(function (it) { if (it.k === "row") it.fields.forEach(function (f) { if (f.today) vals[f.n] = today(); }); }); }
    m.appendChild(h("h1", { text: (editId ? "Edit " : "New ") + kindLabel(kind).toLowerCase() }));
    var people = (await sb.from("members").select("discord_id,username,rank_id,billet_id,unit_id").in("status", ["active", "on_loa"]).order("username")).data || [];
    people = people.filter(function (p) { return p.discord_id !== S.me.discord_id; });
    var sel = h("select", { disabled: editId ? true : null }, [h("option", { value: "", text: "Choose a soldier" })].concat(people.map(function (p) { return h("option", { value: p.discord_id, text: [rankName(p.rank_id), p.username].filter(Boolean).join(" ") + (p.unit_id ? "  (" + unitName(p.unit_id) + ")" : "") }); })));
    sel.value = soldier; sel.addEventListener("change", function () { soldier = sel.value; });
    m.appendChild(h("label", { class: "lab", text: "Soldier" })); m.appendChild(sel);
    var sec = null, form = h("div"); m.appendChild(form);
    authored(kind).forEach(function (it) {
      if (it.k === "bar") { form.appendChild(h("div", { class: "secbar", text: it.text.replace(/\s+/g, " ") })); return; }
      if (it.k === "sub" || it.k === "note" || it.k === "text") { form.appendChild(h("p", { class: "muted", text: it.text.replace(/\s+/g, " ") })); return; }
      if (it.k === "row") {
        form.appendChild(h("div", { class: "row" }, it.fields.map(function (f) {
          var ctl;
          if (f.n === "infraction_article") {
            ctl = h("select", { onchange: function () { vals[f.n] = ctl.value; } }, [h("option", { value: "", text: "Choose an article" })].concat(S.articles.map(function (a) { var v = a.article_no + " - " + a.title; return h("option", { value: v, text: v }); })).concat([h("option", { value: "Other", text: "Other (describe below)" })]));
            ctl.value = vals[f.n] || "";
          } else { ctl = h("input", { type: f.date ? "date" : "text", value: vals[f.n] || "", oninput: function () { vals[f.n] = ctl.value; } }); }
          return h("div", {}, [h("label", { class: "lab", text: f.l }), ctl]);
        })));
      } else if (it.k === "area") {
        var ta = h("textarea", { oninput: function () { vals[it.n] = ta.value; } }); ta.value = vals[it.n] || "";
        form.appendChild(h("div", {}, [h("label", { class: "lab", text: it.l }), ta]));
      } else if (it.k === "checks") {
        form.appendChild(h("div", { class: "checks" }, it.items.map(function (c) {
          var cb = h("input", { type: "checkbox" }); cb.checked = !!vals[c[1]]; cb.addEventListener("change", function () { vals[c[1]] = cb.checked; });
          return h("label", { class: "chk" }, [cb, h("span", { text: c[0] })]);
        })));
      } else if (it.k === "other") {
        var cb2 = h("input", { type: "checkbox" }); cb2.checked = !!vals[it.cb]; cb2.addEventListener("change", function () { vals[it.cb] = cb2.checked; });
        var ti = h("input", { type: "text", value: vals[it.tn] || "", oninput: function () { vals[it.tn] = ti.value; } });
        form.appendChild(h("div", { class: "row" }, [h("label", { class: "chk" }, [cb2, h("span", { text: it.l })]), ti]));
      }
    });
    var msg = h("p", { class: "muted" });
    var save = function (submit) {
      return async function () {
        try {
          if (!soldier) throw new Error("Choose a soldier");
          var need = kind === "counseling" ? (vals.infraction_description || "").trim() : (vals.justification || "").trim();
          if (!need) throw new Error(kind === "counseling" ? "Describe the infraction" : "Describe the achievement");
          var p = people.find(function (x) { return x.discord_id === soldier; }) || {};
          var full = Object.assign({}, vals, kind === "counseling" ? {
            unit: unitName(p.unit_id), soldier_rank: rankName(p.rank_id), soldier_name: S.names[soldier], soldier_discord_id: soldier,
            counselor_rank: rankName(S.me.rank_id), counselor_name: S.me.username, counselor_position: billetName(S.me.billet_id)
          } : {
            unit: unitName(p.unit_id), soldier_rank: rankName(p.rank_id), soldier_name: S.names[soldier], soldier_discord_id: soldier,
            fll_rank: rankName(S.me.rank_id), fll_name: S.me.username, fll_position: billetName(S.me.billet_id)
          });
          var id;
          if (editId) { await rpc("rpc_update_draft", { p_id: editId, p_values: full }); id = editId; if (submit) await rpc("rpc_submit_document", { p_id: id }); }
          else id = await rpc("rpc_create_document", { p_kind: kind, p_soldier: soldier, p_values: full, p_submit: submit });
          toast(submit ? "Submitted" : "Draft saved"); location.hash = "#/doc/" + id;
        } catch (e) { fail(e); }
      };
    };
    m.appendChild(h("div", { class: "row", style: "margin-top:18px" }, [h("button", { text: "Save draft", onclick: save(false) }), h("button", { class: "primary", text: "Submit", onclick: save(true) })]));
    m.appendChild(msg);
  }

  // ---------- Document view and actions ----------
  function readOnly(d) {
    var dl = h("dl", { class: "ro" }), items = FORMS[d.kind].items, v = d.values;
    items.forEach(function (it) {
      if (it.k === "bar") dl.appendChild(h("div", { class: "secbar", text: it.text.replace(/\s+/g, " ") }));
      else if (it.k === "row") it.fields.forEach(function (f) { if (v[f.n]) { dl.appendChild(h("dt", { text: f.l })); dl.appendChild(h("dd", { text: v[f.n] })); } });
      else if (it.k === "area") { if (v[it.n]) { dl.appendChild(h("dt", { text: it.l })); dl.appendChild(h("dd", { text: v[it.n] })); } }
      else if (it.k === "checks") { var on = it.items.filter(function (c) { return v[c[1]]; }).map(function (c) { return c[0]; }); if (on.length) { dl.appendChild(h("dt", { text: "Selected" })); dl.appendChild(h("dd", { text: on.join(", ") })); } }
      else if (it.k === "other") { if (v[it.tn]) { dl.appendChild(h("dt", { text: "Other" })); dl.appendChild(h("dd", { text: v[it.tn] })); } }
    });
    return dl;
  }
  async function viewDoc(id) {
    var m = $("#main");
    var q = await sb.from("documents").select("*").eq("id", id).maybeSingle(), d = q.data;
    if (!d) { m.appendChild(h("p", { class: "err", text: "Document not found or you cannot open it." })); return; }
    var back = function () { route(); };
    m.appendChild(h("h1", { text: kindLabel(d.kind) + ": " + nm(d.soldier_id) }));
    m.appendChild(h("div", { class: "row", style: "align-items:center" }, [statusPill(d),
      h("span", { class: "muted", text: "Written by " + nm(d.author_id) + ", " + fmtDate(d.created_at) }),
      d.status === "filed" ? h("span", { class: "pill " + (d.drive_status === "saved" ? "green" : "gold"), text: "Drive: " + d.drive_status }) : null]));
    var act = h("div", { class: "card" }); var any = false;
    var note = h("textarea", { placeholder: "Comment" });
    function btn(label, cls, fn) { any = true; return h("button", { class: cls || "", text: label, onclick: async function () { try { await fn(); back(); } catch (e) { fail(e); } } }); }
    if (d.status === "draft" && d.author_id === S.me.discord_id) {
      any = true; act.appendChild(h("div", { class: "row" }, [h("a", { class: "btn", href: "#/edit/" + d.id, text: "Edit draft" }), btn("Submit", "primary", function () { return rpc("rpc_submit_document", { p_id: d.id }); })]));
    }
    if (d.status === "submitted" && role("commander")) {
      any = true; act.appendChild(h("h2", { text: "Commander decision" })); act.appendChild(note);
      var opts = d.kind === "award" ? [["approved", "Approve"], ["approved_changes", "Approve with changes"], ["disapproved", "Disapprove"]] : [["approved", "Approve"], ["disapproved", "Disapprove"]];
      act.appendChild(h("div", { class: "row", style: "margin-top:10px" }, opts.map(function (o) { return btn(o[1], o[0] === "approved" ? "primary" : o[0] === "disapproved" ? "danger" : "", function () { return rpc("rpc_decide_document", { p_id: d.id, p_decision: o[0], p_comment: note.value }); }); })));
    }
    if (d.kind === "counseling" && d.status === "filed" && d.soldier_id === S.me.discord_id && !d.soldier_response) {
      any = true; act.appendChild(h("h2", { text: "Your response" })); act.appendChild(note);
      act.appendChild(h("div", { class: "row", style: "margin-top:10px" }, [
        btn("I acknowledge", "primary", function () { return rpc("rpc_soldier_response", { p_id: d.id, p_response: "acknowledged", p_note: note.value }); }),
        btn("I reject (comment required)", "danger", function () { return rpc("rpc_soldier_response", { p_id: d.id, p_response: "rejected", p_note: note.value }); })]));
    }
    if (d.soldier_response === "rejected" && !d.s1_decision && role("s1")) {
      any = true; act.appendChild(h("h2", { text: "S1 review" })); act.appendChild(h("p", { class: "muted", text: "The soldier's comment: " + (d.soldier_note || "") })); act.appendChild(note);
      act.appendChild(h("div", { class: "row", style: "margin-top:10px" }, [
        btn("Close with note", "", function () { return rpc("rpc_s1_review", { p_id: d.id, p_decision: "closed", p_note: note.value }); }),
        btn("Escalate to commander", "primary", function () { return rpc("rpc_s1_review", { p_id: d.id, p_decision: "escalated", p_note: note.value }); })]));
    }
    if (any) m.appendChild(act);
    if (d.soldier_response) m.appendChild(h("div", { class: "card", text: "Soldier response: " + d.soldier_response + (d.soldier_note ? " (" + d.soldier_note + ")" : "") + (d.s1_decision ? ". S1: " + d.s1_decision + (d.s1_note ? " (" + d.s1_note + ")" : "") : "") }));
    if (d.commander_decision) m.appendChild(h("div", { class: "card", text: "Commander " + nm(d.commander_id) + ": " + d.commander_decision.replace("_", " ") + (d.commander_comment ? " (" + d.commander_comment + ")" : "") }));
    if (d.status !== "draft") {
      m.appendChild(h("div", { class: "row", style: "margin:12px 0" }, [
        h("button", { text: "Download PDF", onclick: async function () { try { download(await pdfFor(d), kindLabel(d.kind).replace(/ /g, "_") + "_" + nm(d.soldier_id) + ".pdf"); } catch (e) { fail(e); } } }),
        d.status === "filed" && d.drive_status !== "saved" ? h("button", { text: "Save to Google Drive", onclick: async function () { toast((await driveSave(d)) ? "Saved to Drive" : "Drive save failed", false); back(); } }) : null]));
    }
    m.appendChild(readOnly(d));
    if (d.status === "filed" && d.drive_status !== "saved" && d.drive_status !== "none") { driveSave(d).then(function (ok) { if (ok) toast("Saved to Google Drive"); }); }
  }

  // ---------- Admin ----------
  var TABS = [["members", "Members"], ["units", "Units"], ["ranks", "Ranks"], ["billets", "Billets"], ["articles", "Infraction list"], ["roles", "Discord roles"], ["settings", "Settings"], ["audit", "Change log"]];
  var SITE_ROLES = ["soldier", "fll", "s1", "recruiter", "instructor", "commander", "admin"];
  var SETTING_KEYS = [["guild_id", "Discord server ID"], ["channel_command", "Command channel ID (fallback for posts)"], ["channel_counselings", "Counselings channel ID"], ["channel_awards", "Awards channel ID"], ["channel_admin", "Admin alerts channel ID"], ["site_url", "Site address (used in Discord posts)"]];

  function opt(list, label, valueKey, textFn, blank) {
    var s = h("select", {}, (blank ? [h("option", { value: "", text: blank })] : []).concat(list.map(function (x) { return h("option", { value: x[valueKey], text: textFn(x) }); })));
    return s;
  }
  function nullable(v) { return v === "" || v === undefined ? null : v; }
  function intOrNull(v) { return v === "" || v === null || v === undefined ? null : parseInt(v, 10); }

  async function viewAdmin(tab) {
    var m = $("#main");
    if (!role("admin")) { m.appendChild(h("p", { class: "err", text: "Administrators only." })); return; }
    m.appendChild(h("h1", { text: "Admin" }));
    m.appendChild(h("div", { class: "tabs" }, TABS.map(function (t) { return h("button", { class: tab === t[0] ? "on" : "", text: t[1], onclick: function () { location.hash = "#/admin/" + t[0]; } }); })));
    var box = h("div"); m.appendChild(box);
    var reload = async function () { await loadLists(); route(); };
    var run = function (fn) { return async function () { try { await fn(); await reload(); } catch (e) { fail(e); } }; };

    if (tab === "members") {
      var all = (await sb.from("members").select("*").order("username")).data || [];
      var f = h("input", { placeholder: "Search by username" }); box.appendChild(f);
      var list = h("div"); box.appendChild(list);
      var drawM = function () {
        list.textContent = "";
        all.filter(function (x) { return !f.value || x.username.toLowerCase().indexOf(f.value.toLowerCase()) >= 0; }).forEach(function (x) {
          var rk = opt(S.ranks, "Rank", "id", function (r) { return r.abbr + " - " + r.name; }, "No rank"); rk.value = x.rank_id || "";
          var bl = opt(S.billets, "Billet", "id", function (b) { return b.name; }, "No billet"); bl.value = x.billet_id || "";
          var un = opt(S.units, "Unit", "id", function (u) { return u.name; }, "No unit"); un.value = x.unit_id || "";
          var st = h("select", {}, ["active", "on_loa", "discharged", "blacklisted", "denied", "applicant"].map(function (s) { return h("option", { value: s, text: s }); })); st.value = x.status;
          var rolesBox = h("div", { class: "checks" }, SITE_ROLES.map(function (r) { var c = h("input", { type: "checkbox", "data-r": r }); c.checked = x.site_roles.indexOf(r) >= 0; return h("label", { class: "chk" }, [c, h("span", { text: r })]); }));
          list.appendChild(h("div", { class: "card" }, [h("strong", { text: x.username }), h("span", { class: "muted", text: "  " + x.discord_id }),
            h("div", { class: "row" }, [rk, bl, un, st]), rolesBox,
            h("button", { class: "primary", text: "Save", onclick: run(function () {
              var roles = Array.prototype.map.call(rolesBox.querySelectorAll("input:checked"), function (c) { return c.getAttribute("data-r"); });
              if (roles.indexOf("soldier") < 0) roles.push("soldier");
              return rpc("rpc_set_member", { p_discord: x.discord_id, p_rank: intOrNull(rk.value), p_billet: intOrNull(bl.value), p_unit: intOrNull(un.value), p_status: st.value, p_roles: roles });
            }) })]));
        });
      };
      f.addEventListener("input", drawM); drawM();
      box.appendChild(h("p", { class: "muted", text: "Members appear here after their first sign-in. Rank, billet, and unit changes are logged to the member's history file." }));
      return;
    }

    if (tab === "units" || tab === "ranks" || tab === "billets" || tab === "articles") {
      var cfg = {
        units: { table: "units", cols: [["name", "Name"], ["parent_id", "Parent unit", "unit"], ["channel_counselings", "Unit counselings channel ID"], ["channel_awards", "Unit awards channel ID"], ["channel_command", "Unit command channel ID"], ["channel_admin", "Unit admin alerts channel ID"]], rows: (await sb.from("units").select("*").order("name")).data },
        ranks: { table: "ranks", cols: [["name", "Name"], ["abbr", "Abbreviation"], ["sort", "Order (higher is senior)", "int"], ["discord_role_id", "Discord role ID"]], rows: (await sb.from("ranks").select("*").order("sort")).data },
        billets: { table: "billets", cols: [["name", "Name"], ["unit_id", "Unit", "unit"], ["discord_role_id", "Discord role ID"]], rows: (await sb.from("billets").select("*").order("name")).data },
        articles: { table: "infraction_articles", cols: [["article_no", "Article"], ["title", "Title"], ["body", "Description"]], rows: (await sb.from("infraction_articles").select("*").order("article_no")).data }
      }[tab];
      var unitSel = function (v) { var s = opt(S.units, "Unit", "id", function (u) { return u.name; }, "None"); s.value = v || ""; return s; };
      var fieldFor = function (c, v) {
        if (c[2] === "unit") return unitSel(v);
        var i = h("input", { type: c[2] === "int" ? "number" : "text", value: v === null || v === undefined ? "" : String(v) }); return i;
      };
      var collect = function (ctls) {
        var o = {}; cfg.cols.forEach(function (c) { var v = ctls[c[0]].value; o[c[0]] = c[2] === "int" ? intOrNull(v) : c[2] === "unit" ? intOrNull(v) : (c[0] === "body" ? v : nullable(v)); });
        if (o.name === null || o.abbr === null || o.title === null || o.article_no === null) throw new Error("Fill in the required fields");
        return o;
      };
      var add = {}, addRow = h("div", { class: "row" }, cfg.cols.map(function (c) { add[c[0]] = fieldFor(c, ""); return h("div", {}, [h("label", { class: "lab", text: c[1] }), add[c[0]]]); }));
      box.appendChild(h("div", { class: "card" }, [h("strong", { text: "Add new" }), addRow, h("button", { class: "primary", style: "margin-top:10px", text: "Add", onclick: run(async function () { var r = await sb.from(cfg.table).insert(collect(add)); if (r.error) throw new Error(r.error.message); }) })]));
      (cfg.rows || []).forEach(function (row) {
        var ctls = {}, line = h("div", { class: "row" }, cfg.cols.map(function (c) { ctls[c[0]] = fieldFor(c, row[c[0]]); return h("div", {}, [h("label", { class: "lab", text: c[1] }), ctls[c[0]]]); }));
        box.appendChild(h("div", { class: "card" }, [line, h("div", { class: "row", style: "margin-top:10px" }, [
          h("button", { text: "Save", onclick: run(async function () { var r = await sb.from(cfg.table).update(collect(ctls)).eq("id", row.id); if (r.error) throw new Error(r.error.message); }) }),
          h("button", { class: row.retired ? "" : "danger", text: row.retired ? "Restore" : "Retire", onclick: run(async function () { var r = await sb.from(cfg.table).update({ retired: !row.retired }).eq("id", row.id); if (r.error) throw new Error(r.error.message); }) }),
          row.retired ? h("span", { class: "pill red", text: "Retired" }) : null])]));
      });
      box.appendChild(h("p", { class: "muted", text: "Entries are retired, never deleted, so older documents keep their meaning." + (tab === "articles" ? " Edit the five starter articles to match your real infraction list." : "") }));
      return;
    }

    if (tab === "roles") {
      var map = (await sb.from("role_map").select("*")).data || [];
      var rid = h("input", { placeholder: "Discord role ID" }), rs = h("select", {}, SITE_ROLES.map(function (r) { return h("option", { value: r, text: r }); }));
      box.appendChild(h("p", { class: "muted", text: "Link a Discord role to a site role. Use Discord Developer Mode, then right-click a role and choose Copy Role ID." }));
      box.appendChild(h("div", { class: "card" }, [h("div", { class: "row" }, [rid, rs]), h("button", { class: "primary", style: "margin-top:10px", text: "Add link", onclick: run(async function () { if (!rid.value.trim()) throw new Error("Enter a role ID"); var r = await sb.from("role_map").upsert({ discord_role_id: rid.value.trim(), site_role: rs.value }); if (r.error) throw new Error(r.error.message); }) })]));
      map.forEach(function (x) { box.appendChild(h("div", { class: "card row", style: "align-items:center" }, [h("span", { text: x.discord_role_id }), h("strong", { text: x.site_role }), h("button", { class: "danger", text: "Remove", onclick: run(async function () { var r = await sb.from("role_map").delete().eq("discord_role_id", x.discord_role_id); if (r.error) throw new Error(r.error.message); }) })])); });
      return;
    }

    if (tab === "settings") {
      var cur = {}; ((await sb.from("settings").select("*")).data || []).forEach(function (r) { cur[r.key] = r.value; });
      var ins = {};
      SETTING_KEYS.forEach(function (k) { ins[k[0]] = h("input", { value: cur[k[0]] || "" }); box.appendChild(h("div", {}, [h("label", { class: "lab", text: k[1] }), ins[k[0]]])); });
      box.appendChild(h("button", { class: "primary", style: "margin-top:14px", text: "Save settings", onclick: run(async function () { var rows = SETTING_KEYS.map(function (k) { return { key: k[0], value: ins[k[0]].value.trim() }; }); var r = await sb.from("settings").upsert(rows); if (r.error) throw new Error(r.error.message); toast("Saved"); }) }));
      box.appendChild(h("div", { class: "card", style: "margin-top:16px" }, [h("strong", { text: "Discord slash commands" }), h("p", { class: "muted", text: "Register /roster in your server after the Discord application is connected." }),
        h("button", { text: "Register slash commands", onclick: async function () { try { var r = await fetch(C.functions + "/register-commands", { method: "POST", headers: { Authorization: "Bearer " + S.session.access_token } }); var b = await r.json(); toast(b.ok ? "Commands registered" : (b.error || "Failed: " + JSON.stringify(b.body)), !b.ok); } catch (e) { fail(e); } } })]));
      return;
    }

    if (tab === "audit") {
      var a = (await sb.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200)).data || [];
      box.appendChild(a.length ? h("table", {}, [h("tr", {}, ["When", "Table", "Change", "By"].map(function (z) { return h("th", { text: z }); }))].concat(a.map(function (e) {
        var rd = e.row_data || {};
        return h("tr", {}, [h("td", { text: fmtDate(e.created_at) }), h("td", { text: e.table_name }), h("td", { text: e.op + " " + (rd.name || rd.title || rd.key || rd.discord_role_id || "") }), h("td", { text: nm(e.actor_id) })]);
      }))) : h("p", { class: "muted", text: "No changes yet." }));
    }
  }

  boot();
})();
