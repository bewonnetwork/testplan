/* genealogy.js — BTX.ONE Pyramid / Binary Tree (3D)
   Works with localStorage demo + tries to read existing saved users.
*/

(() => {
  "use strict";

  // ---- Storage Keys (fallback friendly) ----
  const STORAGE_CURRENT = "btx_current_user_v1";
  const USER_KEYS = [
    "btx_users_v1",
    "btx_users",
    "btx_all_users",
    "users"
  ];

  // ---- Helpers ----
  const $ = (id) => document.getElementById(id);

  function safeJSON(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function getCurrentUser() {
    const raw = localStorage.getItem(STORAGE_CURRENT);
    return raw ? safeJSON(raw, null) : null;
  }

  function loadUsersFromAnyKey() {
    for (const k of USER_KEYS) {
      const raw = localStorage.getItem(k);
      const data = raw ? safeJSON(raw, null) : null;
      if (!data) continue;

      // support array or object-map
      if (Array.isArray(data)) return data;
      if (typeof data === "object") return Object.values(data);
    }
    return [];
  }

  function saveUsersToDefault(users) {
    localStorage.setItem("btx_users_v1", JSON.stringify(users));
  }

  // ---- Demo users (if your localStorage doesn't have users) ----
  function ensureDemoUsers() {
    let users = loadUsersFromAnyKey();

    if (!users || users.length === 0) {
      users = [
        { username: "love", fullName: "Md Salim Biswas", role: "member", sponsor_username: "", binarySide: "", createdAt: Date.now() },

        { username: "a1", fullName: "A One", sponsor_username: "love", binarySide: "L", createdAt: Date.now() },
        { username: "b1", fullName: "B One", sponsor_username: "love", binarySide: "R", createdAt: Date.now() },

        { username: "a2", fullName: "A Two", sponsor_username: "a1", binarySide: "L", createdAt: Date.now() },
        { username: "a3", fullName: "A Three", sponsor_username: "a1", binarySide: "R", createdAt: Date.now() },

        { username: "b2", fullName: "B Two", sponsor_username: "b1", binarySide: "L", createdAt: Date.now() },
        { username: "b3", fullName: "B Three", sponsor_username: "b1", binarySide: "R", createdAt: Date.now() },
      ];
      saveUsersToDefault(users);
    }

    return users;
  }

  // ---- Build children map (Binary: L/R) ----
  function buildChildrenMap(users) {
    const map = new Map(); // sponsor -> {L: user, R: user, extra: []}

    for (const u of users) {
      const sponsor = (u.sponsor_username || u.sponsor || u.refCode || "").trim();
      if (!sponsor) continue;

      if (!map.has(sponsor)) map.set(sponsor, { L: null, R: null, extra: [] });

      const slot = map.get(sponsor);
      const side = (u.binarySide || u.side || "").toUpperCase().trim(); // L / R

      if (side === "L" && !slot.L) slot.L = u;
      else if (side === "R" && !slot.R) slot.R = u;
      else {
        // if side missing or duplicate slot taken
        if (!slot.L) slot.L = u;
        else if (!slot.R) slot.R = u;
        else slot.extra.push(u);
      }
    }
    return map;
  }

  function indexByUsername(users) {
    const idx = new Map();
    for (const u of users) {
      if (!u || !u.username) continue;
      idx.set(String(u.username).trim(), u);
    }
    return idx;
  }

  // ---- Tree Node Builder ----
  function getRootUsername() {
    const url = new URL(window.location.href);
    const q =
      url.searchParams.get("username") ||
      url.searchParams.get("user") ||
      url.searchParams.get("root") ||
      url.searchParams.get("u");

    if (q) return q.trim();

    const cu = getCurrentUser();
    if (cu && cu.username) return String(cu.username).trim();

    // fallback demo root
    return "love";
  }

  function buildTree(rootUsername, idx, childMap, maxDepth = 5) {
    function makeNode(username, depth) {
      if (!username) return null;
      const u = idx.get(username) || { username, fullName: username };
      const slot = childMap.get(username) || { L: null, R: null };

      const node = {
        user: u,
        depth,
        left: null,
        right: null
      };

      if (depth < maxDepth) {
        node.left = slot.L ? makeNode(String(slot.L.username).trim(), depth + 1) : null;
        node.right = slot.R ? makeNode(String(slot.R.username).trim(), depth + 1) : null;
      }
      return node;
    }

    return makeNode(rootUsername, 0);
  }

  // ---- UI Render ----
  function injectStyle() {
    const css = `
      .tree-wrap{
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.25);
        background:rgba(2,6,23,.35);
        min-height:420px;
        overflow:auto;
      }
      .level{
        display:flex;
        justify-content:center;
        gap:18px;
        margin:18px 0;
        flex-wrap:nowrap;
      }
      .pnode{
        width:180px;
        border-radius:14px;
        padding:10px 10px 9px;
        background:linear-gradient(180deg, rgba(15,23,42,.88), rgba(2,6,23,.75));
        border:1px solid rgba(56,189,248,.35);
        box-shadow: 0 18px 40px rgba(0,0,0,.55);
        position:relative;
        transform: perspective(800px) rotateX(6deg);
        transition: transform .15s, box-shadow .15s, border-color .15s;
        cursor:pointer;
        user-select:none;
      }
      .pnode:hover{
        transform: perspective(800px) rotateX(0deg) translateY(-3px);
        border-color: rgba(34,197,94,.55);
        box-shadow: 0 22px 55px rgba(0,0,0,.65);
      }
      .pnode .u{
        font-size:12px;
        color:#a5b4fc;
        margin-bottom:3px;
      }
      .pnode .n{
        font-size:14px;
        font-weight:700;
        color:#e5f0ff;
        line-height:1.15;
      }
      .pnode .meta{
        margin-top:6px;
        font-size:11px;
        color:#9ca3af;
        display:flex;
        justify-content:space-between;
        gap:8px;
      }
      .tag{
        padding:2px 8px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.35);
        background:rgba(2,6,23,.35);
        font-size:10px;
        letter-spacing:.12em;
        text-transform:uppercase;
        color:#e5e7eb;
      }
      .tagL{ border-color: rgba(56,189,248,.45); }
      .tagR{ border-color: rgba(34,197,94,.45); }

      .empty-slot{
        width:180px;
        border-radius:14px;
        padding:10px;
        border:1px dashed rgba(148,163,184,.25);
        background:rgba(2,6,23,.18);
        color:#64748b;
        font-size:12px;
        text-align:center;
      }

      .topbar-mini{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:10px;
      }

      .searchbox{
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap:wrap;
      }
      .searchbox input{
        padding:8px 12px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.28);
        background:rgba(2,6,23,.45);
        color:#e5f0ff;
        outline:none;
        min-width:220px;
      }
      .searchbox button{
        padding:8px 14px;
        border-radius:999px;
        border:none;
        cursor:pointer;
        background:linear-gradient(135deg,#38bdf8,#22c55e);
        color:#020617;
        font-size:11px;
        letter-spacing:.12em;
        text-transform:uppercase;
      }
      .hint{
        font-size:11px;
        color:#94a3b8;
      }
    `;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ensureStage() {
    // genealogy.html এ যদি treeStage না থাকে, বানিয়ে দেবে
    let stage = $("treeStage");
    if (!stage) {
      stage = document.createElement("div");
      stage.id = "treeStage";

      // try to put inside main content area
      const main = document.querySelector("main") || document.querySelector(".inner") || document.body;
      main.appendChild(stage);
    }
    return stage;
  }

  function collectLevels(root) {
    const levels = [];
    function walk(node, depth) {
      if (!levels[depth]) levels[depth] = [];
      levels[depth].push(node);

      // even if null child, keep placeholder to keep pyramid shape
      if (node && (node.left || node.right)) {
        walk(node.left || null, depth + 1);
        walk(node.right || null, depth + 1);
      } else if (node && depth < 5) {
        // pad remaining levels a bit (optional)
      }
    }
    walk(root, 0);

    // normalize pyramid: fill placeholders to keep symmetric
    // We will expand each next level to 2^depth
    const maxDepth = Math.min(levels.length - 1, 5);
    for (let d = 0; d <= maxDepth; d++) {
      const expected = Math.pow(2, d);
      while (levels[d].length < expected) levels[d].push(null);
    }
    return levels.slice(0, maxDepth + 1);
  }

  function nodeCard(u, sideLabel) {
    const div = document.createElement("div");
    div.className = "pnode";
    div.innerHTML = `
      <div class="u">@${escapeHTML(u.username || "-")}</div>
      <div class="n">${escapeHTML(u.fullName || u.username || "Member")}</div>
      <div class="meta">
        <span class="tag ${sideLabel==="L" ? "tagL" : sideLabel==="R" ? "tagR" : ""}">
          ${sideLabel ? sideLabel+"-Team" : "Member"}
        </span>
        <span>${u.role ? escapeHTML(u.role) : ""}</span>
      </div>
    `;
    div.addEventListener("click", () => {
      // focus this node as root
      const url = new URL(window.location.href);
      url.searchParams.set("username", u.username);
      window.location.href = url.toString();
    });
    return div;
  }

  function emptyCard() {
    const div = document.createElement("div");
    div.className = "empty-slot";
    div.textContent = "Empty";
    return div;
  }

  function escapeHTML(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render(stage, root, idx, childMap) {
    stage.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "tree-wrap";

    // mini toolbar (search)
    const top = document.createElement("div");
    top.className = "topbar-mini";
    const rootUser = root?.user?.username || "-";
    top.innerHTML = `
      <div class="hint">Top = <b>@${escapeHTML(rootUser)}</b> • Click any card to open its pyramid</div>
      <div class="searchbox">
        <input id="gSearchInput" placeholder="Search username (example: love, a1, b2)"/>
        <button id="gSearchBtn">Search</button>
      </div>
    `;
    wrap.appendChild(top);

    const levels = collectLevels(root);

    levels.forEach((arr, depth) => {
      const row = document.createElement("div");
      row.className = "level";

      arr.forEach((node, i) => {
        if (!node || !node.user) {
          row.appendChild(emptyCard());
          return;
        }

        // side label based on position: for depth>0 determine L/R by index
        // depth=1: 0=Left, 1=Right ; depth=2: 0..1 left side etc.
        let side = "";
        if (depth === 1) side = i === 0 ? "L" : "R";
        if (depth > 1) {
          // compute side relative to root: first half is L tree, second half is R tree
          const half = Math.pow(2, depth) / 2;
          side = i < half ? "L" : "R";
        }

        row.appendChild(nodeCard(node.user, side));
      });

      wrap.appendChild(row);
    });

    stage.appendChild(wrap);

    // Search action
    const input = $("gSearchInput");
    const btn = $("gSearchBtn");
    const doSearch = () => {
      const q = (input?.value || "").trim();
      if (!q) return;

      if (!idx.has(q)) {
        alert("User not found: " + q);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set("username", q);
      window.location.href = url.toString();
    };

    if (btn) btn.addEventListener("click", doSearch);
    if (input) input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
  }

  // ---- Init ----
  function init() {
    injectStyle();

    const stage = ensureStage();

    const users = ensureDemoUsers();
    const idx = indexByUsername(users);
    const childMap = buildChildrenMap(users);

    const rootUsername = getRootUsername();
    const root = buildTree(rootUsername, idx, childMap, 5);

    if (!root) {
      stage.innerHTML = `<div style="padding:14px;color:#fbbf24">
        Root user not found: <b>${rootUsername}</b><br>
        Please search a valid username.
      </div>`;
      return;
    }

    render(stage, root, idx, childMap);
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();