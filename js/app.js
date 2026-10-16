/* 패스메이트 v2 — 자격증 합격 공부 파트너 (HAE)
   화면: 로그인 → 자격증 고르기 → 홈 / 공부(기출 풀기·요약정리·오답노트·시험 기록·내 문제) / 일정 / 오답 / 이력 */
(function () {
  "use strict";
  var C = window.PM_CATALOG, P = window.PM_PACKS || {}, ST = window.PM_STORE;
  var M = null;                 // 내 기본 기록 (main)
  var view = "home";
  var studyCert = null, studyTab = "gichul";
  var session = null;           // 문제 풀이 진행
  var timerId = null;
  var booting = true;
  var ui = { sumSubj: 0, sumQ: "", sumHot: false, pickSubj: 0, pickCount: "20", pickFilter: "all", pickMode: "instant",
    wrongCert: "", wrongShow: "open", wrongLimit: 50, schedMine: true, openTopic: {}, sumLimit: 20, loginId: "", authTab: null, cloudHas: null, pendingProfile: null, creating: false, onboard: null };

  /* ---------- 유틸 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid(p) { return (p || "id") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function todayNum() { return +today().replace(/-/g, ""); }
  function parseYmd(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
  function dday(date) { var n = daysBetween(today(), date); return n === 0 ? "D-DAY" : n > 0 ? "D-" + n : "D+" + (-n); }
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  function fmtDate(s, wd) { if (!s) return ""; var d = parseYmd(s); return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()) + (wd ? " (" + WD[d.getDay()] + ")" : ""); }
  function fmtShort(s) { if (!s) return ""; var d = parseYmd(s); return (d.getMonth() + 1) + "/" + d.getDate() + "(" + WD[d.getDay()] + ")"; }
  function range(a, b) { return !b || a === b ? fmtShort(a) : fmtShort(a) + " ~ " + fmtShort(b); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ":" : "") + pad(m) + ":" + pad(s); }
  function fmtMin(m) { m = Math.round(m); var h = Math.floor(m / 60), r = m % 60; return h ? h + "시간" + (r ? " " + r + "분" : "") : r + "분"; }
  var CIRCLE = ["①", "②", "③", "④", "⑤"];

  var toastT;
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2400); }
  ST.onError = toast;

  function openModal(title, html, mount) {
    $("#modal-title").textContent = title; $("#modal-body").innerHTML = html; $("#modal").hidden = false;
    if (mount) mount($("#modal-body"));
    var f = $("#modal-body input:not([type=checkbox]), #modal-body select, #modal-body textarea"); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeModal() { $("#modal").hidden = true; $("#modal-body").innerHTML = ""; }
  function fld(label, input, cls) { var id = (input.match(/id="([^"]+)"/) || [])[1] || ""; return '<div class="field ' + (cls || "") + '"><label for="' + id + '">' + label + "</label>" + input + "</div>"; }

  /* ---------- 내 데이터 ---------- */
  function defaultMain() { return { v: 2, setup: false, profile: { name: ST.user && ST.user.name || "", intro: "" }, certs: [], exams: [], attempts: [], logs: [], solved: [] }; }
  function save() { ST.save("main"); }
  function customList() { return ST.get("custom", { list: [] }).list; }
  function notes() { return ST.get("notes", {}); }
  function ansMap(pack) { return ST.get("ans-" + pack, {}); }
  function catalogCert(id) { for (var i = 0; i < C.certs.length; i++) if (C.certs[i].id === id) return C.certs[i]; return null; }
  function myEntry(id) { for (var i = 0; i < M.certs.length; i++) if (M.certs[i].id === id) return M.certs[i]; return null; }
  function cert(id) {
    var e = myEntry(id), base = catalogCert(id) || (e && e.def) || null;
    if (!base) return null;
    var c = clone(base);
    if (e) { c.goal = e.goal || ""; c.license = e.license || null; if (e.stages) c.stages = e.stages; }
    return c;
  }
  function myCertIds() { return M.certs.map(function (e) { return e.id; }); }
  function certShort(id) { var c = cert(id) || catalogCert(id); return c ? c.short || c.name : "삭제된 자격증"; }
  function certColor(id) { var c = cert(id) || catalogCert(id); return c ? c.color : "#888"; }
  function dot(id) { return '<span class="dot" style="background:' + esc(certColor(id)) + '"></span>'; }
  function packOf(id) { var c = cert(id); return c && c.pack ? P[c.pack] : null; }
  function subjectsOf(id) {
    var p = packOf(id);
    if (p && p.ready) return p.subjects;
    var c = cert(id); var subs = c ? c.stages[0].subjects : [];
    return [""].concat(subs.length ? subs : ["기타"]);
  }
  function customFor(id) {
    return customList().filter(function (q) { return q.certId === id; }).map(function (q) { var o = clone(q); o.pack = "my"; o.set = q.src || "내 문제"; return o; });
  }
  function questionsOf(id) { var p = packOf(id); return (p && p.ready ? p.questions : []).concat(customFor(id)); }
  function qById(pack, id) {
    if (pack === "my") { var l = customList(); for (var i = 0; i < l.length; i++) if (l[i].id === id) { var o = clone(l[i]); o.pack = "my"; o.set = l[i].src || "내 문제"; return o; } return null; }
    var p = P[pack]; return p && p.ready ? p.byId[id] || null : null;
  }
  function certOfQ(q) { if (q.pack === "my") return q.certId; for (var i = 0; i < C.certs.length; i++) if (C.certs[i].pack === q.pack) return C.certs[i].id; return ""; }

  function record(q, pick) {
    var m = ansMap(q.pack), r = m[q.id] || [0, 0, 0, 0], ok = pick === q.a;
    if (ok) { r[1]++; r[2] = 1; } else { r[0]++; r[2] = 0; }
    r[3] = todayNum(); m[q.id] = r; ST.save("ans-" + q.pack);
    return ok;
  }
  function ansOf(q) { return ansMap(q.pack)[q.id] || null; }
  function isOpenWrong(q) { var r = ansOf(q); return !!(r && r[0] > 0 && r[2] === 0); }
  function wasWrong(q) { var r = ansOf(q); return !!(r && r[0] > 0); }
  function certStats(id) {
    var qs = questionsOf(id), done = 0, ok = 0, open = 0;
    qs.forEach(function (q) { var r = ansOf(q); if (r) { done++; if (r[2] === 1) ok++; if (r[0] > 0 && r[2] === 0) open++; } });
    return { total: qs.length, done: done, rate: done ? Math.round(ok / done * 100) : null, open: open };
  }

  /* ---------- 합격 판정 ---------- */
  function evalAttempt(a) {
    var c = cert(a.certId); if (!c) return { total: 0, pass: false, under: [], subjects: [] };
    var st = c.stages.filter(function (s) { return s.name === a.stage; })[0] || c.stages[0];
    var subs = st.subjects.length ? st.subjects : ["총점"];
    var w = st.weights && st.weights.length === subs.length ? st.weights : subs.map(function () { return 1; });
    var sum = 0, sw = 0, under = [];
    subs.forEach(function (s, i) { var v = +a.scores[i] || 0; sum += v * w[i]; sw += w[i]; if (st.subjMin && v < st.subjMin) under.push(i); });
    var total = round1(sum / sw);
    var grade = st.grades ? (st.grades.filter(function (g) { return total >= g[0]; })[0] || [0, ""])[1] : "";
    return { total: total, pass: under.length === 0 && total >= st.passMin, under: under, subjects: subs, stage: st, grade: grade };
  }
  function certAttempts(id) { return M.attempts.filter(function (a) { return a.certId === id; }).sort(function (x, y) { return x.date < y.date ? 1 : -1; }); }
  function certStatus(id) {
    var c = cert(id); if (!c) return { key: "gray", label: "", steps: [] };
    var passed = {}, atts = certAttempts(id);
    atts.forEach(function (a) { if (evalAttempt(a).pass) passed[a.stage] = a.date; });
    var last = c.stages[c.stages.length - 1].name;
    var steps = c.stages.map(function (s) { return !!passed[s.name] || !!c.license; });
    if (c.license || passed[last]) return { key: "pass", label: "최종 합격", steps: steps, date: (c.license && c.license.date) || passed[last] };
    for (var i = c.stages.length - 1; i >= 0; i--) if (passed[c.stages[i].name]) return { key: "half", label: c.stages[i].name + " 합격", steps: steps };
    if (atts.length) return { key: "prep", label: "도전 " + atts.length + "회", steps: steps };
    return { key: "gray", label: "준비 중", steps: steps };
  }
  function diffMeter(d, withLabel) {
    if (!d) return "";
    if (!d.level) return '<span class="diff-text muted">' + esc(d.label) + "</span>";
    var dots = ""; for (var i = 1; i <= 5; i++) dots += "<i" + (i <= d.level ? ' class="on"' : "") + "></i>";
    return '<span class="diff lv' + d.level + '" role="img" aria-label="난이도 5단계 중 ' + d.level + " · " + esc(d.label) + '">' + dots + "</span>" + (withLabel ? '<span class="diff-text">' + esc(d.label) + "</span>" : "");
  }
  function diffBox(c) {
    var d = c.diff; if (!d) return "";
    return '<section class="diff-box"><div class="diff-head"><span class="eyebrow">난이도</span>' + diffMeter(d, true) + "</div>" +
      (d.rates.length ? '<div class="rate-row">' + d.rates.map(function (r) { return '<div class="rate"><span class="small muted">' + esc(r[0]) + ' 합격률</span><b class="num">' + esc(r[1]) + '</b><span class="small muted">' + esc(r[2]) + "</span></div>"; }).join("") + "</div>" : "") +
      '<p class="small">' + esc(d.tip) + "</p>" + (d.src ? '<p class="tiny muted">' + esc(d.src) + "</p>" : "") + "</section>";
  }
  function pill(st) { return '<span class="pill ' + st.key + '">' + esc(st.label) + "</span>"; }

  /* ---------- 공식 일정 ---------- */
  function schedStatus(e) {
    var t = today();
    if (e.always) return { key: "open", label: "상시 접수", open: true };
    if (e.est) return { key: "gray", label: "공고 전" };
    var examEnd = e.exam ? e.exam[1] : null;
    if (e.reg) {
      if (t < e.reg[0]) return { key: "soon", label: "접수 " + dday(e.reg[0]), soon: daysBetween(t, e.reg[0]) };
      if (t <= e.reg[1]) { var n = daysBetween(t, e.reg[1]); return { key: "open", label: "접수 중 · " + (n ? n + "일 남음" : "오늘 마감"), open: true }; }
    }
    if (examEnd && t <= examEnd) return { key: "exam", label: t >= e.exam[0] ? "시험 기간" : "시험 " + dday(e.exam[0]) };
    if (e.result && t <= e.result) return { key: "gray", label: "발표 " + dday(e.result) };
    return { key: "done", label: "종료", ended: true };
  }
  function schedFor(ids) { return C.SCHEDULE.filter(function (e) { return !ids || e.certs.some(function (c) { return ids.indexOf(c) > -1; }); }); }
  function schedSortKey(e) { return e.always ? "0000" : (e.reg ? e.reg[0] : e.exam ? e.exam[0] : e.sortDate || "9999"); }
  function siteOf(e) { return C.sites[e.site] || { name: "", url: "#" }; }

  /* ================================================================
     로그인
     ================================================================ */
  function renderLogin() {
    if (ST.mode === "firebase" || ST.mode === "fberror") return renderFbLogin();
    var cloud = ST.mode === "cloud", profiles = cloud ? [] : ST.profiles();
    if (!ui.authTab) ui.authTab = cloud ? (ui.cloudHas === false ? "signup" : "login") : (profiles.length ? "login" : "signup");
    var tab = ui.authTab;
    var h = '<div class="login"><div class="login-hero"><div class="brand big"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-name">패스메이트</span></div>' +
      '<p class="login-sub">기출 풀기 · 요약정리 · 오답노트 · 시험 일정까지<br>모든 자격증 합격을 같이 준비해요.</p></div>';
    h += '<section class="card login-card stack"><div class="auth-tabs" role="tablist"><button role="tab" aria-selected="' + (tab === "login") + '" class="' + (tab === "login" ? "on" : "") + '" data-act="auth-tab" data-tab="login">로그인</button>' +
      '<button role="tab" aria-selected="' + (tab === "signup") + '" class="' + (tab === "signup" ? "on" : "") + '" data-act="auth-tab" data-tab="signup">회원가입</button></div>';

    if (cloud) {
      var cu = ST.cloudUser || {};
      var acc = '<div class="profile-list one"><div class="profile-btn on"><span class="avatar">' + esc((cu.name || "나").slice(0, 1)) + "</span><span>" + esc(cu.name || "내 온라인 계정") + "</span></div></div>";
      if (ui.cloudHas == null) h += '<p class="small muted center">계정을 확인하는 중…</p>';
      else if (tab === "login") {
        h += ui.cloudHas
          ? acc + '<button class="btn primary block" data-act="cloud-login">이 계정으로 로그인</button>'
          : '<div class="notice">이 계정은 아직 패스메이트에 가입하지 않았어요.</div><button class="btn primary block" data-act="auth-tab" data-tab="signup">회원가입하러 가기</button>';
      } else {
        h += ui.cloudHas
          ? '<div class="notice">이 계정은 이미 가입돼 있어요. 로그인하면 기존 기록이 그대로 열려요.</div><button class="btn primary block" data-act="auth-tab" data-tab="login">로그인하러 가기</button>'
          : acc + '<form id="f-csign" class="stack">' + fld("닉네임", '<input id="cs-nick" required maxlength="20" autocomplete="nickname" value="' + esc(cu.name || "") + '" placeholder="앱에서 부를 이름">') +
            fld("한 줄 소개 (선택)", '<input id="cs-intro" maxlength="60" placeholder="예: 건축공학 복수전공, 자격증 모으는 중">') +
            '<label class="check"><input type="checkbox" id="cs-agree" required> 공부 기록을 이 계정에 저장하는 데 동의해요</label>' +
            '<p class="form-err" id="cs-err" hidden></p><button class="btn primary block">가입하고 시작하기</button></form>';
      }
      h += '<p class="small muted login-note">지금 접속한 온라인 계정으로 가입·로그인해요. 다른 기기에서 같은 링크로 열어도 같은 기록이 보이고, 다른 사람이 이 링크를 열면 그 사람 기록만 따로 보여요.</p>' + guestNote() + '</section></div>';
      return h;
    }

    if (tab === "login") {
      if (!profiles.length) h += '<div class="notice">이 기기에 가입된 계정이 없어요. 먼저 회원가입해 주세요.</div><button class="btn primary block" data-act="auth-tab" data-tab="signup">회원가입하러 가기</button>';
      else {
        h += '<div class="stack tight"><span class="small muted">이 기기에 가입된 계정</span><div class="profile-list">' + profiles.map(function (p) {
          return '<button type="button" class="profile-btn' + (ui.loginId === p.name ? " on" : "") + '" data-act="login-fill" data-name="' + esc(p.name) + '"><span class="avatar">' + esc(p.name.slice(0, 1)) + "</span><span>" + esc(p.name) + "</span></button>";
        }).join("") + "</div></div>" +
          '<form id="f-login" class="stack">' + fld("아이디", '<input id="lg-id" required maxlength="20" autocomplete="username" value="' + esc(ui.loginId || "") + '">') +
          fld("비밀번호", '<input id="lg-pw" type="password" autocomplete="current-password" maxlength="20" required>') +
          '<label class="check"><input type="checkbox" id="lg-remember"> 로그인 상태 유지</label>' +
          '<p class="form-err" id="lg-err" hidden></p><button class="btn primary block">로그인</button></form>';
      }
    } else {
      h += '<form id="f-new" class="stack">' + fld("아이디", '<input id="nw-id" required maxlength="20" autocomplete="username" placeholder="로그인할 때 쓸 이름 (예: hae)">') +
        fld("비밀번호 (4~20자)", '<input id="nw-pw" type="password" autocomplete="new-password" maxlength="20" required>') +
        fld("비밀번호 확인", '<input id="nw-pw2" type="password" autocomplete="new-password" maxlength="20" required>') +
        fld("닉네임 (선택)", '<input id="nw-nick" maxlength="20" autocomplete="nickname" placeholder="앱에서 부를 이름, 비우면 아이디로">') +
        '<label class="check"><input type="checkbox" id="nw-agree" required> 기록이 이 기기의 브라우저에 저장된다는 걸 확인했어요</label>' +
        '<label class="check"><input type="checkbox" id="nw-remember" checked> 로그인 상태 유지</label>' +
        '<p class="form-err" id="nw-err" hidden></p><button class="btn primary block">가입하고 시작하기</button></form>';
    }
    h += '<p class="small muted login-note">GitHub·내 컴퓨터에서 열면 계정이 이 기기 브라우저에만 저장돼요. 비밀번호는 같은 기기를 쓰는 사람끼리 기록을 나누는 잠금이라, 중요한 비밀번호는 쓰지 마세요. 다른 기기로 옮길 때는 [이력 → 백업]을 써 주세요.</p>' + guestNote() + '</section></div>';
    return h;
  }
  function guestNote() { return '<button class="btn ghost block guest-btn" data-act="guest">가입 없이 게스트로 둘러보기</button><p class="tiny muted center">게스트는 기록이 이 기기에만 잠시 저장되고, 요약본·벼락치기는 쓸 수 없어요.</p>'; }
  function loginHero() {
    return '<div class="login-hero"><div class="brand big"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-name">패스메이트</span></div>' +
      '<p class="login-sub">기출 풀기 · 요약정리 · 오답노트 · 시험 일정까지<br>모든 자격증 합격을 같이 준비해요.</p></div>';
  }
  function renderFbLogin() {
    var h = '<div class="login">' + loginHero() + '<section class="card login-card stack">';
    if (ST.mode === "fberror") {
      return h + '<div class="notice warn">온라인 저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.</div><button class="btn primary block" data-act="reload">다시 연결</button></section></div>';
    }
    var tab = ui.authTab || "login";
    h += '<div class="auth-tabs" role="tablist"><button role="tab" aria-selected="' + (tab === "login") + '" class="' + (tab === "login" ? "on" : "") + '" data-act="auth-tab" data-tab="login">로그인</button>' +
      '<button role="tab" aria-selected="' + (tab === "signup") + '" class="' + (tab === "signup" ? "on" : "") + '" data-act="auth-tab" data-tab="signup">회원가입</button></div>';
    if (tab === "login") {
      h += '<form id="f-fblogin" class="stack">' + fld("이메일", '<input id="fl-email" type="email" required autocomplete="email" value="' + esc(ui.loginId || "") + '">') +
        fld("비밀번호", '<input id="fl-pw" type="password" required autocomplete="current-password">') +
        '<label class="check"><input type="checkbox" id="fl-remember" checked> 로그인 상태 유지</label>' +
        '<p class="form-err" id="fl-err" hidden></p><button class="btn primary block">로그인</button></form>' +
        '<button class="btn ghost block" data-act="fb-reset">비밀번호를 잊었어요</button>';
    } else {
      h += '<form id="f-fbsign" class="stack">' + fld("이메일", '<input id="fs-email" type="email" required autocomplete="email" placeholder="로그인 아이디로 써요">') +
        fld("비밀번호 (6자 이상)", '<input id="fs-pw" type="password" required minlength="6" autocomplete="new-password">') +
        fld("비밀번호 확인", '<input id="fs-pw2" type="password" required autocomplete="new-password">') +
        fld("닉네임", '<input id="fs-nick" required maxlength="20" autocomplete="nickname" placeholder="앱에서 부를 이름">') +
        '<label class="check"><input type="checkbox" id="fs-agree" required> 공부 기록을 온라인 저장소(Firebase)에 저장하는 데 동의해요</label>' +
        '<label class="check"><input type="checkbox" id="fs-remember" checked> 로그인 상태 유지</label>' +
        '<p class="form-err" id="fs-err" hidden></p><button class="btn primary block">가입하고 시작하기</button></form>';
    }
    return h + '<p class="small muted login-note">이메일로 가입하면 폰·PC 어디서 이 링크를 열어 로그인해도 같은 기록이 보여요.</p>' + guestNote() + '</section></div>';
  }
  function busy(form, on) { var b = form.querySelector("button.primary"); if (b) { b.disabled = on; b.dataset.label = b.dataset.label || b.textContent; b.textContent = on ? "잠시만요…" : b.dataset.label; } }
  function bindLogin() {
    var fl = $("#f-fblogin");
    if (fl) fl.onsubmit = function (e) {
      e.preventDefault(); var er = $("#fl-err"); busy(fl, true);
      ST.fbLogin($("#fl-email").value.trim(), $("#fl-pw").value, $("#fl-remember").checked).then(function (r) {
        if (!r.ok) { busy(fl, false); er.textContent = r.msg; er.hidden = false; return; }
        afterLogin();
      });
    };
    var fs = $("#f-fbsign");
    if (fs) fs.onsubmit = function (e) {
      e.preventDefault(); var er = $("#fs-err");
      function bad(m) { er.textContent = m; er.hidden = false; }
      var pw = $("#fs-pw").value, nick = $("#fs-nick").value.trim();
      if (pw.length < 6) return bad("비밀번호는 6자 이상으로 정해 주세요");
      if (pw !== $("#fs-pw2").value) return bad("비밀번호 확인이 서로 달라요");
      if (!nick) return bad("닉네임을 입력해 주세요");
      if (!$("#fs-agree").checked) return bad("저장 동의에 체크해 주세요");
      busy(fs, true);
      ST.fbSignup($("#fs-email").value.trim(), pw, nick, $("#fs-remember").checked).then(function (r) {
        if (!r.ok) { busy(fs, false); return bad(r.msg); }
        ui.pendingProfile = { name: nick, intro: "" }; afterLogin(); toast("가입했어요! 준비할 자격증을 골라 주세요");
      });
    };
    var f = $("#f-login");
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var r = ST.loginByName($("#lg-id").value.trim(), $("#lg-pw").value, $("#lg-remember").checked);
      if (!r.ok) { var er = $("#lg-err"); er.textContent = r.msg; er.hidden = false; return; }
      afterLogin();
    };
    var n = $("#f-new");
    if (n) n.onsubmit = function (e) {
      e.preventDefault();
      var id = $("#nw-id").value.trim(), pw = $("#nw-pw").value, pw2 = $("#nw-pw2").value, er = $("#nw-err");
      function bad(m) { er.textContent = m; er.hidden = false; }
      if (!id) return bad("아이디를 입력해 주세요");
      if (pw.length < 4) return bad("비밀번호는 4자 이상으로 정해 주세요");
      if (pw !== pw2) return bad("비밀번호 확인이 서로 달라요");
      if (!$("#nw-agree").checked) return bad("저장 위치 안내에 동의해 주세요");
      var r = ST.createProfile(id, pw, $("#nw-remember").checked);
      if (!r.ok) return bad(r.msg === "같은 이름의 프로필이 이미 있어요" ? "이미 있는 아이디예요. 다른 아이디를 써 주세요" : r.msg);
      ui.pendingProfile = { name: $("#nw-nick").value.trim() || id, intro: "" };
      afterLogin(); toast("가입했어요! 준비할 자격증을 골라 주세요");
    };
    var c = $("#f-csign");
    if (c) c.onsubmit = function (e) {
      e.preventDefault();
      var nick = $("#cs-nick").value.trim(), er = $("#cs-err");
      if (!nick) { er.textContent = "닉네임을 입력해 주세요"; er.hidden = false; return; }
      if (!$("#cs-agree").checked) { er.textContent = "저장 동의에 체크해 주세요"; er.hidden = false; return; }
      ui.pendingProfile = { name: nick, intro: $("#cs-intro").value.trim() };
      ST.loginCloud(); afterLogin(); toast("가입했어요! 준비할 자격증을 골라 주세요");
    };
  }
  function afterLogin() {
    ST.loadAll().then(function () {
      M = ST.get("main", defaultMain());
      if (ui.pendingProfile) { M.profile.name = ui.pendingProfile.name; M.profile.intro = ui.pendingProfile.intro; ui.pendingProfile = null; save(); ui.cloudHas = true; }
      if (!M.profile.name && ST.user && ST.user.name) M.profile.name = ST.user.name;
      ui.authTab = null; ui.perm = null; ui.members = null; ui.myTab = null; view = "home"; render(); warmPacks();
      if (ST.membersOn()) { syncMember(); ST.myPerm().then(function (pm) { ui.perm = pm; render(); }); }
    });
  }
  function warmPacks() { // 내 자격증 문제를 미리 불러와 진도 계산
    M.certs.forEach(function (e) { var p = packOf(e.id); if (p && !p.ready) p.load().then(function () { if (!session) render(); }).catch(function () {}); });
  }

  /* ================================================================
     자격증 고르기 (처음 한 번)
     ================================================================ */
  function renderOnboard() {
    if (!ui.onboard) ui.onboard = myCertIds().length ? myCertIds() : [];
    var h = '<div class="page-head"><div><p class="eyebrow">' + esc(M.profile.name || "") + (M.profile.name ? "님 환영해요" : "환영해요") + '</p><h1>어떤 자격증을 준비해요?</h1><p>여러 개 골라도 돼요. 나중에 [공부 → 자격증 추가]에서 바꿀 수 있어요.</p></div></div>';
    var opts = C.certs.concat(Object.keys(M.hidden || {}).map(function (k) { return M.hidden[k].def; }).filter(Boolean)).concat(M.certs.filter(function (e) { return e.def; }).map(function (e) { return e.def; }));
    h += '<div class="grid cols" style="--cols:' + colsFor(opts.length) + '">' + opts.map(function (c) {
      var on = ui.onboard.indexOf(c.id) > -1, p = c.pack ? P[c.pack] : null;
      var what = c.pack === "comp1" ? "기출 2,322문제 · 요약 151주제" : c.pack === "arch" ? "기출 3,900문제 · 요약 44주제" : c.pack === "khist" ? "77회 기출 + 시대별 문제 · 시대별 정리" : c.pack === "adsp" ? "예상문제 · 과목별 요약" : "문제는 직접 추가 (붙여넣기 지원)";
      return '<button class="card pick-card' + (on ? " on" : "") + '" data-act="onb-toggle" data-id="' + c.id + '" aria-pressed="' + on + '"><span class="row">' + '<span class="dot" style="background:' + c.color + '"></span><b>' + esc(c.name) + '</b><span class="spacer"></span><span class="tick" aria-hidden="true"></span></span>' +
        '<span class="small muted">' + esc(c.org) + "</span><span class=\"small\">" + what + "</span>" +
        '<span class="pick-diff">' + diffMeter(c.diff, true) + (c.diff && c.diff.rates.length ? '<span class="small muted num">' + c.diff.rates.map(function (r) { return r[0].replace(/ \(.*\)/, "") + " " + r[1]; }).join(" · ") + "</span>" : c.diff ? '<span class="small muted">합격률은 큐넷에서 확인</span>' : "") + "</span></button>";
    }).join("") + "</div>";
    h += '<div class="row"><span class="small muted">' + ui.onboard.length + '개 선택</span><span class="spacer"></span><button class="btn" data-act="cert-custom">목록에 없는 자격증 추가</button><button class="btn primary" data-act="onb-done"' + (ui.onboard.length ? "" : " disabled") + ">시작하기</button></div>";
    return h;
  }

  /* ================================================================
     홈
     ================================================================ */
  function renderHome() {
    var ids = myCertIds();
    var h = '<div class="page-head"><div><p class="eyebrow">' + fmtDate(today(), true) + "</p><h1>" + (M.profile.name ? esc(M.profile.name) + "님, " : "") + "오늘도 한 칸씩 마킹해요</h1></div>" +
      '<div class="row">' + (isGuest() ? "" : attendedToday() ? '<span class="pill pass">✓ 오늘 출석</span>' : '<button class="btn primary" data-act="attend">출석 체크</button>') + '<button class="btn" data-act="log-add">＋ 공부 기록</button></div></div>';

    // 원서접수 알림
    var alerts = schedFor(ids).filter(function (e) { var s = schedStatus(e); return !e.always && (s.open || (s.soon != null && s.soon <= 21)); });
    if (alerts.length) h += '<section class="alerts">' + alerts.map(function (e) {
      var s = schedStatus(e), site = siteOf(e);
      return '<div class="alert ' + (s.open ? "open" : "") + '"><span class="pill ' + s.key + '">' + esc(s.label) + '</span><div class="grow"><b>' + esc(e.title) + '</b><span class="small muted"> 원서접수 ' + range(e.reg[0], e.reg[1]) + '</span></div><a class="btn sm ' + (s.open ? "omr" : "") + '" href="' + site.url + '" target="_blank" rel="noopener">원서 접수</a></div>';
    }).join("") + "</section>";

    h += '<div class="hero">' + ddayCard(ids) + statsCard() + "</div>";

    h += '<section class="section"><div class="section-head"><h2>내 자격증</h2><button class="btn sm ghost" data-act="certs-manage">자격증 추가·삭제</button></div><div class="grid cols" style="--cols:' + colsFor(ids.length) + '">' +
      ids.map(homeCertCard).join("") + "</div></section>";
    return h;
  }
  function ddayCard(ids) {
    var mine = M.exams.filter(function (e) { return e.date >= today() && !e.done; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var ex = mine[0], official = null;
    if (!ex) official = schedFor(ids).filter(function (e) { return e.exam && !e.est && e.exam[0] >= today(); }).sort(function (a, b) { return a.exam[0] < b.exam[0] ? -1 : 1; })[0];
    if (!ex && !official) return '<section class="card empty"><b>다가오는 시험이 없어요</b><span class="small">일정 탭에서 공식 일정을 보고 내 시험으로 추가해 보세요.</span><button class="btn primary" data-act="go" data-view="sched">시험 일정 보기</button></section>';
    var h = '<section class="card dday-card"><div class="bubbles" aria-hidden="true">' + bubbleDeco() + "</div>";
    if (ex) {
      h += '<p class="eyebrow">내 다음 시험</p><div class="dday">' + dday(ex.date) + '</div><div class="stack tight"><h2 class="h2">' + esc(certShort(ex.certId)) + " " + esc(ex.stage) + "</h2>" +
        '<p class="muted num small">' + fmtDate(ex.date, true) + (ex.time ? " · " + esc(ex.time) : "") + (ex.place ? " · " + esc(ex.place) : "") + "</p></div>" +
        '<div class="row"><button class="btn omr" data-act="study" data-id="' + ex.certId + '" data-tab="gichul">기출 풀기</button><button class="btn" data-act="attempt-add" data-exam="' + ex.id + '">결과 기록</button></div>';
    } else {
      h += '<p class="eyebrow">다가오는 공식 시험</p><div class="dday">' + dday(official.exam[0]) + '</div><div class="stack tight"><h2 class="h2">' + esc(official.title) + '</h2><p class="muted num small">시험 ' + range(official.exam[0], official.exam[1]) + "</p></div>" +
        '<div class="row"><button class="btn" data-act="sched-add" data-i="' + C.SCHEDULE.indexOf(official) + '">내 시험으로 추가</button></div>';
    }
    return h + "</section>";
  }
  function bubbleDeco() { var f = [1, 6, 8, 15], h = ""; for (var i = 0; i < 16; i++) h += "<i" + (f.indexOf(i) > -1 ? ' class="f"' : "") + "></i>"; return h; }
  function statsCard() {
    var todaySolved = M.solved.filter(function (s) { return s.date === today(); }).reduce(function (a, s) { return a + s.total; }, 0);
    var open = 0; myCertIds().forEach(function (id) { open += certStats(id).open; });
    return '<section class="card stats-card">' + stat(fmtMin(minutesSince(7)), "최근 7일 공부") + stat(studyStreak() + "일", "연속 공부") + stat(todaySolved + "문제", "오늘 푼 문제") + stat(open + "개", "남은 오답") +
      '<div class="stat full"><span>최근 14일 공부 시간</span>' + studyChart() + "</div></section>";
  }
  function colsFor(n) { return n <= 3 ? 3 : n === 4 ? 4 : n % 3 === 0 || n === 5 ? 3 : 4; } // 카드가 1~2개여도 한 장이 너무 넓어지지 않게
  function stat(v, l) { return '<div class="stat"><b>' + esc(v) + "</b><span>" + esc(l) + "</span></div>"; }
  function minutesSince(n) { var f = new Date(); f.setDate(f.getDate() - n + 1); var k = ymd(f); return M.logs.filter(function (l) { return l.date >= k; }).reduce(function (s, l) { return s + (+l.min || 0); }, 0); }
  function studyStreak() {
    var days = {}; M.logs.forEach(function (l) { days[l.date] = 1; }); M.solved.forEach(function (l) { days[l.date] = 1; });
    var d = new Date(), n = 0; if (!days[ymd(d)]) d.setDate(d.getDate() - 1);
    while (days[ymd(d)]) { n++; d.setDate(d.getDate() - 1); } return n;
  }
  function studyChart() {
    var days = [], max = 30;
    for (var i = 13; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var k = ymd(d); var m = M.logs.filter(function (l) { return l.date === k; }).reduce(function (s, l) { return s + (+l.min || 0); }, 0); days.push({ k: k, m: m, d: d }); if (m > max) max = m; }
    max = Math.ceil(max / 30) * 30;
    var W = 280, H = 110, top = 10, bottom = 18, bw = W / 14;
    var svg = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="최근 14일 공부 시간">' +
      '<line x1="0" x2="' + W + '" y1="' + (H - bottom) + '" y2="' + (H - bottom) + '" stroke="var(--line)"/><line x1="0" x2="' + W + '" y1="' + top + '" y2="' + top + '" stroke="var(--line)" stroke-dasharray="2 3"/>' +
      '<text x="' + W + '" y="' + (top - 2) + '" text-anchor="end">' + max + "분</text>";
    days.forEach(function (o, i) {
      var hh = (H - top - bottom) * (o.m / max), x = i * bw + bw * .18, w = bw * .64;
      svg += '<rect x="' + x.toFixed(1) + '" y="' + (H - bottom - hh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(hh, o.m ? 2 : 0).toFixed(1) + '" rx="2" fill="' + (i === 13 ? "var(--omr)" : "var(--pen)") + '"><title>' + o.k + " " + o.m + "분</title></rect>";
      if (i % 2 === 1) svg += '<text x="' + (i === 13 ? W : x + w / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="' + (i === 13 ? "end" : "middle") + '">' + (o.d.getMonth() + 1) + "/" + o.d.getDate() + "</text>";
    });
    return svg + "</svg>";
  }
  function homeCertCard(id) {
    var c = cert(id); if (!c) return "";
    var st = certStatus(id), s = certStats(id), p = packOf(id);
    var loading = p && !p.ready;
    var nx = M.exams.filter(function (e) { return e.certId === id && e.date >= today() && !e.done; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    var pct = s.total ? Math.round(s.done / s.total * 100) : 0;
    return '<article class="card cert-card"><div class="top">' + dot(id) + "<h3>" + esc(c.short || c.name) + "</h3>" + pill(st) + "</div>" +
      '<div class="steps" style="grid-template-columns:repeat(' + c.stages.length + ',1fr)">' + st.steps.map(function (on) { return "<i" + (on ? ' class="on"' : "") + "></i>"; }).join("") + "</div>" +
      '<div class="meta"><span>풀이 진도</span><b>' + (loading ? "…" : s.done + " / " + s.total) + "</b></div>" +
      '<div class="progress" title="' + pct + '%"><i style="width:' + pct + '%"></i></div>' +
      '<div class="meta"><span>정답률</span><b>' + (s.rate == null ? "—" : s.rate + "%") + "</b></div>" +
      '<div class="meta"><span>남은 오답</span><b>' + s.open + "</b></div>" +
      '<div class="meta"><span>내 시험</span><b>' + (nx ? dday(nx.date) : "—") + "</b></div>" +
      '<div class="meta"><span>난이도</span>' + (c.diff ? diffMeter(c.diff, false) : "<b>—</b>") + "</div>" +
      '<div class="foot"><button class="btn sm primary" data-act="study" data-id="' + id + '" data-tab="gichul">기출 풀기</button><button class="btn sm" data-act="study" data-id="' + id + '" data-tab="summary">요약</button></div></article>';
  }

  /* ================================================================
     공부 (자격증별)
     ================================================================ */
  var STUDY_TABS = [["gichul", "기출 풀기"], ["summary", "요약정리"], ["wrong", "오답노트"], ["record", "시험 기록"], ["mine", "내 문제"]];
  function renderStudy() {
    var ids = myCertIds();
    if (!studyCert || ids.indexOf(studyCert) < 0) studyCert = ids[0];
    var c = cert(studyCert), p = packOf(studyCert);
    var h = '<div class="cert-switch" role="tablist" aria-label="자격증">' + ids.map(function (id) {
      return '<button role="tab" aria-selected="' + (id === studyCert) + '" class="chip' + (id === studyCert ? " on" : "") + '" data-act="study" data-id="' + id + '">' + dot(id) + esc(certShort(id)) + "</button>";
    }).join("") + '<button class="chip add" data-act="certs-manage">＋ 자격증</button></div>';
    h += '<div class="page-head"><div><h1>' + esc(c.name) + "</h1><p>" + esc(c.org) + (c.goal ? " · 목표: " + esc(c.goal) : "") + "</p></div>" + pill(certStatus(studyCert)) + "</div>";
    h += diffBox(c);
    h += '<nav class="subtabs" aria-label="공부 메뉴">' + STUDY_TABS.map(function (t) { return '<button class="' + (studyTab === t[0] ? "on" : "") + '" data-act="study-tab" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</nav>";
    if (p && !p.ready && (studyTab === "gichul" || studyTab === "summary" || studyTab === "wrong")) {
      p.load().then(function () { if (view === "study" && !session) render(); }).catch(function (e) { toast(e.message); });
      return h + '<div class="empty">문제와 요약을 불러오는 중이에요…</div>';
    }
    if (p && p.note && (studyTab === "gichul" || studyTab === "summary")) h += '<div class="notice">' + esc(p.note) + "</div>";
    if (c.note && !p) h += '<div class="notice">' + esc(c.note) + "</div>";
    if (studyTab === "gichul") h += renderGichul(studyCert);
    else if (studyTab === "summary") h += renderSummary(studyCert);
    else if (studyTab === "wrong") h += renderWrongList(studyCert);
    else if (studyTab === "record") h += renderCertRecord(studyCert);
    else h += renderMine(studyCert);
    return h;
  }

  /* ----- 기출 풀기 ----- */
  function renderGichul(id) {
    var c = cert(id), qs = questionsOf(id), subs = subjectsOf(id), p = packOf(id);
    if (!qs.length) return '<div class="empty"><b>아직 풀 문제가 없어요</b><span class="small">기출 PDF에서 문제를 옮기거나, 한 줄에 한 문제씩 붙여 넣어 한꺼번에 추가할 수 있어요.</span><div class="row center"><button class="btn primary" data-act="q-bulk">붙여넣기로 추가</button><button class="btn" data-act="q-edit">한 문제 추가</button></div></div>';
    var ex = c.exam;
    var h = '<div class="grid-2">';
    h += '<section class="card stack"><p class="eyebrow">실전 모의고사</p><h2 class="h2">시험장처럼 풀기</h2>' +
      '<p class="small muted">' + (ex ? ex.count + "문항 · " + ex.minutes + "분" + (ex.perSubject ? " · 과목별 " + ex.perSubject.join("/") + "문항" : "") : "전체 문제 중 무작위") + " · 안 푼 문제와 틀린 문제를 먼저 넣어요. 끝나고 한 번에 채점하고 합격 여부를 알려 줘요.</p>" +
      '<div class="row mt-auto"><button class="btn omr" data-act="mock-start">실전 모의고사 시작</button></div></section>';
    h += '<section class="card stack"><p class="eyebrow">골라 풀기</p><div class="form">' +
      fld("과목", '<select id="pk-subj"><option value="0">전체 과목</option>' + subs.slice(1).map(function (s, i) { return '<option value="' + (i + 1) + '"' + (ui.pickSubj === i + 1 ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select>") +
      '<div class="field"><label>문제 수</label>' + seg("pk-count", [["10", "10"], ["20", "20"], ["50", "50"]], ui.pickCount) + "</div>" +
      '<div class="field"><label>어떤 문제</label>' + seg("pk-filter", [["all", "전체"], ["new", "안 푼 것"], ["wrong", "틀린 것"]], ui.pickFilter) + "</div>" +
      '<div class="field"><label>채점</label>' + seg("pk-mode", [["instant", "바로 채점"], ["exam", "끝나고 채점"]], ui.pickMode) + "</div></div>" +
      '<div class="row"><span class="small muted">조건에 맞는 문제 <b class="num">' + pickPool(id).length + '</b>개</span><span class="spacer"></span><button class="btn primary" data-act="pick-start">풀기</button></div></section></div>';

    // 회차별
    var sets = (p && p.ready ? p.sets : []).slice();
    var mine = customFor(id); if (mine.length) sets.push({ key: "__mine", label: "내 문제", group: "내가 추가한 문제", count: mine.length });
    var groups = []; sets.forEach(function (s) { var g = groups.filter(function (x) { return x.name === s.group; })[0]; if (!g) { g = { name: s.group, sets: [] }; groups.push(g); } g.sets.push(s); });
    h += '<section class="section"><div class="section-head"><h2>회차별로 풀기</h2><span class="small muted">' + qs.length.toLocaleString() + "문제</span></div>";
    groups.forEach(function (g) {
      h += (g.name ? '<p class="group-label">' + esc(g.name) + "</p>" : "") + '<div class="set-grid">' + g.sets.map(function (s) {
        var list = s.key === "__mine" ? mine : p.questions.filter(function (q) { return q.set === s.key; });
        var done = 0, ok = 0; list.forEach(function (q) { var r = ansOf(q); if (r) { done++; if (r[2] === 1) ok++; } });
        var pct = Math.round(done / list.length * 100);
        return '<button class="set-card" data-act="set-start" data-set="' + esc(s.key) + '"><span class="set-name">' + esc(s.label) + '</span><span class="set-meta num">' + (done ? ok + "/" + done + " 맞힘" : s.count + "문항") + '</span><span class="progress"><i style="width:' + pct + '%"></i></span></button>';
      }).join("") + "</div>";
    });
    return h + "</section>";
  }
  function seg(id, opts, cur) { return '<div class="seg" id="' + id + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (cur === o[0] ? "on" : "") + '">' + o[1] + "</button>"; }).join("") + "</div>"; }
  function pickPool(id) {
    return questionsOf(id).filter(function (q) {
      if (ui.pickSubj && q.s !== ui.pickSubj) return false;
      if (ui.pickFilter === "new" && ansOf(q)) return false;
      if (ui.pickFilter === "wrong" && !isOpenWrong(q)) return false;
      return true;
    });
  }
  function startPick() {
    var pool = shuffle(pickPool(studyCert)).slice(0, +ui.pickCount);
    if (!pool.length) { toast("조건에 맞는 문제가 없어요"); return; }
    var subs = subjectsOf(studyCert);
    startSession(studyCert, pool, ui.pickMode, (ui.pickSubj ? subs[ui.pickSubj] : "전체 과목") + " " + pool.length + "문제", ui.pickMode === "exam" ? pool.length * 60 : 0);
  }
  function startMock() {
    var c = cert(studyCert), all = questionsOf(studyCert), ex = c.exam || {};
    function prio(list) { // 안 푼 것 → 틀린 것 → 나머지
      var a = [], b = [], d = [];
      shuffle(list).forEach(function (q) { var r = ansOf(q); if (!r) a.push(q); else if (r[2] === 0) b.push(q); else d.push(q); });
      return a.concat(b, d);
    }
    var pick = [];
    if (ex.perSubject) ex.perSubject.forEach(function (n, i) { pick = pick.concat(prio(all.filter(function (q) { return q.s === i + 1; })).slice(0, n)); });
    else pick = prio(all).slice(0, ex.count || 50);
    if (!pick.length) { toast("풀 문제가 없어요"); return; }
    var mins = ex.minutes ? Math.round(ex.minutes * pick.length / (ex.count || pick.length)) : pick.length;
    startSession(studyCert, pick, "exam", "실전 모의고사 " + pick.length + "문항", mins * 60, true);
  }
  function startSet(key) {
    var list = key === "__mine" ? customFor(studyCert) : packOf(studyCert).questions.filter(function (q) { return q.set === key; });
    list = list.slice().sort(function (a, b) { return a.s - b.s || a.n - b.n; });
    var p = packOf(studyCert), s = p && p.sets.filter(function (x) { return x.key === key; })[0];
    var label = key === "__mine" ? "내 문제" : s ? s.label : key;
    openModal(label, '<p class="small muted">' + list.length + '문항이에요. 어떻게 풀까요?</p><div class="stack" style="margin-top:12px">' +
      '<button class="btn omr block" data-act="set-go" data-mode="exam">시험처럼 · 끝나고 채점 (' + Math.round(list.length * ((cert(studyCert).exam || {}).minutes || list.length) / ((cert(studyCert).exam || {}).count || list.length)) + "분)</button>" +
      '<button class="btn block" data-act="set-go" data-mode="instant">한 문제씩 바로 채점</button></div>', function () {
      $all("[data-act=set-go]").forEach(function (b) {
        b.onclick = function () {
          closeModal();
          var ex = cert(studyCert).exam || {};
          var secs = b.dataset.mode === "exam" ? Math.round(list.length * (ex.minutes || list.length) / (ex.count || list.length)) * 60 : 0;
          startSession(studyCert, list, b.dataset.mode, label, secs, true);
        };
      });
    });
  }

  /* ----- 문제 풀이 세션 ----- */
  function startSession(certId, qs, mode, title, secs, judge) {
    session = { certId: certId, qs: qs, mode: mode, title: title, i: 0, picks: {}, shown: {}, start: Date.now(), limit: secs || 0, judge: !!judge, done: false, openTopic: {} };
    view = "quiz"; render(); window.scrollTo(0, 0);
    if (mode === "exam" && secs) startTimer();
  }
  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(function () {
      if (!session || session.done) { clearInterval(timerId); return; }
      var left = session.limit - (Date.now() - session.start) / 1000;
      var el = $("#timer"); if (el) { el.textContent = fmtTime(left); el.classList.toggle("low", left < 300); }
      if (left <= 0) { clearInterval(timerId); toast("시간이 끝났어요. 자동으로 채점해요"); submitExam(); }
    }, 1000);
  }
  function renderSession() {
    var s = session;
    if (s.done) return renderResult();
    var q = s.qs[s.i], n = s.qs.length, pick = s.picks[s.i];
    var answered = Object.keys(s.picks).length;
    var shown = s.mode === "instant" && pick != null;
    var subs = subjectsOf(s.certId);
    var h = '<div class="quiz-wrap"><div class="quiz-bar"><div class="grow"><p class="eyebrow">' + esc(certShort(s.certId)) + " · " + (s.mode === "exam" ? "끝나고 채점" : "바로 채점") + '</p><b class="quiz-title">' + esc(s.title) + "</b></div>" +
      (s.mode === "exam" && s.limit ? '<span class="timer num" id="timer">' + fmtTime(s.limit - (Date.now() - s.start) / 1000) + "</span>" : "") +
      '<button class="btn sm ghost" data-act="quiz-quit" data-confirm>그만하기</button></div>';
    h += '<div class="q-progress"><span class="num">' + (s.i + 1) + " / " + n + '</span><div class="progress"><i style="width:' + (answered / n * 100) + '%"></i></div><span class="num small">' + answered + "개 답함</span></div>";
    h += '<section class="card q-card"><div class="q-meta">' + (subs[q.s] ? '<span class="pill prep">' + esc(subs[q.s]) + "</span>" : "") + '<span class="pill gray">' + esc(setLabel(q)) + (q.n ? " " + q.n + "번" : "") + "</span>" +
      (q.points ? '<span class="pill gray">' + q.points + "점</span>" : "") + (wasWrong(q) && s.mode === "instant" ? '<span class="pill fail">전에 틀림</span>' : "") + (q.old ? '<span class="pill half">옛 버전 내용</span>' : "") + "</div>" +
      qBody(q) + '<div class="opts">' + q.o.map(function (o, i) {
        var cls = "opt";
        if (shown) { if (i === q.a) cls += " right"; else if (i === pick) cls += " wrong"; }
        if (i === pick) cls += " picked";
        return '<button class="' + cls + '" data-act="pick" data-i="' + i + '"' + (shown ? " disabled" : "") + '><span class="bub">' + (i + 1) + "</span><span>" + esc(o || (q.fo ? "(그림의 " + CIRCLE[i] + "번 보기)" : "")) + "</span></button>";
      }).join("") + "</div>";
    if (shown) h += explainBox(q, pick, s);
    h += '<div class="row"><button class="btn" data-act="q-prev"' + (s.i ? "" : " disabled") + ">이전</button><span class=\"spacer\"></span>" +
      (s.i + 1 < n ? '<button class="btn primary" data-act="q-next" id="btn-next">다음</button>' : s.mode === "exam" ? '<button class="btn omr" data-act="exam-submit" data-confirm>답안 제출</button>' : '<button class="btn omr" data-act="instant-finish" id="btn-next">결과 보기</button>') + "</div></section>";
    if (s.mode === "exam") {
      h += '<section class="card stack"><div class="row"><b>답안 표기란</b><span class="spacer"></span><span class="small muted">' + (n - answered) + '개 안 풂</span><button class="btn sm omr" data-act="exam-submit" data-confirm>답안 제출</button></div><div class="omr-sheet">' +
        s.qs.map(function (qq, i) { var pk = s.picks[i]; return '<button class="omr-cell' + (i === s.i ? " cur" : "") + (pk != null ? " done" : "") + '" data-act="q-jump" data-i="' + i + '"><span class="num">' + (i + 1) + "</span><span class=\"mk\">" + (pk != null ? CIRCLE[pk] : "") + "</span></button>"; }).join("") + "</div></section>";
    }
    h += '<p class="small muted center">키보드 1~' + q.o.length + '로 고르고 Enter로 넘어가요</p></div>';
    return h;
  }
  function setLabel(q) { var p = P[q.pack]; if (p && p.ready) { var s = p.sets.filter(function (x) { return x.key === q.set; })[0]; if (s) return s.label; } return q.set || ""; }
  function qBody(q) {
    var p = P[q.pack], h = "";
    if (q.passage) h += '<div class="passage">' + esc(q.passage) + "</div>";
    var needs = p && p.needsMedia(q), m = needs ? p.media(q) : {};
    if (needs && !mediaReady(q, m)) { p.loadMedia(q).then(function () { if (session && !session.done && session.qs[session.i] === q) render(); else if (!session) render(); }).catch(function () {}); }
    if (m.full && m.img) h += '<img class="qimg" src="' + m.img + '" alt="' + esc(q.q) + '">';
    else {
      h += '<p class="q-text">' + esc(q.q) + "</p>";
      if (m.img) h += '<img class="qimg" src="' + m.img + '" alt="문제 그림">';
      if (m.figs) h += m.figs.map(function (src, i) { return '<img class="qimg" src="' + src + '" alt="문제 그림 ' + (i + 1) + '">'; }).join("");
      if (needs && !mediaReady(q, m)) h += '<div class="figwait">그림 불러오는 중…</div>';
    }
    return h;
  }
  function mediaReady(q, m) { if (q.pack === "arch") return !!m.figs; if (q.pack === "comp1") return (!q.img || !!m.img) && (!q.eimg || !!m.eimg); return true; }
  function explainBox(q, pick, s) {
    var ok = pick === q.a, p = P[q.pack], m = p && p.needsMedia(q) ? p.media(q) : {};
    var h = '<div class="explain"><b class="' + (ok ? "ok" : "no") + '">' + (pick == null ? "안 푼 문제 · 정답은 " + CIRCLE[q.a] + "번" : ok ? "정답이에요" : "오답 · 정답은 " + CIRCLE[q.a] + "번") + "</b>" +
      (m.eimg ? '<img class="qimg" src="' + m.eimg + '" alt="해설 그림">' : q.e ? '<p class="small pre">' + esc(q.e) + "</p>" : '<p class="small muted">해설이 없어요.</p>');
    var ti = p ? p.topicOf(q) : -1;
    if (ti > -1) {
      var key = q.pack + ":" + q.id, open = ui.openTopic[key];
      h += '<button class="btn sm ghost left" data-act="topic-toggle" data-key="' + esc(key) + '">' + (open ? "관련 요약 접기" : "관련 요약 보기 · " + esc(p.topics[ti].title)) + "</button>";
      if (open) h += topicCard(p, ti, true);
    }
    var nt = notes()[q.pack + ":" + q.id];
    if (nt) h += '<p class="small notice">내 메모: ' + esc(nt) + "</p>";
    return h + "</div>";
  }
  function pickAnswer(i) {
    var s = session; if (!s || s.done) return;
    var q = s.qs[s.i]; if (i >= q.o.length) return;
    if (s.mode === "instant") {
      if (s.picks[s.i] != null) return;
      s.picks[s.i] = i; record(q, i);
    } else { s.picks[s.i] = i; }
    render();
    if (s.mode === "exam" && s.i + 1 < s.qs.length) setTimeout(function () { if (session === s && !s.done) { s.i++; render(); } }, 220);
    var b = $("#btn-next"); if (b) b.focus();
  }
  function submitExam() {
    var s = session; if (!s || s.done) return;
    s.qs.forEach(function (q, i) { record(q, s.picks[i] == null ? -1 : s.picks[i]); });
    finishSession();
  }
  function finishSession() {
    var s = session; s.done = true; clearInterval(timerId);
    s.secs = Math.round((Date.now() - s.start) / 1000);
    var r = scoreSession(s); s.result = r;
    M.solved.push({ date: today(), certId: s.certId, title: s.title, total: r.total, correct: r.correct, score: r.score, pass: r.judge ? r.pass : null, secs: s.secs });
    if (M.solved.length > 400) M.solved = M.solved.slice(-400);
    save(); render(); window.scrollTo(0, 0);
  }
  function scoreSession(s) {
    var c = cert(s.certId), subs = subjectsOf(s.certId), by = {}, correct = 0, pts = 0, ptsAll = 0;
    s.qs.forEach(function (q, i) {
      var ok = s.picks[i] === q.a; if (ok) correct++;
      by[q.s] = by[q.s] || { c: 0, t: 0 }; by[q.s].t++; if (ok) by[q.s].c++;
      var w = q.points || 1; ptsAll += w; if (ok) pts += w;
    });
    var st = c.stages[0], rows = Object.keys(by).sort(function (a, b) { return a - b; }).map(function (k) { var o = by[k]; return { s: +k, name: subs[k] || "기타", c: o.c, t: o.t, p: Math.round(o.c / o.t * 100) }; });
    var score, pass = false, grade = "", judge = false, under = [];
    if (c.id === "khist") { score = Math.round(pts / ptsAll * 100); grade = (st.grades.filter(function (g) { return score >= g[0]; })[0] || [0, ""])[1]; pass = !!grade; judge = s.judge; }
    else {
      var w = st.weights && st.weights.length === rows.length ? st.weights : null;
      if (w) { var sw = 0, sum = 0; rows.forEach(function (r, i) { sum += r.p * w[i]; sw += w[i]; }); score = Math.round(sum / sw); }
      else score = Math.round(rows.reduce(function (a, r) { return a + r.p; }, 0) / rows.length);
      var allSubs = st.subjects.length && rows.length === st.subjects.length;
      under = rows.filter(function (r) { return st.subjMin && r.p < st.subjMin; });
      judge = s.judge && allSubs;
      pass = under.length === 0 && score >= st.passMin;
    }
    return { total: s.qs.length, correct: correct, score: score, rows: rows, pass: pass, grade: grade, judge: judge, under: under, rule: st };
  }
  function renderResult() {
    var s = session, r = s.result;
    var wrongIdx = []; s.qs.forEach(function (q, i) { if (s.picks[i] !== q.a) wrongIdx.push(i); });
    var h = '<div class="quiz-wrap"><section class="card stack result-card"><p class="eyebrow">' + esc(certShort(s.certId)) + " · " + esc(s.title) + "</p>" +
      '<div class="row baseline"><span class="result-score" style="color:' + (r.judge ? (r.pass ? "var(--good)" : "var(--omr)") : r.score >= 60 ? "var(--good)" : "var(--omr)") + '">' + r.score + '</span><span class="muted">점 · ' + r.correct + " / " + r.total + "문제 · " + fmtTime(s.secs) + "</span></div>";
    if (r.judge) h += '<div class="verdict ' + (r.pass ? "pass" : "fail") + '">' + (r.pass ? (r.grade ? r.grade + " 합격선이에요" : "합격이에요! 이대로만 가면 돼요") : r.under.length ? "과락 때문에 불합격: " + r.under.map(function (x) { return x.name; }).join(", ") + " (" + r.rule.subjMin + "점 미만)" : "불합격 · 합격선 " + r.rule.passMin + "점까지 " + (r.rule.passMin - r.score) + "점") + "</div>";
    h += '<div class="table-wrap"><table class="scores"><thead><tr><th class="l">과목</th><th>맞힘</th><th>점수</th></tr></thead><tbody>' + r.rows.map(function (x) {
      return '<tr><td class="l">' + esc(x.name) + '</td><td class="num">' + x.c + " / " + x.t + '</td><td class="num' + (r.rule.subjMin && x.p < r.rule.subjMin ? " under" : "") + '">' + x.p + "</td></tr>";
    }).join("") + "</tbody></table></div>";
    h += '<div class="row"><button class="btn omr" data-act="retry-wrong"' + (wrongIdx.length ? "" : " disabled") + ">틀린 " + wrongIdx.length + "문제 다시</button>" +
      '<button class="btn" data-act="quiz-close">공부로 돌아가기</button><button class="btn ghost" data-act="go" data-view="wrong">오답노트</button></div></section>';
    if (wrongIdx.length) {
      h += '<section class="section"><div class="section-head"><h2>틀린 문제 해설</h2><span class="small muted">눌러서 펼쳐요</span></div><div class="list">' + wrongIdx.map(function (i) {
        var q = s.qs[i], pk = s.picks[i];
        return '<details class="q-detail"><summary><span class="num omr-no">' + (i + 1) + '</span><span class="grow clamp">' + esc(q.q) + '</span><span class="small num">' + (pk != null ? CIRCLE[pk] : "—") + " → " + CIRCLE[q.a] + "</span></summary>" +
          '<div class="q-detail-body">' + qBody(q) + '<ol class="opt-list">' + q.o.map(function (o, j) { return '<li class="' + (j === q.a ? "right" : j === pk ? "wrong" : "") + '"><span class="num">' + CIRCLE[j] + "</span> " + esc(o || "(그림 보기)") + "</li>"; }).join("") + "</ol>" + explainBox(q, pk, s) + "</div></details>";
      }).join("") + "</div></section>";
    }
    return h + "</div>";
  }

  /* ----- 요약정리 ----- */
  function renderSummary(id) {
    var p = packOf(id);
    if (!p) return '<div class="empty"><b>이 자격증은 요약 자료가 아직 없어요</b><span class="small">문제를 추가해 풀면서 [오답노트] 메모로 정리해 보세요.</span></div>';
    var subs = p.subjects, hasF = p.topics.some(function (t) { return t.items.some(function (it) { return it.f; }); });
    var q = ui.sumQ.trim().toLowerCase();
    var list = p.topics.map(function (t, i) { return { t: t, i: i }; }).filter(function (o) {
      if (!o.t.items.length && !o.t.kv.length) return false;
      if (ui.sumSubj && o.t.s !== ui.sumSubj) return false;
      if (q) { var txt = (o.t.title + " " + o.t.lead + " " + o.t.tip + " " + o.t.items.map(function (x) { return x.t; }).join(" ") + " " + o.t.kv.map(function (x) { return x.join(" "); }).join(" ") + " " + o.t.hot.join(" ")).toLowerCase(); if (txt.indexOf(q) < 0) return false; }
      if (ui.sumHot && hasF && !o.t.items.some(function (x) { return (x.f || 0) >= 3; })) return false;
      return true;
    });
    var h = '<div class="sum-tools"><div class="chips">' + '<button class="chip' + (!ui.sumSubj ? " on" : "") + '" data-act="sum-subj" data-s="0">전체</button>' +
      subs.slice(1).map(function (s, i) { return '<button class="chip' + (ui.sumSubj === i + 1 ? " on" : "") + '" data-act="sum-subj" data-s="' + (i + 1) + '">' + esc(s) + "</button>"; }).join("") + "</div>" +
      '<div class="row"><div class="field grow"><input id="sum-q" type="search" placeholder="요약에서 찾기 (예: VLOOKUP, 슬럼프)" value="' + esc(ui.sumQ) + '" aria-label="요약 검색"></div>' +
      (hasF ? '<label class="check"><input type="checkbox" id="sum-hot"' + (ui.sumHot ? " checked" : "") + "> 자주 나온 것만</label>" : "") + "</div></div>";
    h += '<p class="small muted">' + list.length + "개 주제</p>";
    h += list.length ? '<div class="topic-list">' + list.slice(0, ui.sumLimit).map(function (o) { return topicCard(p, o.i, false); }).join("") + "</div>" : '<div class="empty">찾는 내용이 없어요.</div>';
    if (list.length > ui.sumLimit) h += '<button class="btn block" data-act="sum-more">더 보기 (' + (list.length - ui.sumLimit) + "개 남음)</button>";
    return h;
  }
  function topicCard(p, i, compact) {
    var t = p.topics[i], subs = p.subjects;
    var hot = ui.sumHot && !compact;
    var items = t.items.filter(function (x) { return !hot || (x.f || 0) >= 3; });
    var h = '<article class="topic' + (compact ? " compact" : "") + '"><div class="topic-head"><span class="pill prep">' + esc(subs[t.s] || "") + "</span><h3>" + esc(t.title) + "</h3></div>";
    if (t.lead) h += '<p class="small muted">' + esc(t.lead) + "</p>";
    if (items.length) h += '<ul class="topic-items">' + items.map(function (x) { return "<li><span>" + esc(x.t) + "</span>" + (x.f ? '<span class="freq num" title="관련 기출 수">' + x.f + "</span>" : "") + "</li>"; }).join("") + "</ul>";
    if (t.kv.length) h += '<dl class="kv">' + t.kv.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl>";
    if (t.table && !compact) h += '<div class="table-wrap"><table class="scores"><thead><tr>' + t.table.h.map(function (x) { return '<th class="l">' + esc(x) + "</th>"; }).join("") + "</tr></thead><tbody>" + t.table.r.map(function (r) { return "<tr>" + r.map(function (x) { return '<td class="l">' + esc(x) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
    if (t.tip) h += '<p class="tip"><b>암기</b> ' + esc(t.tip) + "</p>";
    if (t.hot.length && !compact) h += '<div class="chips small-chips">' + t.hot.map(function (k) { return '<span class="chip static">' + esc(k) + "</span>"; }).join("") + "</div>";
    if (!compact) { var n = p.questions.filter(function (q) { return p.topicOf(q) === i; }).length; if (n) h += '<button class="btn sm" data-act="topic-quiz" data-i="' + i + '">이 주제 문제 풀기 (' + n + ")</button>"; }
    return h + "</article>";
  }

  /* ----- 오답노트 ----- */
  function wrongQs(certIds) {
    var out = [];
    certIds.forEach(function (id) { questionsOf(id).forEach(function (q) { var r = ansOf(q); if (r && r[0] > 0) out.push(q); }); });
    return out;
  }
  function renderWrongList(fixedCert) {
    var ids = fixedCert ? [fixedCert] : (ui.wrongCert ? [ui.wrongCert] : myCertIds());
    var notReady = ids.filter(function (id) { var p = packOf(id); return p && !p.ready; });
    if (notReady.length) { notReady.forEach(function (id) { packOf(id).load().then(function () { if (!session) render(); }); }); return '<div class="empty">오답을 모으는 중이에요…</div>'; }
    var all = wrongQs(ids), open = all.filter(isOpenWrong), done = all.filter(function (q) { return !isOpenWrong(q); });
    var list = (ui.wrongShow === "open" ? open : done).sort(function (a, b) { return ansOf(b)[0] - ansOf(a)[0] || ansOf(b)[3] - ansOf(a)[3]; });
    var h = '<div class="row">' + seg("wr-show", [["open", "남은 오답 " + open.length], ["done", "극복 " + done.length]], ui.wrongShow) + '<span class="spacer"></span>';
    if (!fixedCert) h += '<div class="field"><select id="wr-cert" aria-label="자격증">' + '<option value="">전체 자격증</option>' + myCertIds().map(function (id) { return '<option value="' + id + '"' + (ui.wrongCert === id ? " selected" : "") + ">" + esc(certShort(id)) + "</option>"; }).join("") + "</select></div>";
    h += '<button class="btn omr" data-act="wrong-retry"' + (open.length ? "" : " disabled") + ">남은 오답 다시 풀기</button></div>";
    if (!list.length) return h + '<div class="empty">' + (ui.wrongShow === "open" ? "남은 오답이 없어요. 문제를 풀면 틀린 문제가 여기에 모여요." : "아직 극복한 오답이 없어요. 오답을 다시 풀어 맞히면 여기로 옮겨져요.") + "</div>";
    // 과목별 요약
    var bySub = {};
    list.forEach(function (q) { var k = certOfQ(q) + "|" + q.s; bySub[k] = (bySub[k] || 0) + 1; });
    h += '<div class="chips small-chips">' + Object.keys(bySub).map(function (k) { var a = k.split("|"); return '<span class="chip static">' + esc(certShort(a[0])) + " · " + esc(subjectsOf(a[0])[+a[1]] || "기타") + ' <b class="num">' + bySub[k] + "</b></span>"; }).join("") + "</div>";
    h += '<div class="list">' + list.slice(0, ui.wrongLimit).map(function (q) {
      var r = ansOf(q), cid = certOfQ(q), key = q.pack + ":" + q.id, nt = notes()[key];
      return '<details class="q-detail"><summary><span class="count-badge num">' + r[0] + '회</span><span class="grow"><span class="clamp">' + esc(q.q) + '</span><span class="tags">' + dot(cid) + '<span class="small muted">' + esc(certShort(cid)) + " · " + esc(subjectsOf(cid)[q.s] || "") + " · " + esc(setLabel(q)) + "</span></span></span></summary>" +
        '<div class="q-detail-body">' + qBody(q) + '<ol class="opt-list">' + q.o.map(function (o, j) { return '<li class="' + (j === q.a ? "right" : "") + '"><span class="num">' + CIRCLE[j] + "</span> " + esc(o || "(그림 보기)") + "</li>"; }).join("") + "</ol>" +
        explainBox(q, q.a, null).replace("정답이에요", "정답 " + CIRCLE[q.a] + "번") +
        '<div class="row"><button class="btn sm" data-act="wrong-note" data-key="' + esc(key) + '">' + (nt ? "메모 고치기" : "메모 남기기") + '</button><button class="btn sm ghost" data-act="wrong-toggle" data-key="' + esc(key) + '">' + (isOpenWrong(q) ? "극복 표시" : "다시 오답으로") + "</button></div></div></details>";
    }).join("") + "</div>";
    if (list.length > ui.wrongLimit) h += '<button class="btn block" data-act="wrong-more">더 보기 (' + (list.length - ui.wrongLimit) + "개 남음)</button>";
    return h;
  }
  function renderWrongView() {
    return '<div class="page-head"><div><h1>오답노트</h1><p>여러 번 틀린 문제부터 보여 줘요. 다시 풀어 맞히면 극복으로 옮겨져요.</p></div></div>' + renderWrongList(null);
  }

  /* ----- 시험 기록 (자격증별) ----- */
  function renderCertRecord(id) {
    var c = cert(id), atts = certAttempts(id);
    var rules = c.stages.map(function (s) { return "<b>" + esc(s.name) + "</b> " + (s.subjects.length ? esc(s.subjects.join(" · ")) : '<span class="muted">과목 미입력</span>') + ' <span class="muted">— ' + (s.grades ? "60점 3급 · 70점 2급 · 80점 1급" : (s.subjMin ? "과목당 " + s.subjMin + "점 이상, " : "") + (s.subjects.length > 1 ? "평균 " : "") + s.passMin + "점 이상") + "</span>"; }).join("<br>");
    var h = '<section class="card stack"><div class="row"><h2 class="h2">합격 기준</h2><span class="spacer"></span><button class="btn sm ghost" data-act="cert-settings" data-id="' + id + '">설정</button></div><p class="small">' + rules + "</p>" +
      '<div class="row"><button class="btn primary" data-act="attempt-add" data-cert="' + id + '">시험 결과 기록</button><button class="btn" data-act="license" data-id="' + id + '">' + (c.license ? "합격 정보" : "최종 합격 등록") + "</button></div></section>";
    if (!atts.length) return h + '<div class="empty">실제 시험을 보고 점수를 기록하면 여기에 쌓이고, 합격까지 몇 점 남았는지 알려 줘요.</div>';
    var byStage = {}; atts.forEach(function (a) { (byStage[a.stage] = byStage[a.stage] || []).push(a); });
    Object.keys(byStage).forEach(function (sn) {
      var st = c.stages.filter(function (x) { return x.name === sn; })[0] || c.stages[0], subs = st.subjects.length ? st.subjects : ["총점"];
      h += '<section class="card"><div class="table-wrap"><table class="scores"><thead><tr><th class="l">' + esc(sn) + " 응시일</th>" + subs.map(function (s) { return "<th>" + esc(s) + "</th>"; }).join("") + "<th>환산</th><th>결과</th><th></th></tr></thead><tbody>" +
        byStage[sn].map(function (a) {
          var ev = evalAttempt(a);
          return '<tr><td class="l num">' + fmtDate(a.date) + "</td>" + subs.map(function (s, i) { return '<td class="num' + (ev.under.indexOf(i) > -1 ? " under" : "") + '">' + (a.scores[i] !== "" && a.scores[i] != null ? esc(a.scores[i]) : "—") + "</td>"; }).join("") +
            '<td class="num"><b>' + ev.total + "</b></td><td>" + (ev.pass ? '<span class="pill pass">' + (ev.grade || "합격") + "</span>" : '<span class="pill fail">불합격</span>') + '</td><td><button class="btn sm ghost" data-act="attempt-edit" data-id="' + a.id + '">수정</button></td></tr>' +
            (a.memo ? '<tr><td class="l small muted" colspan="' + (subs.length + 4) + '">↳ ' + esc(a.memo) + "</td></tr>" : "");
        }).join("") + "</tbody></table></div></section>";
    });
    return h;
  }

  /* ----- 내 문제 ----- */
  function renderMine(id) {
    var list = customFor(id), subs = subjectsOf(id);
    var h = '<div class="row"><p class="small muted grow">기출 PDF나 책에서 옮긴 문제를 넣으면 기출 풀기·실전 모의고사·오답노트에 함께 들어가요.</p><button class="btn" data-act="q-bulk">붙여넣기로 여러 문제</button><button class="btn primary" data-act="q-edit">＋ 한 문제</button></div>';
    if (!list.length) return h + '<div class="empty">아직 추가한 문제가 없어요.</div>';
    return h + '<div class="list">' + list.map(function (q) {
      return '<div class="q-row"><div class="grow"><div class="clamp b">' + esc(q.q) + '</div><div class="tags"><span class="pill prep">' + esc(subs[q.s] || "기타") + '</span><span class="pill gray">' + esc(q.set) + "</span></div></div>" +
        '<button class="btn sm ghost" data-act="q-edit" data-id="' + q.id + '">수정</button></div>';
    }).join("") + "</div>";
  }

  /* ================================================================
     일정
     ================================================================ */
  function renderSched() {
    var ids = myCertIds();
    var all = schedFor(ui.schedMine ? ids : null).slice().sort(function (a, b) { return schedSortKey(a) < schedSortKey(b) ? -1 : 1; });
    var live = all.filter(function (e) { return !schedStatus(e).ended; }), past = all.filter(function (e) { return schedStatus(e).ended; }).reverse();
    var h = '<div class="page-head"><div><h1>시험 일정</h1><p>원서접수 기간을 놓치지 않게 챙겨요. [원서 접수]를 누르면 접수 사이트로 이동해요.</p></div>' +
      '<button class="btn primary" data-act="exam-add">＋ 내 시험 추가</button></div>';
    var mine = M.exams.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var upMine = mine.filter(function (e) { return e.date >= today() && !e.done; });
    h += '<section class="section"><div class="section-head"><h2>내 시험</h2><span class="small muted">' + upMine.length + "건 예정</span></div>";
    h += upMine.length ? '<div class="list">' + upMine.map(myExamRow).join("") + "</div>" : '<div class="empty small">아래 공식 일정에서 [내 시험으로]를 누르거나, 직접 추가해 보세요.</div>';
    h += "</section>";
    h += '<section class="section"><div class="section-head"><h2>공식 일정</h2>' + seg("sch-mine", [["1", "내 자격증만"], ["0", "전체"]], ui.schedMine ? "1" : "0") + "</div>" +
      '<div class="sched-list">' + live.map(schedCard).join("") + "</div>";
    if (past.length) h += '<details class="past"><summary>지난 공식 일정 ' + past.length + "건</summary><div class=\"sched-list\">" + past.map(schedCard).join("") + "</div></details>";
    h += '<p class="small muted">일정은 2026년 공고 기준이에요. 종목마다 시행 회차가 다를 수 있으니 접수 전에 사이트에서 한 번 더 확인해 주세요.</p></section>';
    var doneMine = mine.filter(function (e) { return e.date < today() || e.done; }).reverse();
    if (doneMine.length) h += '<details class="past"><summary>지난 내 시험 ' + doneMine.length + '건</summary><div class="list">' + doneMine.map(myExamRow).join("") + "</div></details>";
    return h;
  }
  function schedCard(e) {
    var s = schedStatus(e), site = siteOf(e), i = C.SCHEDULE.indexOf(e);
    return '<article class="sched ' + s.key + '"><div class="sched-top"><span class="pill ' + s.key + '">' + esc(s.label) + '</span><span class="chips inline">' + e.certs.map(function (id) { return '<span class="chip static">' + dot(id) + esc(certShort(id)) + "</span>"; }).join("") + "</span></div>" +
      "<h3>" + esc(e.title) + "</h3>" +
      '<dl class="sched-dl"><dt>원서접수</dt><dd>' + (e.reg ? range(e.reg[0], e.reg[1]) : esc(e.regText || "")) + "</dd>" +
      "<dt>시험</dt><dd>" + (e.exam ? range(e.exam[0], e.exam[1]) : esc(e.examText || "")) + "</dd>" +
      (e.result ? '<dt>발표</dt><dd>' + fmtShort(e.result) + "</dd>" : "") + "</dl>" +
      (e.note ? '<p class="small muted">' + esc(e.note) + "</p>" : "") +
      '<div class="row sched-acts"><a class="btn sm ' + (s.open ? "omr" : "") + '" href="' + site.url + '" target="_blank" rel="noopener" title="' + esc(site.name) + '">원서 접수 ↗</a>' +
      (e.exam && !e.est && !s.ended ? '<button class="btn sm ghost" data-act="sched-add" data-i="' + i + '">내 시험으로</button>' : "") + "</div></article>";
  }
  function myExamRow(e) {
    var d = parseYmd(e.date), past = e.date < today() || e.done;
    return '<div class="item' + (past ? " past" : "") + '"><div class="when"><b>' + (past ? (d.getMonth() + 1) + "/" + d.getDate() : dday(e.date)) + "</b><span>" + (past ? WD[d.getDay()] : (d.getMonth() + 1) + "/" + d.getDate() + " " + WD[d.getDay()]) + "</span></div>" +
      '<div class="grow"><div class="row tight">' + dot(e.certId) + "<h3>" + esc(certShort(e.certId)) + " " + esc(e.stage) + "</h3>" + (e.done ? '<span class="pill gray">결과 기록됨</span>' : "") + "</div>" +
      '<p class="sub num">' + fmtDate(e.date, true) + (e.time ? " · " + esc(e.time) : "") + (e.place ? " · " + esc(e.place) : "") + (e.memo ? " · " + esc(e.memo) : "") + "</p></div>" +
      '<div class="acts">' + (e.done ? "" : '<button class="btn sm" data-act="attempt-add" data-exam="' + e.id + '">결과</button>') + '<button class="btn sm ghost" data-act="exam-edit" data-id="' + e.id + '">수정</button></div></div>';
  }

  /* ================================================================
     이력
     ================================================================ */
  function resumeText() {
    var lic = myCertIds().filter(function (id) { return certStatus(id).key === "pass"; }).map(function (id) { var c = cert(id); return { c: c, d: (c.license && c.license.date) || certStatus(id).date }; }).sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    var half = myCertIds().filter(function (id) { return certStatus(id).key === "half"; });
    var t = "■ 자격 사항\n" + (lic.length ? lic.map(function (o) { return fmtDate(o.d) + "  " + o.c.name + " (" + o.c.org + ")" + (o.c.license && o.c.license.no ? "  자격번호 " + o.c.license.no : ""); }).join("\n") : "(취득 예정)");
    if (half.length) t += "\n\n■ 진행 중\n" + half.map(function (id) { return cert(id).name + " — " + certStatus(id).label; }).join("\n");
    return t;
  }
  function myHistHTML() {
    var ids = myCertIds(), passed = ids.filter(function (id) { return certStatus(id).key === "pass"; });
    var totalMin = M.logs.reduce(function (s, l) { return s + (+l.min || 0); }, 0), solved = 0; (function () { var d = engDays(); Object.keys(d).forEach(function (k) { solved += d[k]; }); })();
    var ev = [];
    M.attempts.forEach(function (a) { var e = evalAttempt(a); ev.push({ d: a.date, cls: e.pass ? "pass" : "fail", t: certShort(a.certId) + " " + a.stage + " " + (e.pass ? (e.grade || "합격") : "불합격"), s: "환산 " + e.total + "점" + (a.memo ? " · " + a.memo : "") }); });
    ids.forEach(function (id) { var c = cert(id); if (c.license) ev.push({ d: c.license.date, cls: "pass", t: c.name + " 최종 합격", s: c.org + (c.license.no ? " · 자격번호 " + c.license.no : "") }); });
    ev.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    var mocks = engHist().filter(function (x) { return x.r.kind === "exam" || !x.r.part; }).slice(0, 8);
    var h = '<section class="card resume"><div class="resume-head"><div class="seal">합격</div><div class="stack tight grow"><h2 class="h1s">' + (M.profile.name ? esc(M.profile.name) : "이름 미입력") + '</h2><p class="muted">' + (M.profile.intro ? esc(M.profile.intro) : "한 줄 소개를 적어 보세요") + "</p></div></div>" +
      '<div class="grid-4">' + stat(passed.length + "개", "취득 자격증") + stat(M.attempts.length + "회", "시험 도전") + stat(fmtMin(totalMin), "누적 공부") + stat(solved.toLocaleString() + "문제", "푼 문제") + "</div></section>";
    h += '<div class="grid-2"><section class="card stack"><h2 class="h2">타임라인</h2>' + (ev.length ? '<div class="timeline">' + ev.map(function (e) { return '<div class="tl ' + e.cls + '"><span class="d">' + fmtDate(e.d) + '</span><span class="m"><i></i></span><div class="c"><b>' + esc(e.t) + '</b><p class="small muted">' + esc(e.s) + "</p></div></div>"; }).join("") + "</div>" : '<p class="small muted">실제 시험 결과를 기록하면 여기에 쌓여요.</p>') + "</section>" +
      '<section class="card stack"><h2 class="h2">최근 모의고사</h2>' + (mocks.length ? '<div class="table-wrap"><table class="scores"><thead><tr><th class="l">날짜</th><th class="l">시험</th><th>점수</th><th>판정</th></tr></thead><tbody>' + mocks.map(function (m) { return '<tr><td class="l num">' + fmtShort(ymd(new Date(m.r.date))) + '</td><td class="l">' + esc(certShort(m.id)) + " · " + esc(m.r.title || "") + '</td><td class="num">' + (m.r.avg != null ? Math.round(m.r.avg) : "—") + "</td><td>" + (m.r.pass ? '<span class="pill pass">합격선</span>' : '<span class="pill fail">미달</span>') + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="small muted">공부 화면에서 회차 시험지나 실전 모의고사를 끝내면 점수가 쌓여요.</p>') + "</section></div>";
    h += '<section class="card stack"><h2 class="h2">이력서용 문구</h2><textarea class="copybox" id="resume-text" readonly aria-label="이력서용 문구">' + esc(resumeText()) + '</textarea><div class="row"><button class="btn primary" data-act="copy" data-target="resume-text">복사</button></div></section>';
    return h;
  }
  function myAcctHTML() {
    var h = '';
    var Lk = locks();
    h += '<section class="card stack"><h2 class="h2">관리자 · 잠금 해제 코드</h2><p class="small muted">' +
      (Lk.admin ? "관리자 인증됨 · 모든 기능이 열려 있어요." : (Lk.guest ? "게스트는 요약본·벼락치기를 쓸 수 없어요. 관리자 코드만 받을 수 있어요." : (Lk.cramDeny ? "관리자가 이 계정의 벼락치기 사용을 막아 두었어요." : Lk.cramAllow ? "관리자가 이 계정의 벼락치기를 열어 두었어요." : "벼락치기 코드나 관리자 코드를 넣으면 잠긴 기능이 열려요. " + (Lk.cram ? "지금 벼락치기는 잠겨 있어요." : "지금 벼락치기는 열려 있어요.")))) + "</p>" +
      (Lk.admin ? "" : '<div class="row"><div class="field grow"><input id="unlock-code" autocomplete="off" placeholder="코드 입력" aria-label="잠금 해제 코드"></div><button class="btn primary" data-act="code-unlock">확인</button></div>') + "</section>";
    if (isGuest()) {
      h += '<section class="card stack"><h2 class="h2">게스트</h2><p class="small">게스트로 둘러보는 중이에요. 기록은 이 기기에만 잠시 저장돼요. 회원가입하면 기록이 계정에 저장되고 핵심요약도 볼 수 있어요.</p><div class="row"><button class="btn primary" data-act="join">회원가입하기</button><button class="btn" data-act="logout">나가기</button></div></section>';
      return h;
    }
    h += '<section class="card stack"><h2 class="h2">계정</h2>' + (ST.mode === "cloud"
      ? '<p class="small">온라인 계정으로 로그인돼 있어요. 기록은 이 계정 공간에 저장돼서 다른 기기에서 열어도 그대로 보이고, 로그아웃해도 지워지지 않아요. 다른 사람이 이 링크를 열면 그 사람만의 빈 기록이 따로 생겨요.</p>'
      : ST.mode === "firebase" ? '<p class="small"><b>' + esc(ST.user.email || "") + '</b> 계정으로 로그인 중이에요. 기록은 온라인 저장소에 저장돼서 어느 기기에서 로그인해도 같은 기록이 보이고, 로그아웃해도 지워지지 않아요.</p>'
      : '<p class="small"><b>' + esc(ST.user.name) + '</b> 프로필로 로그인 중이에요. 기록은 이 기기의 브라우저에 저장돼요.</p>') +
      '<div class="row"><button class="btn" data-act="export-copy">백업 코드 복사</button><button class="btn" data-act="export-file">백업 파일 저장</button><button class="btn" data-act="import">백업 가져오기</button>' + (ST.mode === "firebase" && ST.profiles().length ? '<button class="btn" data-act="import-local">이 기기 옛 기록 가져오기</button>' : "") + '<span class="spacer"></span>' +
      '<button class="btn" data-act="logout">로그아웃</button>' + '<button class="btn danger" data-act="wipe" data-confirm>회원 탈퇴 (기록 모두 삭제)</button></div></section>';
    return h;
  }

  /* ----- 출석 · 포인트 · 등급 · 배지 -----
     포인트: 출석 1일 10P · 공부한 날 5P · 푼 문제 1P · 개념 단원 완료 5P · 최종 합격 300P */
  var TIERS = [
    { name: "새싹", min: 0, ic: "🌱", c: "#3C9A5F" }, { name: "연필", min: 200, ic: "✏️", c: "#C98A1B" },
    { name: "노트", min: 600, ic: "📒", c: "#2F6FD0" }, { name: "열공러", min: 1500, ic: "🔥", c: "#D9542B" },
    { name: "합격 예감", min: 3000, ic: "🎯", c: "#C42F57" }, { name: "패스 마스터", min: 6000, ic: "🏆", c: "#8A5A00" },
    { name: "전설", min: 12000, ic: "👑", c: "#6B3FB8" }];
  var BADGES = [
    { id: "first", ic: "✅", name: "첫 출석", how: "출석 체크 1번" },
    { id: "s7", ic: "🔥", name: "7일 연속", how: "7일 연속 출석" },
    { id: "s30", ic: "⚡", name: "30일 연속", how: "30일 연속 출석" },
    { id: "a30", ic: "📅", name: "출석 30일", how: "출석 30일" },
    { id: "a100", ic: "💯", name: "출석 100일", how: "출석 100일" },
    { id: "q1k", ic: "📚", name: "1,000문제", how: "문제 1,000개 풀기" },
    { id: "q5k", ic: "🧠", name: "5,000문제", how: "문제 5,000개 풀기" },
    { id: "concept", ic: "🎓", name: "개념 완주", how: "한 자격증의 개념학습 모든 단원 완료" },
    { id: "clean", ic: "✨", name: "오답 제로", how: "100문제 이상 풀고 남은 오답 0개" },
    { id: "pass", ic: "🏅", name: "첫 합격", how: "자격증 최종 합격 기록" }];
  function attendSet() { if (!M.attend) M.attend = {}; return M.attend; }
  function attendedToday() { return !!(M && M.attend && M.attend[today()]); }
  function streakOf(set, from) { var d = parseYmd(from || today()), n = 0; if (!set[ymd(d)]) d.setDate(d.getDate() - 1); while (set[ymd(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
  function bestStreak(set) { var ks = Object.keys(set).sort(), best = 0, run = 0, prev = null; ks.forEach(function (k) { run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1; if (run > best) best = run; prev = k; }); return best; }
  function myScore() {
    var at = attendSet(), aN = Object.keys(at).length, days = engDays(), sDays = 0, solved = 0, conc = 0, full = false, clean = false, passN = 0;
    var lg = {}; M.logs.forEach(function (l) { lg[l.date] = 1; }); Object.keys(days).forEach(function (k) { if (days[k] > 0) lg[k] = 1; }); sDays = Object.keys(lg).length;
    myCertIds().forEach(function (id) {
      var c = cert(id) || catalogCert(id) || {}, es = engStore(id) || {}, st = certStats(id), cd = Object.keys(es.concept || {}).length;
      solved += Object.keys(es.ans || {}).length; conc += cd; if (c.cn && cd >= c.cn) full = true; if (st.done >= 100 && !st.open) clean = true;
      if (certStatus(id).key === "pass") passN++;
    });
    var pts = aN * 10 + sDays * 5 + solved + conc * 5 + passN * 300, ti = 0;
    TIERS.forEach(function (t, i) { if (pts >= t.min) ti = i; });
    var streak = streakOf(at), best = bestStreak(at);
    var got = [];
    if (aN >= 1) got.push("first"); if (best >= 7) got.push("s7"); if (best >= 30) got.push("s30"); if (aN >= 30) got.push("a30"); if (aN >= 100) got.push("a100");
    if (solved >= 1000) got.push("q1k"); if (solved >= 5000) got.push("q5k"); if (full) got.push("concept"); if (clean) got.push("clean"); if (passN) got.push("pass");
    return { pts: pts, tier: TIERS[ti], next: TIERS[ti + 1] || null, attend: aN, studyDays: sDays, solved: solved, conc: conc, streak: streak, best: best, got: got, studied: lg };
  }
  function earnedBadges() { return myScore().got; }
  function badgeOf(id) { return BADGES.filter(function (b) { return b.id === id; })[0]; }
  function badgeChip(id) { var b = badgeOf(id); return b ? '<span class="bdg" title="' + esc(b.how) + '">' + b.ic + " " + esc(b.name) + "</span>" : ""; }
  function tierChip(t) { return t ? '<span class="tier" style="--tc:' + t.c + '">' + t.ic + " " + esc(t.name) + "</span>" : ""; }
  function tierByName(n) { return TIERS.filter(function (t) { return t.name === n; })[0]; }
  function avatarHTML(p, size) { p = p || {}; var nm = p.name || p.nick || "?"; return '<span class="av ' + (size || "") + '" style="background:' + esc(p.color || AV_COLOR[0]) + '">' + (p.emoji ? p.emoji : esc(nm.slice(0, 1))) + "</span>"; }
  function syncMember() {
    if (!ST.membersOn() || !M) return;
    var sc = myScore(), P = M.profile;
    ST.touchMember({ nick: P.name || "", emoji: P.emoji || "", color: P.color || "", badge: P.badge || "", level: sc.tier.name, points: sc.pts, attend: sc.attend, streak: sc.streak });
  }
  function doAttend() {
    if (isGuest()) { toast("게스트는 출석 체크를 할 수 없어요"); return; }
    if (attendedToday()) { toast("오늘은 이미 출석했어요"); return; }
    var before = myScore().tier.name; attendSet()[today()] = Date.now(); save();
    var sc = myScore(); syncMember(); render();
    toast(sc.tier.name !== before ? "출석 완료! 등급이 " + sc.tier.ic + " " + sc.tier.name + "(으)로 올랐어요" : "출석 완료! +10P · " + sc.streak + "일 연속");
  }
  function myHeadHTML(sc) {
    var P = M.profile, nm = P.name || (ST.user && ST.user.name) || "나", nx = sc.next;
    var pct = nx ? Math.round((sc.pts - sc.tier.min) / (nx.min - sc.tier.min) * 100) : 100;
    return '<section class="card my-head"><div class="my-id">' + avatarHTML({ name: nm, emoji: P.emoji, color: P.color }, "lg") +
      '<div class="grow"><div class="my-name"><b>' + esc(nm) + "</b>" + tierChip(sc.tier) + badgeChip(P.badge) + (isAdmin() ? '<span class="pill pass">관리자</span>' : "") + "</div>" +
      '<p class="small muted">' + esc(P.intro || "한 줄 소개를 적어 보세요") + "</p></div>" +
      (isGuest() ? "" : '<button class="btn sm" data-act="profile">프로필 수정</button>') + "</div>" +
      '<div class="my-lv"><div class="row"><span class="small"><b>' + sc.pts.toLocaleString() + "P</b>" + (nx ? " · 다음 등급 " + nx.ic + " " + esc(nx.name) + "까지 " + (nx.min - sc.pts).toLocaleString() + "P" : " · 최고 등급이에요") + '</span></div><i><em style="width:' + pct + '%;background:' + sc.tier.c + '"></em></i></div>' +
      '<div class="my-att"><div><b>' + sc.attend + '</b><span>출석</span></div><div><b>' + sc.streak + '</b><span>연속</span></div><div><b>' + sc.best + '</b><span>최고 연속</span></div><div><b>' + sc.got.length + '</b><span>배지</span></div>' +
      (isGuest() ? "" : attendedToday() ? '<span class="att-done">✓ 오늘 출석 완료</span>' : '<button class="btn primary att-btn" data-act="attend">출석 체크</button>') + "</div></section>";
  }
  function myAttendHTML(sc) {
    var at = attendSet(), base = ui.calMonth || today().slice(0, 7), y = +base.slice(0, 4), m = +base.slice(5, 7);
    var first = new Date(y, m - 1, 1), dim = new Date(y, m, 0).getDate(), lead = first.getDay(), cells = "", cnt = 0;
    for (var i = 0; i < lead; i++) cells += "<span></span>";
    for (var d = 1; d <= dim; d++) {
      var k = y + "-" + pad(m) + "-" + pad(d), a = !!at[k], st = !!sc.studied[k]; if (a) cnt++;
      cells += '<span class="cal-d' + (a ? " att" : "") + (st ? " st" : "") + (k === today() ? " now" : "") + '"><b>' + d + "</b>" + (a ? "<i>출석</i>" : st ? "<em></em>" : "") + "</span>";
    }
    var h = '<div class="att-grid"><section class="card stack"><div class="row"><button class="btn sm ghost" data-act="cal-move" data-v="-1" aria-label="이전 달">‹</button><h2 class="h2 grow center">' + y + "년 " + m + '월</h2><button class="btn sm ghost" data-act="cal-move" data-v="1" aria-label="다음 달">›</button></div>' +
      '<div class="cal"><span class="dow">일</span><span class="dow">월</span><span class="dow">화</span><span class="dow">수</span><span class="dow">목</span><span class="dow">금</span><span class="dow">토</span>' + cells + "</div>" +
      '<p class="small muted center">이번 달 출석 ' + cnt + "일 · <span class=\"cal-key att\"></span> 출석 · <span class=\"cal-key st\"></span> 공부한 날</p></section>";
    h += '<section class="card stack"><h2 class="h2">등급</h2><div class="tiers">' + TIERS.map(function (t) {
      var on = t.name === sc.tier.name, done = sc.pts >= t.min;
      return '<div class="tier-row' + (on ? " on" : "") + (done ? " done" : "") + '" style="--tc:' + t.c + '"><span class="ic">' + t.ic + "</span><b>" + esc(t.name) + "</b><span class=\"small muted\">" + t.min.toLocaleString() + "P~</span>" + (on ? '<span class="pill">지금</span>' : "") + "</div>";
    }).join("") + '</div><p class="small muted">출석 1일 10P · 공부한 날 5P · 푼 문제 1P · 개념 단원 완료 5P · 최종 합격 300P</p></section>';
    h += '<section class="card stack"><h2 class="h2">배지 <span class="muted small">' + sc.got.length + "/" + BADGES.length + '</span></h2><div class="badges">' + BADGES.map(function (b) {
      var has = sc.got.indexOf(b.id) > -1;
      return '<div class="badge-cell' + (has ? " has" : "") + '"><span class="ic">' + b.ic + "</span><b>" + esc(b.name) + "</b><span>" + esc(b.how) + "</span></div>";
    }).join("") + '</div><p class="small muted">얻은 배지는 프로필 수정에서 대표 배지로 이름 옆에 달 수 있어요.</p></section></div>';
    return h;
  }

  /* ----- 마이 페이지: 맞춤 학습 · 합격 이력 · 코드·계정 · 회원 관리(관리자) ----- */
  function renderRecord() {
    var tabsDef = [["fit", "맞춤 학습"], ["att", "출석·등급"], ["hist", "합격 이력"], ["acct", "코드·계정"]];
    if (isAdmin() && ST.membersOn()) tabsDef.push(["admin", "회원 관리"]);
    var t = ui.myTab || "fit"; if (!tabsDef.some(function (x) { return x[0] === t; })) t = "fit";
    var sc = myScore();
    var h = '<div class="page-head"><div><h1>마이 페이지</h1></div></div>' + myHeadHTML(sc);
    h += '<div class="my-tabs" role="tablist" style="--n:' + tabsDef.length + '">' + tabsDef.map(function (x) {
      return '<button role="tab" aria-selected="' + (x[0] === t) + '" class="' + (x[0] === t ? "on" : "") + '" data-act="my-tab" data-v="' + x[0] + '">' + x[1] + "</button>";
    }).join("") + "</div>";
    if (t === "fit") h += myFitHTML();
    else if (t === "att") h += myAttendHTML(sc);
    else if (t === "hist") h += myHistHTML();
    else if (t === "acct") h += myAcctHTML();
    else h += myAdminHTML();
    return h;
  }
  function nextExamOf(id) { return M.exams.filter(function (e) { return e.certId === id && e.date >= today() && !e.done; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0]; }
  function fitPlan(id) {
    var st = certStats(id), c = cert(id) || catalogCert(id) || {}, es = engStore(id) || {}, cn = c.cn || 0, cd = Object.keys(es.concept || {}).length;
    var nx = nextExamOf(id), days = nx ? daysBetween(today(), nx.date) : null;
    var A = { custom: ["맞춤학습", "home", "custom"], today: ["오늘의 문제", "home", "today"], concept: ["개념 이어서", "concept"], sum: ["요약본", "sum"], cram: ["벼락치기", "cram"], notes: ["오답노트" + (st.open ? " " + st.open : ""), "notes"], exam: ["실전 모의고사", "home"] };
    var p;
    if (!st.total) p = { t: "먼저 문제를 넣어요", d: "직접 추가한 자격증이라 [공부 → 내 문제]에 문제를 넣으면 맞춤 학습을 추천해 드려요.", a: [] };
    else if (days != null && days <= 14) p = { t: "시험 " + (days ? "D-" + days : "D-DAY") + " · 마무리 모드", d: "새 단원보다 요약본으로 전체를 훑고, 벼락치기와 남은 오답 정리에 집중해요.", a: [A.sum, A.cram, A.notes] };
    else if (st.done < 30) p = { t: "먼저 감 잡기", d: "아직 푼 문제가 " + st.done + "개예요. 개념학습으로 단원을 익히면서 오늘의 문제로 가볍게 시작해요.", a: cn ? [A.concept, A.today] : [A.today, A.sum] };
    else if (st.open >= 10) p = { t: "오답부터 줄이기", d: "아직 못 맞힌 오답이 " + st.open + "개 있어요. 오답노트로 먼저 줄이고, 맞춤학습으로 약한 주제를 다시 잡아요.", a: [A.notes, A.custom] };
    else if (cn && cd < cn / 2) p = { t: "개념 채우기", d: "개념학습을 " + cd + "/" + cn + "단원 마쳤어요. 남은 단원을 이어서 보면 문제 정답률이 더 올라가요.", a: [A.concept, A.custom] };
    else if (st.rate != null && st.rate < 60) p = { t: "약한 주제 집중", d: "정답률이 " + st.rate + "%예요. 맞춤학습이 정답률 낮은 주제부터 10문제씩 골라 줘요.", a: [A.custom, A.notes] };
    else p = { t: "실전 감각 유지", d: "정답률 " + (st.rate == null ? "-" : st.rate + "%") + "로 좋아요. 실전 모의고사로 시간 안에 푸는 연습을 해요.", a: [A.exam, A.custom] };
    return { st: st, cn: cn, cd: cd, nx: nx, days: days, plan: p, all: [A.custom, A.today, cn ? A.concept : null, A.notes].filter(Boolean) };
  }
  function myFitHTML() {
    var ids = myCertIds();
    if (!ids.length) return '<div class="empty">준비할 자격증을 먼저 골라 주세요.</div>';
    var h = '<p class="small muted my-lead">푼 문제·오답·개념 진도·시험 날짜를 보고 지금 할 공부를 골라 드려요.</p><div class="fit-grid">';
    ids.forEach(function (id) {
      var f = fitPlan(id), st = f.st, pct = function (a, b) { return b ? Math.min(100, Math.round(a / b * 100)) : 0; };
      var btn = function (x, main) { return '<button class="btn sm' + (main ? " primary" : "") + '" data-act="eng" data-id="' + id + '" data-tab="' + x[1] + '"' + (x[2] ? ' data-sview="' + x[2] + '"' : "") + (st.total ? "" : " disabled") + ">" + esc(x[0]) + "</button>"; };
      h += '<section class="card fit-card"><div class="row"><b class="fit-name">' + dot(id) + esc(certShort(id)) + '</b><span class="spacer"></span>' + (f.nx ? '<span class="pill">' + esc(f.nx.stage || "시험") + " " + dday(f.nx.date) + "</span>" : '<span class="small muted">시험 날짜 없음</span>') + "</div>" +
        '<div class="fit-meters">' +
        '<div><span>정답률</span><b>' + (st.rate == null ? "—" : st.rate + "%") + '</b><i><em style="width:' + (st.rate || 0) + '%"></em></i></div>' +
        '<div><span>푼 문제</span><b>' + st.done.toLocaleString() + '<small>/' + (st.total || 0).toLocaleString() + '</small></b><i><em style="width:' + pct(st.done, st.total) + '%"></em></i></div>' +
        '<div><span>남은 오답</span><b>' + st.open + '</b><i><em class="bad" style="width:' + pct(st.open, Math.max(st.wrong, 1)) + '%"></em></i></div>' +
        '<div><span>개념학습</span><b>' + (f.cn ? f.cd + "<small>/" + f.cn + "</small>" : "—") + '</b><i><em class="ok" style="width:' + pct(f.cd, f.cn) + '%"></em></i></div></div>' +
        '<div class="fit-plan"><p class="eyebrow">지금 추천</p><b>' + esc(f.plan.t) + "</b><p>" + esc(f.plan.d) + '</p><div class="row wrap">' + f.plan.a.map(function (x, i) { return btn(x, i === 0); }).join("") + "</div></div>" +
        '<div class="fit-more">' + f.all.map(function (x) { return btn(x, false); }).join("") + "</div></section>";
    });
    return h + "</div>";
  }
  function renderBlocked() {
    return '<section class="card stack blocked-card"><p class="eyebrow">이용 제한</p><h1>관리자가 이 계정의 이용을 제한했어요</h1><p class="muted">지금은 공부 화면과 기록을 쓸 수 없어요. 제한이 풀리면 다시 로그인했을 때 그대로 이어서 쓸 수 있어요.</p>' +
      '<div class="row wrap"><button class="btn primary" data-act="perm-check">다시 확인</button><button class="btn" data-act="logout">로그아웃</button><button class="btn danger" data-act="wipe" data-confirm>회원 탈퇴</button></div></section>';
  }
  function fmtTime(ms) { if (!ms) return "—"; var d = new Date(ms); return ymd(d).slice(2).replace(/-/g, ".") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function myAdminHTML() {
    if (!isAdmin()) return '<div class="empty">관리자만 볼 수 있어요.</div>';
    if (ui.members === "loading") return '<div class="empty">회원 목록을 불러오는 중…</div>';
    if (ui.members === "error") return '<section class="card stack"><h2 class="h2">회원 목록을 못 불러왔어요</h2><p class="small">' + (ST.mode === "firebase" ? "Firebase 콘솔 → Firestore → 규칙에 회원 관리 규칙을 넣었는지 확인해 주세요 (README의 ‘회원 관리 규칙’)." : "잠시 후 다시 시도해 주세요.") + '</p><div class="row"><button class="btn" data-act="mem-reload">다시 불러오기</button></div></section>';
    if (!ui.members) { ui.members = "loading"; loadMembers(); return '<div class="empty">회원 목록을 불러오는 중…</div>'; }
    var L = ui.members, f = ui.memFilter || "all", q = (ui.memQ || "").trim().toLowerCase();
    var cnt = { all: L.length, allow: 0, deny: 0, block: 0 };
    L.forEach(function (m) { if (m.perm.cram === "allow") cnt.allow++; if (m.perm.cram === "deny") cnt.deny++; if (m.perm.block) cnt.block++; });
    var list = L.filter(function (m) { return f === "all" || (f === "block" ? m.perm.block : m.perm.cram === f); })
      .filter(function (m) { return !q || ((m.name || "") + " " + (m.email || "")).toLowerCase().indexOf(q) > -1; })
      .sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
    var h = '<section class="card stack"><div class="row"><h2 class="h2 grow">회원 관리</h2><button class="btn sm" data-act="mem-reload">새로고침</button></div>' +
      '<p class="small muted">벼락치기 — <b>기본</b>: 코드를 넣어야 열림 · <b>허용</b>: 코드 없이 바로 열림 · <b>차단</b>: 코드를 넣어도 못 씀. <b>이용 제한</b>을 켜면 그 회원은 로그인해도 공부 화면과 기록을 못 써요.</p>' +
      '<div class="mem-filter">' + [["all", "전체"], ["allow", "벼락치기 허용"], ["deny", "벼락치기 차단"], ["block", "이용 제한"]].map(function (x) {
        return '<button class="' + (f === x[0] ? "on" : "") + '" data-act="mem-filter" data-v="' + x[0] + '">' + x[1] + " <b>" + cnt[x[0]] + "</b></button>";
      }).join("") + "</div>" +
      '<input class="mem-q" id="mem-q" type="search" placeholder="이름·이메일 검색" value="' + esc(ui.memQ || "") + '" aria-label="회원 검색"></section>';
    h += '<div class="mem-list">' + (list.length ? list.map(function (m) {
      var me = m.id === ST._uid, pm = m.perm || {}, cv = pm.cram || "", nm = m.nick || m.name || (me ? (M.profile.name || "나") : "이름 없음");
      return '<article class="card mem-row' + (pm.block ? " is-block" : "") + '"><div class="mem-who">' + avatarHTML({ name: nm, emoji: m.emoji, color: m.color }) + '<div class="grow"><div class="my-name"><b>' + esc(nm) + "</b>" + tierChip(tierByName(m.level)) + badgeChip(m.badge) + (me ? '<span class="pill pass">나 · 관리자</span>' : "") + (pm.block ? '<span class="pill fail">이용 제한</span>' : "") + "</div>" +
        '<p class="small muted">' + (m.email ? esc(m.email) + " · " : "") + "출석 " + (m.attend || 0) + "일 · " + (m.points || 0).toLocaleString() + "P · 가입 " + fmtTime(m.joined).slice(0, 8) + " · 최근 " + fmtTime(m.last) + "</p></div></div>" +
        '<div class="mem-ctl"><span class="small">벼락치기</span><div class="mem-seg">' + [["", "기본"], ["allow", "허용"], ["deny", "차단"]].map(function (x) {
          return '<button class="' + (cv === x[0] ? "on " + (x[0] || "def") : "") + '" data-act="mem-cram" data-id="' + esc(m.id) + '" data-v="' + x[0] + '"' + (me ? " disabled" : "") + ">" + x[1] + "</button>";
        }).join("") + '</div><button class="btn sm ' + (pm.block ? "primary" : "danger-ghost") + '" data-act="mem-block" data-id="' + esc(m.id) + '"' + (me ? " disabled" : "") + ">" + (pm.block ? "제한 풀기" : "이용 제한") + "</button></div></article>";
    }).join("") : '<div class="empty">조건에 맞는 회원이 없어요.</div>') + "</div>";
    h += '<p class="small muted center">회원 명부는 각 회원이 로그인할 때 자동으로 생겨요. ' + (ST.mode === "cloud" ? "앱 링크에서는 이 링크를 연 사람만 보여요." : "GitHub(Firebase)으로 가입한 회원이 보여요.") + "</p>";
    return h;
  }
  function loadMembers() {
    ST.listMembers().then(function (L) { ui.members = L; if (view === "record") render(); }, function () { ui.members = "error"; if (view === "record") render(); });
  }
  function memSet(id, patch) {
    if (!Array.isArray(ui.members)) return;
    var m = ui.members.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    var before = Object.assign({}, m.perm), next = Object.assign({}, m.perm, patch);
    m.perm = next; render();
    ST.setPerm(id, next).then(function () { toast("저장했어요"); }, function () { m.perm = before; render(); toast("저장하지 못했어요. 관리자 권한 규칙을 확인해 주세요"); });
  }

  /* ================================================================
     입력 폼들
     ================================================================ */
  function certOptions(sel) { return myCertIds().map(function (id) { return '<option value="' + id + '"' + (id === sel ? " selected" : "") + ">" + esc(cert(id).name) + "</option>"; }).join(""); }
  function stageOptions(id, sel) { var c = cert(id); return c ? c.stages.map(function (s) { return "<option" + (s.name === sel ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") : ""; }
  function actions(isNew, delAct, delId, saveLabel) {
    return '<div class="form-actions">' + (isNew ? "" : '<button type="button" class="btn danger" data-act="' + delAct + '" data-id="' + delId + '" data-confirm>삭제</button><span class="spacer"></span>') +
      '<button type="button" class="btn ghost" data-close>취소</button><button class="btn primary">' + (saveLabel || "저장") + "</button></div>";
  }

  function attemptForm(a, opts) {
    opts = opts || {}; var isNew = !a;
    if (isNew) {
      var ex = opts.examId ? M.exams.filter(function (e) { return e.id === opts.examId; })[0] : null;
      var cid = (ex && ex.certId) || opts.certId || studyCert || myCertIds()[0];
      a = { id: "", certId: cid, stage: ex ? ex.stage : cert(cid).stages[0].name, date: ex ? ex.date : today(), scores: [], memo: "" };
    }
    var h = '<form class="form" id="f-att">' + fld("자격증", '<select id="at-cert">' + certOptions(a.certId) + "</select>") + fld("단계", '<select id="at-stage">' + stageOptions(a.certId, a.stage) + "</select>") +
      fld("응시일", '<input id="at-date" type="date" required value="' + esc(a.date) + '">') + '<div class="full" id="at-scores"></div>' +
      fld("메모", '<input id="at-memo" value="' + esc(a.memo || "") + '" placeholder="느낀 점, 다음에 보강할 부분">', "full") + '<div class="full notice" id="at-prev"></div>' + actions(isNew, "attempt-del", a.id) + "</form>";
    openModal(isNew ? "시험 결과 기록" : "시험 결과 수정", h, function () {
      var cur = clone(a);
      function draw() {
        var c = cert(cur.certId), st = c.stages.filter(function (s) { return s.name === cur.stage; })[0] || c.stages[0], subs = st.subjects.length ? st.subjects : ["총점"];
        $("#at-scores").innerHTML = '<div class="form">' + subs.map(function (s, i) { return fld(esc(s) + " 점수", '<input id="at-s-' + i + '" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="' + (cur.scores[i] != null ? esc(cur.scores[i]) : "") + '">'); }).join("") + "</div>";
        prev();
      }
      function read() { return $all("#at-scores input").map(function (i) { return i.value === "" ? "" : +i.value; }); }
      function prev() {
        cur.scores = read(); var ev = evalAttempt(cur), st = ev.stage, box = $("#at-prev");
        if (!cur.scores.some(function (x) { return x !== ""; })) { box.className = "full notice"; box.textContent = "점수를 넣으면 합격 여부를 바로 계산해요."; return; }
        box.className = "full notice" + (ev.pass ? "" : " warn");
        box.textContent = "환산 " + ev.total + "점 → " + (ev.pass ? (ev.grade || "합격") : "불합격") + (ev.under.length ? " (과락: " + ev.under.map(function (i) { return ev.subjects[i]; }).join(", ") + ")" : ev.pass ? "" : " · 합격까지 " + round1(st.passMin - ev.total) + "점");
      }
      $("#at-cert").onchange = function () { cur.certId = this.value; cur.stage = cert(cur.certId).stages[0].name; cur.scores = []; $("#at-stage").innerHTML = stageOptions(cur.certId, cur.stage); draw(); };
      $("#at-stage").onchange = function () { cur.stage = this.value; cur.scores = []; draw(); };
      $("#at-scores").oninput = prev; draw();
      $("#f-att").onsubmit = function (e) {
        e.preventDefault(); cur.scores = read(); cur.date = $("#at-date").value; cur.memo = $("#at-memo").value.trim();
        if (isNew) { cur.id = uid("a"); M.attempts.push(cur); } else M.attempts = M.attempts.map(function (x) { return x.id === cur.id ? cur : x; });
        if (opts.examId) M.exams.forEach(function (x) { if (x.id === opts.examId) x.done = true; });
        save(); closeModal(); render(); toast(evalAttempt(cur).pass ? "합격 축하해요! 이력에 기록했어요" : "기록했어요. 다음엔 꼭 붙어요");
      };
    });
  }
  function licenseForm(id) {
    var e = myEntry(id), L = e.license || { date: today(), no: "", memo: "" };
    openModal(cert(id).name + " 최종 합격", '<form class="form" id="f-lic"><p class="full small muted">자격 취득 정보를 남기면 이력 페이지와 이력서 문구에 정리돼요.</p>' +
      fld("취득일", '<input id="li-date" type="date" required value="' + esc(L.date) + '">') + fld("자격번호 (선택)", '<input id="li-no" value="' + esc(L.no || "") + '">') +
      fld("메모", '<input id="li-memo" value="' + esc(L.memo || "") + '">', "full") + actions(!e.license, "license-del", id) + "</form>", function () {
      $("#f-lic").onsubmit = function (ev) { ev.preventDefault(); e.license = { date: $("#li-date").value, no: $("#li-no").value.trim(), memo: $("#li-memo").value.trim() }; save(); closeModal(); render(); toast("최종 합격을 등록했어요"); };
    });
  }
  function examForm(e, preset) {
    var isNew = !e;
    e = e || preset || { certId: studyCert || myCertIds()[0], stage: "", date: today(), time: "", place: "", memo: "" };
    if (!e.stage) e.stage = cert(e.certId).stages[0].name;
    openModal(isNew ? "내 시험 추가" : "내 시험 수정", '<form class="form" id="f-ex">' + fld("자격증", '<select id="ex-cert">' + certOptions(e.certId) + "</select>") + fld("단계", '<select id="ex-stage">' + stageOptions(e.certId, e.stage) + "</select>") +
      fld("날짜", '<input id="ex-date" type="date" required value="' + esc(e.date) + '">') + fld("시간", '<input id="ex-time" type="time" value="' + esc(e.time || "") + '">') +
      fld("장소", '<input id="ex-place" value="' + esc(e.place || "") + '" placeholder="예: 춘천 상공회의소">', "full") + fld("메모", '<input id="ex-memo" value="' + esc(e.memo || "") + '" placeholder="준비물, 수험번호 등">', "full") + actions(isNew, "exam-del", e.id) + "</form>", function () {
      $("#ex-cert").onchange = function () { $("#ex-stage").innerHTML = stageOptions(this.value); };
      $("#f-ex").onsubmit = function (ev) {
        ev.preventDefault(); var o = isNew ? { id: uid("e") } : e;
        o.certId = $("#ex-cert").value; o.stage = $("#ex-stage").value; o.date = $("#ex-date").value; o.time = $("#ex-time").value; o.place = $("#ex-place").value.trim(); o.memo = $("#ex-memo").value.trim();
        if (isNew) M.exams.push(o); save(); closeModal(); render(); toast("내 시험에 저장했어요");
      };
    });
  }
  function logForm() {
    openModal("공부 기록", '<form class="form" id="f-log">' + fld("날짜", '<input id="lg-date" type="date" required value="' + today() + '">') + fld("자격증", '<select id="lg-cert">' + certOptions(studyCert) + "</select>") +
      fld("공부 시간 (분)", '<input id="lg-min" type="number" min="1" max="1440" required value="60" inputmode="numeric">') + fld("한 일", '<input id="lg-memo" placeholder="예: 엑셀 함수 요약 정리">') + actions(true, "", "", "기록") + "</form>", function () {
      $("#f-log").onsubmit = function (e) { e.preventDefault(); M.logs.push({ id: uid("l"), date: $("#lg-date").value, certId: $("#lg-cert").value, min: +$("#lg-min").value, memo: $("#lg-memo").value.trim() }); save(); closeModal(); render(); toast("공부 기록을 남겼어요"); };
    });
  }
  var AV_EMOJI = ["🙂", "😎", "🦊", "🐻", "🐰", "🐱", "🐶", "🐼", "🦉", "🐳", "🌷", "🌙", "⭐", "🍀", "☕", "📐"];
  var AV_COLOR = ["#E9EEF8", "#FBE6EC", "#DDF2E8", "#FFF1D6", "#EDE4FA", "#E2F3F7"];
  function profileForm() {
    var P = M.profile, em = P.emoji || "", co = P.color || AV_COLOR[0], bd = P.badge || "", got = earnedBadges();
    openModal("프로필 수정", '<form class="form" id="f-pf"><div class="full pf-preview" id="pf-prev"></div>' +
      fld("닉네임", '<input id="pf-name" required maxlength="12" value="' + esc(P.name || "") + '" placeholder="앱에서 부를 이름">', "full") +
      fld("한 줄 소개", '<input id="pf-intro" maxlength="40" value="' + esc(P.intro || "") + '" placeholder="예: 올해 자격증 두 개 도전 중">', "full") +
      '<div class="full field"><span class="lbl">프로필 아이콘</span><div class="pf-emoji" id="pf-emoji"><button type="button" data-v="" class="' + (em ? "" : "on") + '">글자</button>' + AV_EMOJI.map(function (x) { return '<button type="button" data-v="' + x + '" class="' + (em === x ? "on" : "") + '">' + x + "</button>"; }).join("") + "</div></div>" +
      '<div class="full field"><span class="lbl">배경색</span><div class="pf-color" id="pf-color">' + AV_COLOR.map(function (x) { return '<button type="button" data-v="' + x + '" class="' + (co === x ? "on" : "") + '" style="background:' + x + '" aria-label="배경색"></button>'; }).join("") + "</div></div>" +
      '<div class="full field"><span class="lbl">대표 배지 <small class="muted">· 얻은 배지 중 하나를 이름 옆에 달아요</small></span><div class="pf-badge" id="pf-badge"><button type="button" data-v="" class="' + (bd ? "" : "on") + '">달지 않기</button>' +
      BADGES.map(function (x) { var has = got.indexOf(x.id) > -1; return '<button type="button" data-v="' + x.id + '" class="' + (bd === x.id ? "on" : "") + '"' + (has ? "" : " disabled") + ' title="' + esc(x.how) + '">' + x.ic + " " + esc(x.name) + "</button>"; }).join("") + "</div></div>" +
      actions(true) + "</form>", function () {
      var cur = { emoji: em, color: co, badge: bd };
      var prev = function () { var nm = $("#pf-name").value.trim() || "나"; $("#pf-prev").innerHTML = avatarHTML({ name: nm, emoji: cur.emoji, color: cur.color }, "lg") + '<div><b>' + esc(nm) + "</b> " + badgeChip(cur.badge) + '<p class="small muted">' + esc($("#pf-intro").value.trim() || "한 줄 소개") + "</p></div>"; };
      [["pf-emoji", "emoji"], ["pf-color", "color"], ["pf-badge", "badge"]].forEach(function (g) {
        $("#" + g[0]).onclick = function (e) { var x = e.target.closest("button"); if (!x || x.disabled) return; cur[g[1]] = x.dataset.v; $all("#" + g[0] + " button").forEach(function (y) { y.classList.toggle("on", y === x); }); prev(); };
      });
      $("#pf-name").oninput = $("#pf-intro").oninput = prev; prev();
      $("#f-pf").onsubmit = function (e) {
        e.preventDefault(); var nm = $("#pf-name").value.trim(); if (!nm) return;
        M.profile.name = nm; M.profile.intro = $("#pf-intro").value.trim(); M.profile.emoji = cur.emoji; M.profile.color = cur.color; M.profile.badge = cur.badge;
        save(); if (ST.setNick) ST.setNick(nm); syncMember(); closeModal(); render(); toast("프로필을 바꿨어요");
      };
    });
  }
  function certsManage() {
    var ids = myCertIds();
    openModal("내 자격증", '<p class="small muted">공부할 자격증을 켜고 끄세요. 모두 끄고 저장하면 처음 고르기 화면으로 돌아가요. 끈 자격증의 풀이 기록은 지워지지 않고 남아요.</p><div class="stack" style="margin-top:12px">' + C.certs.map(function (c) {
      return '<label class="check row-check"><input type="checkbox" data-cid="' + c.id + '"' + (ids.indexOf(c.id) > -1 ? " checked" : "") + '><span class="dot" style="background:' + c.color + '"></span>' + esc(c.name) + "</label>";
    }).join("") + M.certs.filter(function (e) { return e.def; }).map(function (e) { return '<label class="check row-check"><input type="checkbox" data-cid="' + e.id + '" checked><span class="dot" style="background:' + e.def.color + '"></span>' + esc(e.def.name) + " (직접 추가)</label>"; }).join("") +
      '</div><div class="form-actions" style="margin-top:16px"><button type="button" class="btn danger" id="cm-reset">전부 비우고 다시 고르기</button><button type="button" class="btn" data-act="cert-custom">목록에 없는 자격증 추가</button><span class="spacer"></span><button type="button" class="btn primary" id="cm-save">저장</button></div>', function () {
      $("#cm-save").onclick = function () {
        var on = $all("[data-cid]").filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.cid; });
        M.hidden = M.hidden || {};
        M.certs.forEach(function (e) { if (on.indexOf(e.id) < 0) M.hidden[e.id] = e; });
        M.certs = M.certs.filter(function (e) { return on.indexOf(e.id) > -1; });
        on.forEach(function (id) { if (!myEntry(id)) M.certs.push(M.hidden[id] || { id: id, goal: "", license: null }); delete M.hidden[id]; });
        if (!on.length) { resetCerts(); return; }
        save(); closeModal(); render(); warmPacks();
      };
      $("#cm-reset").onclick = function () { if (!this.dataset.armed) { this.dataset.armed = "1"; this.textContent = "한 번 더 누르면 초기화"; return; } resetCerts(); };
    });
  }
  function resetCerts() { // 자격증 선택만 비우고 처음 고르기 화면으로 (공부 기록은 남김)
    M.hidden = M.hidden || {};
    M.certs.forEach(function (e) { M.hidden[e.id] = e; });
    M.certs = []; M.setup = false; ui.onboard = []; session = null; studyCert = null;
    save(); closeModal(); view = "home"; render(); window.scrollTo(0, 0); toast("자격증 선택을 비웠어요. 다시 골라 주세요");
  }
  function customCertForm() {
    openModal("자격증 직접 추가", '<form class="form" id="f-cc">' + fld("자격증 이름", '<input id="cc-name" required placeholder="예: 토익, 정보처리기사">', "full") + fld("시행 기관", '<input id="cc-org">') + fld("색", '<input id="cc-color" type="color" value="#4A6FA5">') +
      fld("과목 (쉼표로 구분)", '<input id="cc-subj" placeholder="예: LC, RC">', "full") + fld("과락 점수 (없으면 0)", '<input id="cc-min" type="number" value="0" min="0" max="100">') + fld("합격 점수", '<input id="cc-pass" type="number" value="60" min="0" max="100">') +
      fld("원서접수 사이트 (선택)", '<input id="cc-url" placeholder="https://">', "full") + actions(true, "", "", "추가") + "</form>", function () {
      $("#f-cc").onsubmit = function (e) {
        e.preventDefault();
        var id = uid("c"), subs = $("#cc-subj").value.split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
        var def = { id: id, name: $("#cc-name").value.trim(), short: $("#cc-name").value.trim().slice(0, 10), org: $("#cc-org").value.trim(), color: $("#cc-color").value, pack: null, url: $("#cc-url").value.trim(),
          stages: [{ name: "시험", subjects: subs, subjMin: +$("#cc-min").value || 0, passMin: +$("#cc-pass").value || 60 }] };
        M.certs.push({ id: id, goal: "", license: null, def: def });
        if (ui.onboard) ui.onboard.push(id);
        save(); closeModal(); render(); toast("자격증을 추가했어요");
      };
    });
  }
  function certSettings(id) {
    var c = cert(id), e = myEntry(id);
    var h = '<form class="form" id="f-cs">' + fld("목표·메모", '<input id="cs-goal" value="' + esc(c.goal || "") + '" placeholder="예: 11월 안에 필기 합격">', "full");
    c.stages.forEach(function (s, i) { h += fld(esc(s.name) + " 과목 (쉼표로 구분)", '<input id="cs-s' + i + '" value="' + esc(s.subjects.join(", ")) + '"' + (c.pack && i === 0 ? " disabled" : "") + ">", "full"); });
    h += (c.pack ? '<p class="full small muted">기출 데이터가 있는 자격증은 필기 과목이 고정돼요.</p>' : "") + actions(true) + "</form>";
    openModal(c.name + " 설정", h, function () {
      $("#f-cs").onsubmit = function (ev) {
        ev.preventDefault(); e.goal = $("#cs-goal").value.trim();
        var stages = clone(c.stages); stages.forEach(function (s, i) { var inp = $("#cs-s" + i); if (!inp.disabled) s.subjects = inp.value.split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean); });
        if (e.def) e.def.stages = stages; else e.stages = stages;
        save(); closeModal(); render(); toast("저장했어요");
      };
    });
  }
  function questionForm(qid) {
    var list = customList(), q = qid ? list.filter(function (x) { return x.id === qid; })[0] : null, isNew = !q;
    q = q || { certId: studyCert, s: 1, src: "", q: "", o: ["", "", "", ""], a: 0, e: "" };
    var subs = subjectsOf(q.certId);
    var h = '<form class="form" id="f-q">' + fld("과목", '<select id="qe-s">' + subs.slice(1).map(function (s, i) { return '<option value="' + (i + 1) + '"' + (q.s === i + 1 ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select>") +
      fld("출처 (선택)", '<input id="qe-src" value="' + esc(q.src) + '" placeholder="예: 2024년 1회 기출">') + fld("문제", '<textarea id="qe-q" required>' + esc(q.q) + "</textarea>", "full") +
      [0, 1, 2, 3].map(function (i) { return fld("보기 " + CIRCLE[i], '<input id="qe-o' + i + '" required value="' + esc(q.o[i] || "") + '">'); }).join("") +
      '<div class="field full"><label>정답</label>' + seg("qe-a", [0, 1, 2, 3].map(function (i) { return [String(i), CIRCLE[i]]; }), String(q.a)) + "</div>" +
      fld("해설", '<textarea id="qe-e">' + esc(q.e) + "</textarea>", "full") + actions(isNew, "q-del", q.id) + "</form>";
    openModal(isNew ? "문제 추가" : "문제 수정", h, function () {
      var a = q.a;
      $("#qe-a").onclick = function (ev) { var b = ev.target.closest("button"); if (!b) return; a = +b.dataset.v; $all("#qe-a button").forEach(function (x) { x.classList.toggle("on", x === b); }); };
      $("#f-q").onsubmit = function (ev) {
        ev.preventDefault();
        var o = isNew ? { id: uid("u"), certId: studyCert } : q;
        o.s = +$("#qe-s").value; o.src = $("#qe-src").value.trim(); o.q = $("#qe-q").value.trim(); o.o = [0, 1, 2, 3].map(function (i) { return $("#qe-o" + i).value.trim(); }); o.a = a; o.e = $("#qe-e").value.trim();
        if (isNew) list.push(o); ST.save("custom"); closeModal(); render(); toast(isNew ? "문제를 추가했어요" : "저장했어요");
      };
    });
  }
  function bulkForm() {
    var subs = subjectsOf(studyCert);
    openModal("여러 문제 한 번에 추가", '<form class="form" id="f-bulk"><p class="full small muted">한 줄에 한 문제, 칸은 <b>|</b>로 나눠요. 과목은 이름이나 번호(1, 2, …), 정답은 1~4. 해설은 생략해도 돼요.</p>' +
      '<pre class="full copybox pre-ex">과목 | 문제 | 보기1 | 보기2 | 보기3 | 보기4 | 정답 | 해설\n' + esc(subs[1] || "1") + ' | 문제 내용 | 가 | 나 | 다 | 라 | 2 | 해설 내용</pre>' +
      fld("출처 (선택)", '<input id="bk-src" placeholder="예: 2023년 2회 기출">', "full") + fld("문제 붙여넣기", '<textarea id="bk-text" style="min-height:180px" required></textarea>', "full") + actions(true, "", "", "추가") + "</form>", function () {
      $("#f-bulk").onsubmit = function (e) {
        e.preventDefault(); var src = $("#bk-src").value.trim(), ok = 0, bad = 0, list = customList();
        $("#bk-text").value.split(/\r?\n/).forEach(function (line) {
          if (!line.trim()) return;
          var p = line.split("|").map(function (x) { return x.trim(); }), a = parseInt(p[6], 10);
          if (p.length < 7 || !p[1] || !(a >= 1 && a <= 4)) { bad++; return; }
          var s = /^\d+$/.test(p[0]) ? +p[0] : Math.max(1, subs.indexOf(p[0]));
          list.push({ id: uid("u"), certId: studyCert, s: s, src: src, q: p[1], o: p.slice(2, 6), a: a - 1, e: p.slice(7).join(" | ") }); ok++;
        });
        ST.save("custom"); closeModal(); render(); toast(ok + "문제 추가" + (bad ? " · 형식이 안 맞는 " + bad + "줄은 건너뛰었어요" : ""));
      };
    });
  }
  function noteForm(key) {
    var n = notes();
    openModal("오답 메모", '<form class="form" id="f-n">' + fld("왜 틀렸는지, 외울 포인트", '<textarea id="nt-t" placeholder="예: MOD는 나누는 수 부호를 따름">' + esc(n[key] || "") + "</textarea>", "full") + actions(true) + "</form>", function () {
      $("#f-n").onsubmit = function (e) { e.preventDefault(); var v = $("#nt-t").value.trim(); if (v) n[key] = v; else delete n[key]; ST.save("notes"); closeModal(); render(); toast("메모를 저장했어요"); };
    });
  }
  function importForm() {
    openModal("백업 가져오기", '<form class="form" id="f-im"><p class="full small muted">패스메이트 백업 파일을 고르거나 백업 코드를 붙여 넣으세요. 지금 로그인한 계정의 기록이 백업 내용으로 바뀌어요.</p>' +
      fld("백업 파일", '<input id="im-file" type="file" accept=".json,application/json">', "full") + fld("또는 백업 코드", '<textarea id="im-text" style="min-height:140px"></textarea>', "full") + actions(true, "", "", "가져오기") + "</form>", function () {
      $("#im-file").onchange = function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { $("#im-text").value = r.result; }; r.readAsText(f); };
      $("#f-im").onsubmit = function (e) {
        e.preventDefault();
        try { ST.importAll(JSON.parse($("#im-text").value)); M = ST.get("main", defaultMain()); closeModal(); render(); warmPacks(); toast("백업을 가져왔어요"); }
        catch (err) { toast("패스메이트 백업 형식이 아니에요"); }
      };
    });
  }
  function copyText(text, el) {
    function fb() { if (el) { el.focus(); el.select(); } toast("선택된 글을 복사해 주세요 (Ctrl+C)"); }
    try { navigator.clipboard.writeText(text).then(function () { toast("복사했어요"); }, fb); } catch (e) { fb(); }
  }

  /* ================================================================
     렌더·이벤트
     ================================================================ */
  /* ================================================================
     공부 화면 — 컴활 1급 화면·문제 엔진을 패스메이트 안에 그대로 넣었어요.
     같은 페이지의 #study 안에서 돌고, 기록은 내 계정에 저장해요.
     ================================================================ */
  function engKey(id) { var c = cert(id) || catalogCert(id); return c && c.pack ? "eng-" + id : null; }
  function engStore(id) { var k = engKey(id); if (k) return ST.data[k] || null; var my = ST.data["eng-my"] || {}; return my[id] || null; }
  function setEngStore(id, v) { var k = engKey(id); if (k) { ST.data[k] = v; ST.save(k); } else { var my = ST.get("eng-my", {}); my[id] = v; ST.save("eng-my"); } }
  function qTotal(id) { var c = cert(id) || catalogCert(id); return c && c.qn ? c.qn : customFor(id).length; }
  function certStats(id) {
    var s = engStore(id), ans = (s && s.ans) || {}, done = 0, ok = 0, open = 0, wrong = 0;
    Object.keys(ans).forEach(function (k) { var r = ans[k]; done++; if (r.last === "r") ok++; if (r.w > 0) { wrong++; if (r.last === "w") open++; } });
    return { total: qTotal(id), done: done, rate: done ? Math.round(ok / done * 100) : null, open: open, wrong: wrong };
  }
  function engDays() { // 날짜별 푼 문제 수 (모든 자격증 합)
    var d = {};
    myCertIds().forEach(function (id) { var s = engStore(id); if (s && s.day) Object.keys(s.day).forEach(function (k) { var v = s.day[k]; d[k] = (d[k] || 0) + (v[0] || 0) + (v[1] || 0); }); });
    return d;
  }
  function studyStreak() {
    var days = engDays(); M.logs.forEach(function (l) { days[l.date] = (days[l.date] || 0) + 1; });
    var d = new Date(), n = 0; if (!days[ymd(d)]) d.setDate(d.getDate() - 1);
    while (days[ymd(d)]) { n++; d.setDate(d.getDate() - 1); } return n;
  }
  function statsCard() {
    var todaySolved = engDays()[today()] || 0;
    var open = 0; myCertIds().forEach(function (id) { open += certStats(id).open; });
    return '<section class="card stats-card">' + stat(fmtMin(minutesSince(7)), "최근 7일 공부") + stat(studyStreak() + "일", "연속 공부") + stat(todaySolved + "문제", "오늘 푼 문제") + stat(open + "개", "남은 오답") +
      '<div class="stat full"><span>최근 14일 공부 시간</span>' + studyChart() + "</div></section>";
  }
  function warmPacks() {}
  function homeCertCard(id) {
    var c = cert(id); if (!c) return "";
    var st = certStatus(id), s = certStats(id);
    var nx = M.exams.filter(function (e) { return e.certId === id && e.date >= today() && !e.done; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    var pct = s.total ? Math.round(s.done / s.total * 100) : 0;
    return '<article class="card cert-card"><div class="top">' + dot(id) + "<h3>" + esc(c.short || c.name) + "</h3>" + pill(st) + "</div>" +
      '<div class="steps" style="grid-template-columns:repeat(' + c.stages.length + ',1fr)">' + st.steps.map(function (on) { return "<i" + (on ? ' class="on"' : "") + "></i>"; }).join("") + "</div>" +
      '<div class="meta"><span>풀이 진도</span><b>' + s.done.toLocaleString() + " / " + s.total.toLocaleString() + "</b></div>" +
      '<div class="progress" title="' + pct + '%"><i style="width:' + pct + '%"></i></div>' +
      '<div class="meta"><span>정답률</span><b>' + (s.rate == null ? "—" : s.rate + "%") + "</b></div>" +
      '<div class="meta"><span>남은 오답</span><b>' + s.open + "</b></div>" +
      '<div class="meta"><span>내 시험</span><b>' + (nx ? dday(nx.date) : "—") + "</b></div>" +
      '<div class="meta"><span>난이도</span>' + (c.diff ? diffMeter(c.diff, false) : "<b>—</b>") + "</div>" +
      '<div class="foot"><button class="btn sm primary" data-act="eng" data-id="' + id + '" data-tab="home">공부하기</button><button class="btn sm" data-act="eng" data-id="' + id + '" data-tab="concept">개념학습</button><button class="btn sm" data-act="eng" data-id="' + id + '" data-tab="sum">' + (locks().sum ? "🔒 " : "") + '요약본</button></div></article>';
  }
  var LAUNCH = [["home", "문제풀기", "회차·모의고사·CBT", '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'],
    ["concept", "개념학습", "단원별로 차근차근", '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h7"/>'],
    ["sum", "요약본", "급할 때 빠르게", '<path d="M4 5h16M4 10h10M4 15h16M4 20h8"/>'],
    ["cram", "벼락치기", "정답 보며 훑기", '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'],
    ["notes", "오답노트", "틀린 문제 다시", '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12l6 6M15 12l-6 6"/>'],
    ["rec", "기록", "성적·학습 분석", '<path d="M5 20V10M12 20V4M19 20v-7"/>']];
  var LEGACY = { comp1: ["comhwal1_v1", "컴활 1급 앱"], arch: ["passmate_ar_v1", "예전 패스메이트(건축기사)"] };
  function legacyData(id) { var L = LEGACY[id]; if (!L) return null; try { var v = JSON.parse(localStorage.getItem(L[0]) || "null"); return v && v.ans && Object.keys(v.ans).length ? v : null; } catch (e) { return null; } }
  function renderStudy() {
    var ids = myCertIds();
    if (!studyCert || ids.indexOf(studyCert) < 0) studyCert = ids[0];
    var id = studyCert, c = cert(id), s = certStats(id), has = s.total > 0;
    var h = '<div class="cert-switch" role="tablist" aria-label="자격증">' + ids.map(function (x) {
      return '<button role="tab" aria-selected="' + (x === id) + '" class="chip' + (x === id ? " on" : "") + '" data-act="study" data-id="' + x + '">' + dot(x) + esc(certShort(x)) + "</button>";
    }).join("") + '<button class="chip add" data-act="certs-manage">＋ 자격증</button></div>';
    h += '<div class="page-head"><div><h1>' + esc(c.name) + "</h1><p>" + esc(c.org || "") + (c.goal ? " · 목표: " + esc(c.goal) : "") + "</p></div>" + pill(certStatus(id)) + "</div>";
    h += '<section class="card stack launch"><div class="row"><div class="grow"><p class="eyebrow">공부 화면</p><h2 class="h2">문제풀기 · 개념학습 · 요약본 · 벼락치기 · 오답노트 · 기록</h2></div>' +
      '<button class="btn omr" data-act="eng" data-id="' + id + '" data-tab="home"' + (has ? "" : " disabled") + ">공부 시작</button></div>" +
      '<div class="grid-4">' + stat(s.done.toLocaleString() + " / " + s.total.toLocaleString(), "푼 문제") + stat(s.rate == null ? "—" : s.rate + "%", "정답률") + stat(s.open + "개", "남은 오답") + stat((engDays()[today()] || 0) + "문제", "오늘 푼 문제") + "</div>" +
      '<div class="launch-grid">' + LAUNCH.map(function (l) {
        var lk = (l[0] === "cram" && locks().cram) || (l[0] === "sum" && locks().sum);
        return '<button class="launch-btn' + (lk ? " locked" : "") + '" data-act="eng" data-id="' + id + '" data-tab="' + l[0] + '"' + (has ? "" : " disabled") + (lk ? ' title="코드가 있어야 열려요"' : "") + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + l[3] + "</svg><b>" + l[1] + "</b><span>" + l[2] + "</span></button>";
      }).join("") + "</div>" +
      (has ? "" : '<p class="notice">아직 이 자격증 문제가 없어요. 아래 [내 문제]에 문제를 추가하면 공부 화면이 열려요.</p>') +
      (legacyData(id) && !engStore(id) ? '<div class="notice row"><span class="grow">이 기기에 ' + esc(LEGACY[id][1]) + " 기록이 " + Object.keys(legacyData(id).ans).length + '문제 있어요.</span><button class="btn sm" data-act="eng-import" data-id="' + id + '">내 계정으로 가져오기</button></div>' : "") +
      "</section>";
    h += diffBox(c);
    if (!c.pack) h += '<section class="section"><div class="section-head"><h2>내 문제</h2></div>' + renderMine(id) + "</section>";
    h += '<section class="section"><div class="section-head"><h2>실제 시험 기록</h2></div>' + renderCertRecord(id) + "</section>";
    return h;
  }
  function renderWrongView() {
    var ids = myCertIds();
    var h = '<div class="page-head"><div><h1>오답노트</h1><p>자격증마다 틀린 문제가 모여 있어요. 누르면 그 자격증 오답노트가 열려요.</p></div></div>';
    h += '<div class="grid cols" style="--cols:' + colsFor(ids.length) + '">' + ids.map(function (id) {
      var s = certStats(id), has = s.total > 0;
      return '<article class="card cert-card"><div class="top">' + dot(id) + "<h3>" + esc(certShort(id)) + '</h3></div><div class="wrong-big"><b class="num">' + s.open + "</b><span>남은 오답</span></div>" +
        '<div class="meta"><span>한 번이라도 틀린 문제</span><b>' + s.wrong + "</b></div>" + '<div class="meta"><span>극복한 문제</span><b>' + (s.wrong - s.open) + "</b></div>" +
        '<div class="foot"><button class="btn sm ' + (s.open ? "omr" : "") + '" data-act="eng" data-id="' + id + '" data-tab="notes"' + (has ? "" : " disabled") + ">오답노트 열기</button></div></article>";
    }).join("") + "</div>";
    return h;
  }
  function engHist() { // 모든 자격증의 공부 화면 시험 결과
    var out = [];
    myCertIds().forEach(function (id) { var s = engStore(id); (s && s.hist || []).forEach(function (r) { out.push({ id: id, r: r }); }); });
    return out.sort(function (a, b) { return b.r.date - a.r.date; });
  }
  /* ----- 공부 화면 열고 닫기 (같은 페이지 안) ----- */
  var DATA = {
    comp1: { dir: "data/c1/", files: ["exam", "questions", "images", "summary", "concept"] },
    arch: { dir: "data/ar/", files: ["exam", "questions", "summary", "concept"] },
    adsp: { dir: "data/ad/", files: ["exam", "questions", "summary", "concept"] },
    khist: { dir: "data/kh/", files: ["exam", "questions", "summary", "concept"] }
  };
  var dataCache = {}, studyId = null;
  function loadJs(src) { return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = function () { rej(src); }; document.body.appendChild(sc); }); }
  function loadCertData(id) {
    if (dataCache[id]) return Promise.resolve(dataCache[id]);
    var d = DATA[id];
    if (!d) { var c = customExam(id); return Promise.resolve({ exam: c.exam, q: c.questions, s: c.summary, img: {}, c: [] }); } // 직접 넣은 문제는 매번 새로
    window.IMGDATA = undefined; window.CDATA = undefined;
    return d.files.reduce(function (p, f) { return p.then(function () { return loadJs(d.dir + f + ".js"); }); }, Promise.resolve()).then(function () {
      dataCache[id] = { exam: window.EXAM, q: window.QDATA, s: window.SDATA, img: window.IMGDATA || {}, c: window.CDATA || [] };
      return dataCache[id];
    });
  }
  function openStudy(id, tab, sview) {
    if (!qTotal(id)) { studyCert = id; go("study"); toast("먼저 [내 문제]에 문제를 추가해 주세요"); return; }
    studyCert = id; studyId = id;
    var old = $("#study"), root = document.createElement("div");
    if (old.pmStop) { try { old.pmStop(); } catch (e) { /* 무시 */ } }
    root.id = "study"; root.className = "pm-study"; root.dataset.tab = tab || "home"; if (sview) root.dataset.view = sview;
    root.innerHTML = '<div class="pm-load">' + esc(cert(id).name) + " 불러오는 중…</div>";
    old.parentNode.replaceChild(root, old);
    $("#hub").hidden = true; window.scrollTo(0, 0);
    loadCertData(id).then(function (d) {
      if (studyId !== id || $("#study") !== root) return;
      window.EXAM = d.exam; window.QDATA = d.q; window.SDATA = d.s; window.IMGDATA = d.img; window.CDATA = d.c;
      root.innerHTML = '<div class="app s-app"></div><nav class="nav s-nav"><div class="in">' + LAUNCH.map(function (l) {
        return '<button data-tab="' + l[0] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + l[3] + "</svg>" + l[1] + "</button>";
      }).join("") + '</div></nav><div class="s-modal"></div>';
      window.PM_ENGINE_LIVE = root;
      window.PM_ENGINE_START(root);
    }).catch(function (src) { root.innerHTML = '<div class="pm-load">파일을 못 불러왔어요: ' + esc(src) + '<br><button class="pm-lock-btn" onclick="window.PM_SHELL.home()">패스메이트로 돌아가기</button></div>'; });
  }
  function closeStudy(toView) {
    var root = $("#study");
    if (root && root.pmStop) { try { root.pmStop(); } catch (e) { /* 무시 */ } }
    window.PM_ENGINE_LIVE = null; studyId = null;
    var fresh = document.createElement("div"); fresh.id = "study"; fresh.className = "pm-study"; fresh.hidden = true;
    root.parentNode.replaceChild(fresh, root);
    $("#hub").hidden = false; document.onkeydown = null;
    ST.flushAll(); view = toView || "home"; render(); window.scrollTo(0, 0);
  }
  window.PM_ENG_IO = {
    get: function () { var v = studyId ? engStore(studyId) : null; return v ? JSON.stringify(v) : null; },
    set: function (str) { if (!studyId) return; try { setEngStore(studyId, JSON.parse(str)); } catch (e) { /* 무시 */ } }
  };
  window.PM_SHELL = {
    home: function () { closeStudy("home"); },
    switchCert: function () {
      var cur = studyId, root = $("#study"), tab = root && root.pmTab ? root.pmTab() : "home";
      var ids = myCertIds();
      openModal("자격증 바꾸기", '<div class="cert-pick">' + ids.map(function (x) {
        var n = qTotal(x);
        return '<button type="button" class="cert-pick-row' + (x === cur ? " on" : "") + '" data-act="switch-cert" data-id="' + x + '" data-tab="' + tab + '"' + (n ? "" : " disabled") + '>' + dot(x) +
          '<span class="grow"><b>' + esc(certShort(x)) + '</b><small>' + esc((cert(x) || catalogCert(x) || {}).name || "") + (n ? " · " + n.toLocaleString() + "문제" : " · 문제 없음") + '</small></span>' + (x === cur ? '<span class="pill">지금 공부 중</span>' : '<span class="go">›</span>') + "</button>";
      }).join("") + '</div><div class="form-actions"><button type="button" class="btn" data-act="switch-home">패스메이트 홈으로</button><button type="button" class="btn" data-act="switch-manage">자격증 추가·삭제</button></div>');
    },
    account: function () { acts.acct(); },
    label: function () { return isGuest() ? "게스트" : (isAdmin() ? "★ " : "") + ((M && M.profile.name) || (ST.user && ST.user.name) || "내 계정"); }
  };
  /* 잠금 화면: 게스트는 핵심요약·플래시 카드·벼락치기 X, 회원은 벼락치기에 코드 필요, 관리자 코드면 모두 열림 */
  var LOCKMSG = {
    cram: ["벼락치기는 코드가 있어야 열려요", "받은 벼락치기 코드나 관리자 코드를 넣어 주세요."],
    cramDeny: ["벼락치기를 쓸 수 없는 계정이에요", "관리자가 이 계정의 벼락치기 사용을 막아 두었어요. 문제풀기·개념학습·요약본은 그대로 쓸 수 있어요."],
    cramGuest: ["게스트는 벼락치기를 쓸 수 없어요", "회원가입하고 코드를 넣으면 열려요."],
    sum: ["게스트는 요약본을 볼 수 없어요", "회원가입하면 바로 볼 수 있어요."],
    flash: ["게스트는 플래시 카드를 쓸 수 없어요", "플래시 카드는 요약본으로 만들어져서 회원만 쓸 수 있어요."]
  };
  window.PM_GATE = function (t, top) {
    var L = locks();
    var key = t === "cram" && L.cram ? (L.cramDeny ? "cramDeny" : L.guest ? "cramGuest" : "cram") : (t === "sum" || t === "flash") && L.sum ? t : null;
    if (!key) return false;
    var root = $("#study"), app = root.querySelector(".s-app"), m = LOCKMSG[key];
    app.innerHTML = (top || "") + '<div class="pm-lock"><div class="pm-lock-ic" aria-hidden="true">🔒</div><h2>' + m[0] + "</h2><p>" + m[1] + "</p>" +
      (key === "cramDeny" ? "" : '<form id="pmLockF"><label for="pmCode">' + (L.guest ? "관리자 코드" : "코드") + '</label><input id="pmCode" autocomplete="off" required>' +
      '<p class="pm-lock-err" id="pmLockE" hidden></p><button class="pm-lock-btn">열기</button></form>') +
      (L.guest ? '<button class="pm-lock-sub" id="pmJoin" type="button">회원가입하러 가기</button>' : "") + "</div>";
    if ($("#pmLockF")) $("#pmLockF").onsubmit = function (e) {
      e.preventDefault();
      Promise.resolve(unlockCode($("#pmCode").value)).then(function (r) {
        if (!r.ok) { var er = $("#pmLockE"); er.textContent = r.msg; er.hidden = false; return; }
        var goTab = function () { var b = root.querySelector('.s-nav [data-tab="' + (t === "flash" ? "home" : t) + '"]'); if (b) b.click(); };
        if (r.wish) { app.innerHTML = (top || "") + '<div class="pm-lock pm-wish"><div class="pm-lock-ic" aria-hidden="true">✨</div><h2>' + r.msg + '</h2><p>Que le ciel vous entende</p></div>'; setTimeout(goTab, 1800); }
        else goTab();
      });
    };
    var j = $("#pmJoin"); if (j) j.onclick = joinFromGuest;
    return true;
  };
  function customExam(id) { // 문제를 직접 넣는 자격증용 공부 화면 설정
    var c = cert(id), list = customFor(id), subs = c.stages[0].subjects.length ? c.stages[0].subjects : ["전체"];
    var exam = { key: id, name: c.name, short: c.short || c.name, brand: (c.short || c.name) + " 특훈", brandSub: "MY QUESTIONS", subj: [""].concat(subs), per: Math.max(1, Math.min(20, Math.ceil(list.length / subs.length))), min: 60,
      store: "x", cbtOrg: c.org || "", isMain: function () { return true; }, setLabel: function (x) { return x; }, mainLabel: "내 문제", oldLabel: "", oldNote: "", hasOb: false, autoNeg: true,
      rand: { A: { t: "내 문제 전체", d: "추가한 문제에서 무작위", f: function () { return true; } } }, cramSrc: [], statLine: function (Q) { return "(내가 추가한 문제 " + Q.length + "개)"; }, pdfs: null };
    var qs = list.map(function (q, i) { return { id: q.id, set: q.set || "내 문제", n: i + 1, s: Math.min(Math.max(1, q.s || 1), subs.length), q: q.q, o: q.o, a: q.a + 1, e: q.e || "" }; });
    return { exam: exam, questions: qs, summary: [] };
  }
  /* ----- 게스트·코드 잠금 ----- */
  function isGuest() { return !!(ST.user && ST.user.guest); }
  function adminEligible() {
    var u = ST.user, e = C.codes.adminEmail;
    if (!u || u.guest) return false;
    if (ST.mode === "cloud") return !!u.owner; // 앱 링크: 앱 주인 계정만
    return !!(u.email && u.email.toLowerCase() === e && u.verified); // GitHub(Firebase): 관리자 이메일 + 인증 완료
  }
  function unlockState() {
    if (isGuest()) { try { return JSON.parse(sessionStorage.getItem("pm2.guestUnlock") || "{}"); } catch (e) { return ui.guestUnlock || {}; } }
    return (M && M.unlock) || {};
  }
  function setUnlock(k) {
    if (isGuest()) { var g = unlockState(); g[k] = true; ui.guestUnlock = g; try { sessionStorage.setItem("pm2.guestUnlock", JSON.stringify(g)); } catch (e) { /* 무시 */ } return; }
    M.unlock = M.unlock || {}; M.unlock[k] = true; save();
  }
  function isAdmin() { return !!(unlockState().admin && adminEligible()); }
  function myPerm() { return (!isGuest() && ui.perm) || {}; }
  function blocked() { return !!(myPerm().block && !isAdmin()); }
  function locks() {
    var g = isGuest(), a = isAdmin(), u = unlockState(), pm = myPerm();
    var deny = !a && pm.cram === "deny", allow = !g && pm.cram === "allow";
    return { guest: g, admin: a, cram: deny || !(a || allow || (!g && u.cram)), cramDeny: deny, cramAllow: allow && !a, sum: g && !a };
  }
  function unlockCode(code) {
    var h = ST.codeHash(code);
    if (h === C.codes.admin) {
      return ST.refreshVerified().then(function () {
        var u = ST.user || {}, e = C.codes.adminEmail;
        if (ST.mode === "cloud") { if (!u.owner) return { ok: false, msg: "관리자 인증은 관리자 계정으로 로그인했을 때만 할 수 있어요" }; setUnlock("admin"); return { ok: true, msg: "관리자 인증 완료! 모든 제한이 풀렸어요" }; }
        if (!u.email || u.email.toLowerCase() !== e) return { ok: false, msg: "관리자 인증은 관리자 계정으로 로그인했을 때만 할 수 있어요" };
        if (!u.verified) return { ok: false, msg: "관리자 계정의 이메일 인증을 먼저 마쳐 주세요 (내 계정 → 인증 메일 보내기)" };
        setUnlock("admin"); return { ok: true, msg: "관리자 인증 완료! 모든 제한이 풀렸어요" };
      });
    }
    if (h === C.codes.cram) {
      if (myPerm().cram === "deny" && !isAdmin()) return { ok: false, msg: "관리자가 이 계정의 벼락치기 사용을 막아 두었어요" };
      if (isGuest()) return { ok: false, msg: "게스트는 벼락치기를 쓸 수 없어요. 회원가입 후 코드를 넣어 주세요" };
      setUnlock("cram"); return { ok: true, msg: "하늘이 당신의 소원을 들어주길", wish: true };
    }
    return { ok: false, msg: "코드가 맞지 않아요" };
  }
  function joinFromGuest() {
    if (studyId) closeStudy("home");
    ST.logout(); M = null; session = null; ui.authTab = "signup"; view = "home"; render(); window.scrollTo(0, 0);
  }
  var VIEWS = { home: renderHome, study: renderStudy, sched: renderSched, wrong: renderWrongView, record: renderRecord };
  function render() {
    var tabs = $("#tabs"), v = $("#view");
    document.body.classList.toggle("in-quiz", !!session);
    document.body.classList.toggle("pre-login", !booting && !ST.user);
    if (booting) { tabs.hidden = true; v.innerHTML = '<div class="empty boot">패스메이트를 여는 중…</div>'; return; }
    if (!ST.user) { tabs.hidden = true; $("#acct").hidden = true; v.innerHTML = renderLogin(); bindLogin(); return; }
    $("#acct").hidden = false; $("#acct").textContent = isGuest() ? "게스트" : (isAdmin() ? "★ " : "") + (ST.mode === "cloud" || ST.mode === "firebase" ? "☁ " : "") + (M.profile.name || ST.user.name || "내 계정");
    if (!M.setup) { tabs.hidden = true; v.innerHTML = renderOnboard(); return; }
    if (blocked()) { tabs.hidden = true; v.innerHTML = renderBlocked(); return; }
    tabs.hidden = !!session;
    $all("#tabs .tab").forEach(function (t) { t.classList.toggle("active", t.dataset.view === view); });
    v.innerHTML = session ? renderSession() : VIEWS[view]();
    bindInputs();
  }
  function go(v) { session = null; clearInterval(timerId); view = v; render(); window.scrollTo(0, 0); }
  function bindInputs() {
    var segs = { "pk-count": function (v) { ui.pickCount = v; }, "pk-filter": function (v) { ui.pickFilter = v; }, "pk-mode": function (v) { ui.pickMode = v; }, "wr-show": function (v) { ui.wrongShow = v; ui.wrongLimit = 50; }, "sch-mine": function (v) { ui.schedMine = v === "1"; } };
    Object.keys(segs).forEach(function (id) { var el = document.getElementById(id); if (el) el.onclick = function (e) { var b = e.target.closest("button"); if (b) { segs[id](b.dataset.v); render(); } }; });
    var ps = $("#pk-subj"); if (ps) ps.onchange = function () { ui.pickSubj = +this.value; render(); };
    var wc = $("#wr-cert"); if (wc) wc.onchange = function () { ui.wrongCert = this.value; ui.wrongLimit = 50; render(); };
    var sq = $("#sum-q"); if (sq) { var tm; sq.oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { ui.sumQ = v; ui.sumLimit = 20; render(); var el = $("#sum-q"); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }, 250); }; }
    var mq = $("#mem-q"); if (mq) { var mt; mq.oninput = function () { var v = this.value; clearTimeout(mt); mt = setTimeout(function () { ui.memQ = v; render(); var el = $("#mem-q"); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }, 250); }; }
    var sh = $("#sum-hot"); if (sh) sh.onchange = function () { ui.sumHot = this.checked; render(); };
  }

  var acts = {
    "go": function (b) { go(b.dataset.view); },
    "logo": function (b) {
      if (!ST.user || !M || !M.setup) return;
      if (session && !session.done && !b.dataset.armed) { b.dataset.armed = "1"; toast("한 번 더 누르면 풀이를 그만두고 홈으로 가요"); setTimeout(function () { delete b.dataset.armed; }, 3000); return; }
      delete b.dataset.armed; go("home");
    },
    "auth-tab": function (b) { ui.authTab = b.dataset.tab; render(); var i = $(".login-card input:not([type=checkbox])"); if (i) i.focus(); },
    "login-fill": function (b) { ui.loginId = b.dataset.name; render(); var p = $("#lg-pw"); if (p) p.focus(); },
    "logout": function () { closeModal(); if (studyId) closeStudy("home"); ST.logout(); M = null; session = null; clearInterval(timerId); ui.authTab = "login"; view = "home"; render(); window.scrollTo(0, 0); toast("로그아웃했어요"); },
    "cloud-login": function () { ST.loginCloud(); afterLogin(); },
    "acct": function () {
      var nm = (M && M.profile.name) || (ST.user && ST.user.name) || "내 계정";
      if (isGuest()) {
        openModal("게스트", '<div class="stack"><p class="small">게스트로 둘러보는 중이에요. 기록은 이 기기에만 잠시 저장되고, 요약본·벼락치기는 쓸 수 없어요.</p><div class="form-actions"><button type="button" class="btn" data-act="logout">나가기</button><button type="button" class="btn primary" data-act="join">회원가입하기</button></div></div>');
        return;
      }
      openModal("내 계정", '<div class="stack"><div class="row"><span class="avatar">' + esc(nm.slice(0, 1)) + '</span><div class="grow"><b>' + esc(nm) + (isAdmin() ? ' <span class="pill pass">관리자</span>' : "") + '</b><p class="small muted">' + (ST.mode === "cloud" ? "온라인 계정 · 다른 기기에서도 같은 기록" : ST.mode === "firebase" ? esc(ST.user.email || "이메일 계정") + " · 어느 기기에서 로그인해도 같은 기록" : "이 기기 프로필 · 이 브라우저에 저장") + "</p></div></div>" +
        '' + (ST.mode === "firebase" && !ST.user.verified ? '<p class="small notice">이메일 인증이 아직 안 됐어요. <button type="button" class="btn sm" data-act="send-verify">인증 메일 보내기</button></p>' : "") + '<div class="form-actions"><button type="button" class="btn" data-act="acct-record">마이 페이지</button><button type="button" class="btn primary" data-act="logout">로그아웃</button></div>' +
        '<div class="acct-danger"><button type="button" class="btn danger sm" data-act="wipe" data-confirm>회원 탈퇴</button><span class="small muted">계정과 모든 기록을 지워요. 되돌릴 수 없어요.</span></div></div>');
    },
    "switch-cert": function (b) { closeModal(); if (b.dataset.id === studyId) return; openStudy(b.dataset.id, b.dataset.tab); },
    "switch-home": function () { closeModal(); closeStudy("home"); },
    "switch-manage": function () { closeModal(); closeStudy("home"); var a = acts["certs-manage"]; if (a) a(); },
    "my-tab": function (b) { ui.myTab = b.dataset.v; render(); },
    "attend": function () { doAttend(); },
    "cal-move": function (b) { var base = ui.calMonth || today().slice(0, 7), d = new Date(+base.slice(0, 4), +base.slice(5, 7) - 1 + (+b.dataset.v), 1); ui.calMonth = d.getFullYear() + "-" + pad(d.getMonth() + 1); render(); },
    "mem-reload": function () { ui.members = null; render(); },
    "mem-filter": function (b) { ui.memFilter = b.dataset.v; render(); },
    "mem-cram": function (b) { memSet(b.dataset.id, { cram: b.dataset.v }); },
    "mem-block": function (b) { var m = (ui.members || []).filter(function (x) { return x.id === b.dataset.id; })[0]; if (m) memSet(m.id, { block: !m.perm.block }); },
    "perm-check": function () { ST.myPerm().then(function (pm) { ui.perm = pm; render(); if (pm.block) toast("아직 제한 중이에요"); }); },
    "acct-record": function () { closeModal(); ui.myTab = "acct"; go("record"); },
    "guest": function () { ST.loginGuest(); ui.pendingProfile = { name: "게스트", intro: "" }; afterLogin(); toast("게스트로 둘러봐요. 기록은 이 기기에만 잠시 저장돼요"); },
    "join": function () { closeModal(); joinFromGuest(); },
    "code-unlock": function () { var i = $("#unlock-code"); if (!i) return; Promise.resolve(unlockCode(i.value)).then(function (r) { toast(r.ok ? r.msg : r.msg); if (r.ok) render(); }); },
    "send-verify": function () { ST.sendVerify().then(function (r) { toast(r.ok ? "인증 메일을 보냈어요. 메일의 링크를 누른 뒤 다시 로그인해 주세요" : r.msg); }); },
    "eng": function (b) { if (blocked()) { toast("관리자가 이용을 제한한 계정이에요"); return; } openStudy(b.dataset.id, b.dataset.tab, b.dataset.sview); },
    "eng-import": function (b) { var v = legacyData(b.dataset.id); if (!v) return; setEngStore(b.dataset.id, v); render(); toast("예전 기록을 가져왔어요"); },
    "reload": function () { location.reload(); },
    "import-local": function () {
      var ps = ST.profiles();
      openModal("이 기기 옛 기록 가져오기", '<form class="form" id="f-il"><p class="full small muted">예전에 이 기기에서 아이디·비밀번호로 쓰던 기록을 지금 계정으로 옮겨요. 지금 계정의 기록은 옮겨 온 기록으로 바뀌어요.</p>' +
        fld("예전 아이디", '<select id="il-id">' + ps.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; }).join("") + "</select>") + fld("예전 비밀번호", '<input id="il-pw" type="password" required>') +
        '<p class="full form-err" id="il-err" hidden></p>' + actions(true, "", "", "옮기기") + "</form>", function () {
        $("#f-il").onsubmit = function (e) {
          e.preventDefault();
          var o = ST.readLocalProfile($("#il-id").value, $("#il-pw").value);
          if (!o) { var er = $("#il-err"); er.textContent = "비밀번호가 맞지 않아요"; er.hidden = false; return; }
          ST.importAll(o); M = ST.get("main", defaultMain()); closeModal(); render(); warmPacks(); toast("옛 기록을 옮겼어요");
        };
      });
    },
    "fb-reset": function () {
      var em = ($("#fl-email") || {}).value || "";
      openModal("비밀번호 다시 정하기", '<form class="form" id="f-rs"><p class="full small muted">가입한 이메일로 비밀번호를 다시 정하는 링크를 보내 드려요.</p>' + fld("이메일", '<input id="rs-email" type="email" required value="' + esc(em.trim()) + '">', "full") + '<p class="full form-err" id="rs-err" hidden></p>' + actions(true, "", "", "링크 보내기") + "</form>", function () {
        $("#f-rs").onsubmit = function (e) {
          e.preventDefault();
          ST.fbReset($("#rs-email").value.trim()).then(function (r) { if (!r.ok) { var er = $("#rs-err"); er.textContent = r.msg; er.hidden = false; return; } closeModal(); toast("메일을 보냈어요. 메일함(스팸함도)을 확인해 주세요"); });
        };
      });
    },
    "onb-toggle": function (b) { var id = b.dataset.id, i = ui.onboard.indexOf(id); if (i > -1) ui.onboard.splice(i, 1); else ui.onboard.push(id); render(); },
    "onb-done": function () {
      M.hidden = M.hidden || {};
      ui.onboard.forEach(function (id) { if (!myEntry(id)) { M.certs.push(M.hidden[id] || { id: id, goal: "", license: null }); delete M.hidden[id]; } });
      M.certs = M.certs.filter(function (e) { return ui.onboard.indexOf(e.id) > -1; });
      M.setup = true; ui.onboard = null; save(); view = "home"; render(); warmPacks();
    },
    "certs-manage": certsManage,
    "cert-custom": customCertForm,
    "cert-settings": function (b) { certSettings(b.dataset.id); },
    "study": function (b) { studyCert = b.dataset.id; go("study"); },
    "study-tab": function (b) { studyTab = b.dataset.tab; render(); },
    "mock-start": startMock,
    "pick-start": startPick,
    "set-start": function (b) { startSet(b.dataset.set); },
    "pick": function (b) { pickAnswer(+b.dataset.i); },
    "q-next": function () { session.i++; render(); window.scrollTo(0, 0); },
    "q-prev": function () { if (session.i) { session.i--; render(); } },
    "q-jump": function (b) { session.i = +b.dataset.i; render(); window.scrollTo(0, 0); },
    "exam-submit": submitExam,
    "instant-finish": finishSession,
    "quiz-quit": function () { var c = session.certId; session = null; clearInterval(timerId); studyCert = c; view = "study"; render(); },
    "quiz-close": function () { var c = session.certId; session = null; studyCert = c; view = "study"; render(); window.scrollTo(0, 0); },
    "retry-wrong": function () { var s = session, l = s.qs.filter(function (q, i) { return s.picks[i] !== q.a; }); startSession(s.certId, shuffle(l), "instant", "틀린 문제 다시 " + l.length + "문제", 0); },
    "topic-toggle": function (b) { var d = b.closest("details"); ui.openTopic[b.dataset.key] = !ui.openTopic[b.dataset.key]; var idx = d ? $all("details.q-detail").indexOf(d) : -1; render(); if (idx > -1) { var nd = $all("details.q-detail")[idx]; if (nd) nd.open = true; } },
    "topic-quiz": function (b) { var p = packOf(studyCert), i = +b.dataset.i; var l = p.questions.filter(function (q) { return p.topicOf(q) === i; }); startSession(studyCert, shuffle(l).slice(0, 30), "instant", p.topics[i].title + " 문제", 0); },
    "sum-subj": function (b) { ui.sumSubj = +b.dataset.s; ui.sumLimit = 20; render(); },
    "sum-more": function () { ui.sumLimit += 20; render(); },
    "wrong-retry": function () {
      var ids = view === "study" ? [studyCert] : ui.wrongCert ? [ui.wrongCert] : myCertIds();
      var l = wrongQs(ids).filter(isOpenWrong); if (!l.length) return;
      startSession(ids.length === 1 ? ids[0] : certOfQ(l[0]), shuffle(l).slice(0, 50), "instant", "오답 다시 풀기 " + Math.min(50, l.length) + "문제", 0);
    },
    "wrong-more": function () { ui.wrongLimit += 50; render(); },
    "wrong-toggle": function (b) { var k = b.dataset.key.split(":"), m = ansMap(k[0]), r = m[k.slice(1).join(":")]; if (!r) return; r[2] = r[2] ? 0 : 1; ST.save("ans-" + k[0]); render(); toast(r[2] ? "극복으로 옮겼어요" : "다시 오답으로 돌렸어요"); },
    "wrong-note": function (b) { noteForm(b.dataset.key); },
    "log-add": logForm,
    "exam-add": function () { examForm(null); },
    "exam-edit": function (b) { examForm(M.exams.filter(function (e) { return e.id === b.dataset.id; })[0]); },
    "exam-del": function (b) { M.exams = M.exams.filter(function (e) { return e.id !== b.dataset.id; }); save(); closeModal(); render(); toast("삭제했어요"); },
    "sched-add": function (b) {
      var e = C.SCHEDULE[+b.dataset.i], ids = myCertIds(), cid = e.certs.filter(function (c) { return ids.indexOf(c) > -1; })[0] || ids[0];
      var stg = /실기/.test(e.title) ? "실기" : /필기/.test(e.title) ? "필기" : cert(cid).stages[0].name;
      if (!cert(cid).stages.some(function (s) { return s.name === stg; })) stg = cert(cid).stages[0].name;
      examForm(null, { certId: cid, stage: stg, date: e.exam[0], time: "", place: "", memo: e.title + (e.exam[1] !== e.exam[0] ? " (시험 기간 " + range(e.exam[0], e.exam[1]) + " 중 접수한 날짜로 바꿔 주세요)" : "") });
    },
    "attempt-add": function (b) { attemptForm(null, { examId: b.dataset.exam, certId: b.dataset.cert }); },
    "attempt-edit": function (b) { attemptForm(clone(M.attempts.filter(function (a) { return a.id === b.dataset.id; })[0])); },
    "attempt-del": function (b) { M.attempts = M.attempts.filter(function (a) { return a.id !== b.dataset.id; }); save(); closeModal(); render(); toast("삭제했어요"); },
    "license": function (b) { licenseForm(b.dataset.id); },
    "license-del": function (b) { myEntry(b.dataset.id).license = null; save(); closeModal(); render(); },
    "q-edit": function (b) { questionForm(b.dataset.id); },
    "q-del": function (b) { var l = customList(), i = l.map(function (x) { return x.id; }).indexOf(b.dataset.id); if (i > -1) l.splice(i, 1); ST.save("custom"); closeModal(); render(); toast("삭제했어요"); },
    "q-bulk": bulkForm,
    "profile": profileForm,
    "copy": function (b) { var el = document.getElementById(b.dataset.target); copyText(el.value, el); },
    "export-copy": function () { copyText(JSON.stringify(ST.exportAll())); },
    "export-file": function () {
      var data = JSON.stringify(ST.exportAll()), name = "passmate-backup-" + today() + ".json";
      var done = false;
      if (ST.host()) {
        ST.host().use("downloads").then(function (d) { if (d) { done = true; return d.save({ filename: name, data: data }).then(function () { toast("저장했어요"); }); } fileDl(); }).catch(function () { if (!done) fileDl(); else toast("저장이 취소됐어요"); });
      } else fileDl();
      function fileDl() { try { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast("파일 저장이 막혀 있어요. 백업 코드 복사를 써 주세요"); } }
    },
    "import": importForm,
    "wipe": function () { var cloud = ST.mode === "cloud"; if (studyId) closeStudy("home"); ST.wipe().then(function () { if (cloud) { ST.logout(); ui.cloudHas = false; } M = null; session = null; ui.authTab = "signup"; view = "home"; render(); window.scrollTo(0, 0); toast("탈퇴했어요. 기록을 모두 지웠어요"); }); }
  };

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) { closeModal(); return; }
    var tab = e.target.closest("#tabs .tab"); if (tab) { go(tab.dataset.view); return; }
    var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    if (b.hasAttribute("data-confirm") && !b.dataset.armed) {
      b.dataset.armed = "1"; b.dataset.label = b.textContent; b.textContent = "한 번 더 누르면 실행";
      setTimeout(function () { if (b.isConnected) { delete b.dataset.armed; b.textContent = b.dataset.label; } }, 3000);
      return;
    }
    if (b.tagName === "BUTTON" && b.closest(".set-card, .pick-card")) e.preventDefault();
    var fn = acts[b.dataset.act]; if (fn) fn(b);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("#modal").hidden) { closeModal(); return; }
    if (!session || session.done || !$("#modal").hidden) return;
    var tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select") return;
    var q = session.qs[session.i];
    if (/^[1-5]$/.test(e.key) && +e.key <= q.o.length) { e.preventDefault(); pickAnswer(+e.key - 1); }
    else if (e.key === "Enter" || e.key === "ArrowRight") {
      if (session.mode === "instant" && session.picks[session.i] == null) return;
      e.preventDefault();
      if (session.i + 1 < session.qs.length) { session.i++; render(); } else if (session.mode === "instant") finishSession();
    } else if (e.key === "ArrowLeft" && session.i) { session.i--; render(); }
  });

  /* ---------- 시작 ---------- */
  render();
  ST.detect().then(function (mode) {
    booting = false;
    if (ST.resumeGuest()) { afterLogin(); return; }
    if (mode === "firebase" || mode === "fberror") { if (ST.user) { afterLogin(); return; } render(); return; }
    if (mode === "cloud") {
      render();
      ST.cloudHasAccount().then(function (has) {
        ui.cloudHas = has;
        if (has && !ST.cloudSignedOut()) { ST.loginCloud(); afterLogin(); return; }
        ui.authTab = has ? "login" : "signup"; render();
      });
      return;
    }
    if (ST.resumeSession()) { afterLogin(); return; }
    render();
  });
})();
