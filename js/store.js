/* 패스메이트 로그인·저장 — HAE
   ① 앱 링크(온라인 계정)로 열면: 로그인한 계정 공간(본인만 보이는 곳)에 저장 → 다른 기기에서도 같은 기록
   ② GitHub·내 컴퓨터에서 열고 js/firebase-config.js가 채워져 있으면: Firebase 이메일 계정 → 어느 기기에서 로그인해도 같은 기록
   ③ firebase-config.js가 비어 있으면: 이 기기 안에 프로필(이름 + PIN)을 만들어 로그인 → 이 브라우저에 저장
   어느 쪽이든 로그인 전에는 아무 기록도 보이지 않아요. */
(function () {
  "use strict";
  var KEYS = ["main", "custom", "notes", "ans-comp1", "ans-arch", "ans-adsp", "ans-khist", "ans-my", "eng-comp1", "eng-arch", "eng-adsp", "eng-khist", "eng-my"]; // eng-* = 공부 화면(컴활 엔진) 기록
  var S = {
    mode: "none",     // "cloud" | "local"
    user: null,       // { id, name }
    data: {},
    _db: null, _uid: null, _timers: {}, _writing: {}, _dirty: {}
  };

  function hash(str) { // 기기 안 잠금용 간단 해시 (보안용 암호화 아님)
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) { var ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  S.hash = function (str) { return hash(String(str)); };
  S.codeHash = function (str) { return hash(String(str || "").trim().replace(/\s+/g, " ").toLowerCase()); }; // 잠금 코드: 앞뒤 공백·대소문자 무시
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* 무시 */ } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  function parse(s, d) { if (!s) return d; try { return JSON.parse(s); } catch (e) { return d; } }

  /* ----- 어떤 방식으로 저장할지 정하기 ----- */
  S.host = function () { var h = window.claude; return h && typeof h.use === "function" ? h : null; }; // 온라인 앱 환경이 주는 계정·저장 기능
  S.detect = function () {
    var host = S.host();
    if (!host) {
      if (S.fbConfig()) return S._initFirebase();
      S.mode = "local"; return Promise.resolve(S.mode);
    }
    var timeout = new Promise(function (res) { setTimeout(function () { res(null); }, 6000); });
    return Promise.race([Promise.all([host.use("user"), host.use("db")]), timeout]).then(function (r) {
      if (!r || !r[0] || !r[1]) { S.mode = "local"; return S.mode; }
      var user = r[0], db = r[1];
      return user.id().then(function (id) {
        if (!id) { S.mode = "local"; return S.mode; }
        S._db = db; S._uid = id; S._userNs = user; S.mode = "cloud";
        return Promise.all([Promise.resolve(user.me ? user.me() : {}).catch(function () { return {}; }), Promise.resolve(user.isOwner ? user.isOwner() : false).catch(function () { return false; })]).then(function (r) {
          var me = r[0] || {};
          S.cloudUser = { id: id, name: me.name || "", email: "", owner: !!r[1] }; // 앱 링크에서는 이 앱 주인(owner)인지로 관리자 확인
          return S.mode;
        });
      });
    }).catch(function () { S.mode = "local"; return S.mode; });
  };

  /* ----- 이 기기 프로필 (로컬 로그인) ----- */
  S.profiles = function () { return parse(lsGet("pm2.profiles"), []); };
  S.createProfile = function (name, pin, remember) {
    var list = S.profiles();
    if (list.some(function (p) { return p.name === name; })) return { ok: false, msg: "같은 이름의 프로필이 이미 있어요" };
    var p = { id: "p" + Date.now().toString(36), name: name, pin: hash(name + ":" + pin), created: Date.now() };
    list.push(p);
    if (!lsSet("pm2.profiles", JSON.stringify(list))) return { ok: false, msg: "이 브라우저는 저장이 막혀 있어요 (시크릿 창인지 확인해 주세요)" };
    S._startLocal(p, remember);
    return { ok: true };
  };
  S.loginProfile = function (id, pin, remember) {
    var p = S.profiles().filter(function (x) { return x.id === id; })[0];
    if (!p) return { ok: false, msg: "프로필을 찾을 수 없어요" };
    if (p.pin !== hash(p.name + ":" + pin)) return { ok: false, msg: "비밀번호가 맞지 않아요" };
    S._startLocal(p, remember);
    return { ok: true };
  };
  S.loginByName = function (name, pin, remember) {
    var p = S.profiles().filter(function (x) { return x.name === name; })[0];
    if (!p) return { ok: false, msg: "가입되지 않은 아이디예요" };
    return S.loginProfile(p.id, pin, remember);
  };
  S.readLocalProfile = function (id, pin) { // 예전 '이 기기' 방식 기록을 꺼내기 (온라인 계정으로 옮길 때)
    var p = S.profiles().filter(function (x) { return x.id === id; })[0];
    if (!p || p.pin !== hash(p.name + ":" + pin)) return null;
    var o = { _app: "passmate", _v: 2 };
    KEYS.forEach(function (k) { var v = parse(lsGet("pm2.u." + p.id + "." + k), null); if (v != null) o[k] = v; });
    return o;
  };
  S.resumeSession = function () {
    var id = ssGet("pm2.session") || lsGet("pm2.remember");
    if (!id) return false;
    var p = S.profiles().filter(function (x) { return x.id === id; })[0];
    if (!p) return false;
    S._startLocal(p, !!lsGet("pm2.remember"));
    return true;
  };
  S._startLocal = function (p, remember) {
    S.user = { id: p.id, name: p.name };
    ssSet("pm2.session", p.id);
    if (remember) lsSet("pm2.remember", p.id); else lsDel("pm2.remember");
  };

  /* ----- Firebase (GitHub에서 여러 기기 동기화) ----- */
  var FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  function loadJs(src) {
    return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = function () { rej(new Error("load")); }; document.head.appendChild(sc); });
  }
  S.fbConfig = function () { var c = window.PM_FIREBASE_CONFIG; if (location.protocol === "file:") return null; return c && c.apiKey && c.projectId ? c : null; }; // 파일 더블클릭으로 열면 Firebase 로그인이 안 돼서 이 기기 저장으로
  S._initFirebase = function () {
    var ready = window.firebase && window.firebase.auth && window.firebase.firestore ? Promise.resolve()
      : loadJs(FB + "firebase-app-compat.js").then(function () { return loadJs(FB + "firebase-auth-compat.js"); }).then(function () { return loadJs(FB + "firebase-firestore-compat.js"); });
    return ready.then(function () {
      var fb = window.firebase;
      if (!fb.apps.length) fb.initializeApp(S.fbConfig());
      S._auth = fb.auth(); S._auth.languageCode = "ko"; S._fs = fb.firestore();
      return new Promise(function (res) { var off = S._auth.onAuthStateChanged(function (u) { off(); res(u); }); });
    }).then(function (u) {
      S.mode = "firebase";
      if (u) S._setFbUser(u);
      return S.mode;
    }).catch(function () { S.mode = "fberror"; return S.mode; });
  };
  S._setFbUser = function (u) { S._uid = u.uid; S.user = { id: u.uid, name: u.displayName || "", email: u.email || "", verified: !!u.emailVerified }; };
  S.refreshVerified = function () { // 이메일 인증을 막 마쳤을 수 있으니 다시 확인
    if (S.mode !== "firebase" || !S._auth || !S._auth.currentUser || S._guest) return Promise.resolve();
    var u = S._auth.currentUser;
    return u.reload().then(function () { if (S.user) S.user.verified = !!S._auth.currentUser.emailVerified; }).catch(function () {});
  };
  S.sendVerify = function () {
    var u = S._auth && S._auth.currentUser; if (!u) return Promise.resolve({ ok: false, msg: "로그인이 필요해요" });
    return u.sendEmailVerification().then(function () { return { ok: true }; }, function (e) { return { ok: false, msg: fbErr(e) }; });
  };
  function fbErr(e) {
    var c = (e && e.code) || "";
    var m = {
      "auth/email-already-in-use": "이미 가입된 이메일이에요. 로그인해 주세요",
      "auth/invalid-email": "이메일 형식을 확인해 주세요",
      "auth/weak-password": "비밀번호는 6자 이상으로 정해 주세요",
      "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않아요",
      "auth/invalid-login-credentials": "이메일 또는 비밀번호가 맞지 않아요",
      "auth/wrong-password": "이메일 또는 비밀번호가 맞지 않아요",
      "auth/user-not-found": "가입되지 않은 이메일이에요",
      "auth/missing-password": "비밀번호를 입력해 주세요",
      "auth/too-many-requests": "시도가 너무 많아요. 잠시 후 다시 해 주세요",
      "auth/network-request-failed": "인터넷 연결을 확인해 주세요",
      "auth/operation-not-allowed": "Firebase에서 이메일/비밀번호 로그인이 꺼져 있어요",
      "auth/unauthorized-domain": "이 주소가 Firebase 승인된 도메인에 없어요",
      "auth/requires-recent-login": "보안을 위해 다시 로그인한 뒤 시도해 주세요"
    };
    return m[c] || "잠시 후 다시 시도해 주세요" + (c ? " (" + c + ")" : "");
  }
  S.fbSignup = function (email, pw, nick, remember) {
    var A = S._auth, P = window.firebase.auth.Auth.Persistence;
    return A.setPersistence(remember ? P.LOCAL : P.SESSION).then(function () { return A.createUserWithEmailAndPassword(email, pw); })
      .then(function (cred) { S._setFbUser(cred.user); S.user.name = nick; cred.user.sendEmailVerification().catch(function () {}); return cred.user.updateProfile({ displayName: nick }).catch(function () {}); })
      .then(function () { return { ok: true }; }, function (e) { return { ok: false, msg: fbErr(e) }; });
  };
  S.fbLogin = function (email, pw, remember) {
    var A = S._auth, P = window.firebase.auth.Auth.Persistence;
    return A.setPersistence(remember ? P.LOCAL : P.SESSION).then(function () { return A.signInWithEmailAndPassword(email, pw); })
      .then(function (cred) { S._setFbUser(cred.user); return { ok: true }; }, function (e) { return { ok: false, msg: fbErr(e) }; });
  };
  S.fbReset = function (email) {
    return S._auth.sendPasswordResetEmail(email).then(function () { return { ok: true }; }, function (e) { return { ok: false, msg: fbErr(e) }; });
  };

  /* 큰 기록(공부 화면 기록 등)은 gzip으로 줄여서 저장 — 온라인 저장 한 칸의 용량 제한 때문 */
  function b64(bytes) { var s = "", CH = 0x8000; for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(s); }
  function unb64(str) { var bin = atob(str), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function gz(str) {
    var st = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(st).arrayBuffer().then(function (buf) { return b64(new Uint8Array(buf)); });
  }
  function gunz(z) { return new Response(new Blob([unb64(z)]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); }
  function pack(v) { // 저장할 모양으로
    var s = JSON.stringify(v);
    if (s.length > 60000 && window.CompressionStream) return gz(s).then(function (z) { return { gz: z }; });
    return Promise.resolve({ json: s });
  }
  function unpack(o) {
    if (!o) return Promise.resolve(null);
    if (o.gz) return gunz(o.gz).then(JSON.parse);
    if (typeof o.json === "string") return Promise.resolve(JSON.parse(o.json));
    return Promise.resolve(JSON.parse(JSON.stringify(o))); // 예전 방식(그대로 저장)
  }

  /* 온라인 저장 공통 (앱 링크 계정 / Firebase) */
  function rdoc(k) {
    if (S.mode === "firebase") {
      var d = S._fs.collection("users").doc(S._uid).collection("data").doc(k);
      return {
        get: function () { return d.get().then(function (sn) { return sn.exists ? unpack(sn.data()) : null; }); },
        set: function (v) { return pack(v).then(function (o) { o.at = Date.now(); return d.set(o); }); },
        del: function () { return d.delete(); }
      };
    }
    var c = S._db.doc("data/users/" + S._uid + "/" + k);
    return {
      get: function () { return c.get().then(function (sn) { return sn.exists ? unpack(sn.data()) : null; }); },
      set: function (v) { return pack(v).then(function (o) { return c.set(o); }); },
      del: function () { return c.delete(); }
    };
  }
  S._pending = [];

  /* ----- 게스트 (가입 없이 둘러보기, 이 기기에만 임시 저장) ----- */
  S.loginGuest = function () { S._guest = true; S.user = { id: "guest", name: "게스트", guest: true }; ssSet("pm2.guest", "1"); };
  S.resumeGuest = function () { if (ssGet("pm2.guest") === "1") { S.loginGuest(); return true; } return false; };
  function isLocal() { return S.mode === "local" || S._guest; }

  /* ----- 불러오기 ----- */
  S.loadAll = function () {
    S.data = {};
    if (isLocal()) {
      KEYS.forEach(function (k) { S.data[k] = parse(lsGet("pm2.u." + S.user.id + "." + k), null); });
      return Promise.resolve(S.data);
    }
    return Promise.all(KEYS.map(function (k) {
      return rdoc(k).get().then(function (v) { S.data[k] = v; }).catch(function () { S.data[k] = null; });
    })).then(function () { return S.data; });
  };
  S.get = function (k, def) { if (S.data[k] == null) S.data[k] = def; return S.data[k]; };

  /* ----- 저장 (조금 모았다가 한 번에) ----- */
  S.save = function (k) {
    clearTimeout(S._timers[k]);
    S._timers[k] = setTimeout(function () { S._flush(k); }, isLocal() ? 150 : 900);
  };
  S._flush = function (k) {
    var v = S.data[k];
    if (isLocal()) {
      if (!lsSet("pm2.u." + S.user.id + "." + k, JSON.stringify(v)) && S.onError) S.onError("저장 공간이 부족하거나 막혀 있어요");
      return;
    }
    if (S._writing[k]) { S._dirty[k] = true; return; }
    S._writing[k] = true; S._dirty[k] = false;
    var w = rdoc(k).set(v);
    S._pending.push(w);
    w.catch(function (e) {
      if (S.onError) S.onError(e && e.code === "quota_exceeded" ? "저장 용량이 꽉 찼어요" : "저장하지 못했어요. 잠시 후 다시 시도해 주세요");
    }).then(function () {
      S._writing[k] = false;
      S._pending = S._pending.filter(function (x) { return x !== w; });
      if (S._dirty[k]) S._flush(k);
    });
  };
  S.flushAll = function () { Object.keys(S._timers).forEach(function (k) { clearTimeout(S._timers[k]); if (S.data[k] != null) S._flush(k); }); };

  /* 온라인 계정: 로그아웃하면 이 브라우저에서는 로그인 화면부터 보여요 (기록은 계정에 그대로) */
  S.cloudHasAccount = function () { return S._db.doc("data/users/" + S._uid + "/main").get().then(function (d) { return !!d.exists; }).catch(function () { return false; }); };
  S.cloudSignedOut = function () { return lsGet("pm2.cloudOut") === "1"; };
  S.loginCloud = function () { lsDel("pm2.cloudOut"); S.user = S.cloudUser; };

  S.logout = function () {
    S.flushAll();
    if (S._guest) { S._guest = false; ssDel("pm2.guest"); S.user = null; S.data = {}; return Promise.resolve(); }
    if (S.mode === "cloud") lsSet("pm2.cloudOut", "1");
    ssDel("pm2.session"); lsDel("pm2.remember");
    S.user = null; S.data = {};
    if (S.mode === "firebase") { // 저장 중인 기록을 다 보낸 뒤 로그아웃
      return Promise.all(S._pending.map(function (p) { return p.catch(function () {}); })).then(function () { return S._auth.signOut(); }).catch(function () {});
    }
    return Promise.resolve();
  };
  S.wipe = function () { // 내 기록 전부 지우기
    var keys = KEYS.slice();
    if (S._guest) { keys.forEach(function (k) { lsDel("pm2.u.guest." + k); }); return S.logout(); }
    if (S.mode === "local") {
      keys.forEach(function (k) { lsDel("pm2.u." + S.user.id + "." + k); });
      var id = S.user.id;
      lsSet("pm2.profiles", JSON.stringify(S.profiles().filter(function (p) { return p.id !== id; })));
      S.logout();
      return Promise.resolve();
    }
    var mine = null; try { mine = mdoc("members", S._uid); } catch (e) { /* 무시 */ }
    return Promise.all(keys.map(function (k) { return rdoc(k).del().catch(function () {}); }).concat(mine ? [Promise.resolve().then(function () { return mine.delete(); }).catch(function () {})] : [])).then(function () {
      S.data = {};
      if (S.mode === "firebase") { var u = S._auth.currentUser; return (u ? u.delete() : Promise.resolve()).catch(function () { return S._auth.signOut(); }).then(function () { S.user = null; }); }
    });
  };
  /* ----- 회원 명부와 권한 (관리자 회원 관리) -----
     members/<uid>: 회원이 스스로 남기는 명부 (가입일·마지막 접속) — 관리자만 전체를 볼 수 있어요
     perms/<uid>: 관리자가 정하는 권한 { cram: "allow"|"deny"|"", block: true|false } — 본인은 읽기만 */
  function mdoc(col, uid) { if (S.mode === "firebase") return S._fs.collection(col).doc(uid); if (S.mode === "cloud") return S._db.doc(col + "/" + uid); return null; }
  S.membersOn = function () { return (S.mode === "firebase" || S.mode === "cloud") && !S._guest && !!S.user; };
  S.touchMember = function (info) { // 로그인·출석·프로필 변경 때 내 명부를 새로 적어요 (info: 닉네임·아이콘·등급·출석 요약)
    if (!S.membersOn()) return Promise.resolve();
    var now = Date.now(), d;
    return Promise.resolve().then(function () { d = mdoc("members", S._uid); return d.get(); }).then(function (sn) {
      var o = sn.exists ? (sn.data() || {}) : {}, v = { id: S._uid, joined: o.joined || now, last: now };
      info = info || {}; ["nick", "emoji", "color", "badge", "level", "points", "attend", "streak"].forEach(function (k) { if (info[k] != null) v[k] = info[k]; else if (o[k] != null) v[k] = o[k]; });
      if (S.mode === "firebase") { v.name = info.nick || S.user.name || ""; v.email = S.user.email || ""; } // 앱 링크는 계정 이름 대신 닉네임만 적어요
      return d.set(v);
    }).catch(function () {});
  };
  S.setNick = function (nick) { // Firebase 계정 이름도 함께 바꿔요
    if (S.user) S.user.name = nick;
    if (S.mode === "firebase" && S._auth && S._auth.currentUser) { try { S._auth.currentUser.updateProfile({ displayName: nick }).catch(function () {}); } catch (e) { /* 무시 */ } }
  };
  S.myPerm = function () {
    if (!S.membersOn()) return Promise.resolve({});
    return Promise.resolve().then(function () { return mdoc("perms", S._uid).get(); }).then(function (sn) { return sn.exists ? (sn.data() || {}) : {}; }).catch(function () { return {}; });
  };
  S.listMembers = function () { // 관리자만 읽을 수 있어요 (저장소 규칙으로 막혀 있음)
    var col = function (c) { return S.mode === "firebase" ? S._fs.collection(c).get() : S._db.collection(c).get(); };
    return Promise.all([col("members"), col("perms").catch(function () { return { docs: [] }; })]).then(function (r) {
      var perms = {}; (r[1].docs || []).forEach(function (d) { perms[d.id] = d.data() || {}; });
      var list = (r[0].docs || []).map(function (d) { var v = d.data() || {}; v.id = v.id || d.id; v.perm = perms[v.id] || {}; return v; });
      if (S.mode !== "cloud" || !S._userNs || !S._userNs.profiles) return list;
      return Promise.resolve(S._userNs.profiles(list.map(function (m) { return m.id; }))).then(function (ps) {
        list.forEach(function (m) { var p = ps && ps[m.id]; m.name = (p && p.name) || ""; }); return list;
      }).catch(function () { return list; });
    });
  };
  S.setPerm = function (uid, v) { var o = { cram: v.cram || "", block: !!v.block, at: Date.now() }; return mdoc("perms", uid).set(o); };
  S.removeMember = function (uid) { return mdoc("members", uid).delete(); };

  S.exportAll = function () { var o = {}; KEYS.forEach(function (k) { if (S.data[k] != null) o[k] = S.data[k]; }); o._app = "passmate"; o._v = 2; return o; };
  S.importAll = function (o) {
    if (!o || o._app !== "passmate") throw new Error("형식");
    KEYS.forEach(function (k) { if (o[k] != null) { S.data[k] = o[k]; S._flush(k); } });
  };

  window.addEventListener("pagehide", function () { if (S.user) S.flushAll(); });
  window.PM_STORE = S;
})();
