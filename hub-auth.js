// ============================================================
// hub-auth.js — Google 账户统一入口
// 职责：
//   1. 初始化 Firebase（Auth + Firestore），供 manager.js / notes.js 复用
//   2. 页面右上角的全局登录入口与用户菜单
//   3. 笔记 / 连通性 / Plan 管理三个视图的登录门控
//   4. 订阅 Plan 管理归档记录名称（Plan 名称 / 优惠名称），向连通性页面广播（hub-archived-plans 事件）
// 内联脚本通过 window.HubAuth 访问本模块能力。
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  getFirestore,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCb2KYknXU04OxEpFIVbmCFXRoHNJ2cA5g",
  authDomain: "ai-resource-hub-manager.firebaseapp.com",
  projectId: "ai-resource-hub-manager",
  storageBucket: "ai-resource-hub-manager.firebasestorage.app",
  messagingSenderId: "926784069813",
  appId: "1:926784069813:web:41b8bd97dd1cfd102c5efc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// 模块初始化时设置持久化与捕获重定向回调，避免在点击时异步消耗浏览器手势权限
setPersistence(auth, browserLocalPersistence).catch(() => {});
getRedirectResult(auth).catch(err => {
  console.warn("getRedirectResult error:", err);
});

// 需要登录 Google 账号才能查看内容的视图
const GATED_VIEWS = ["notes", "expenses", "connectivity", "manage"];

const els = {
  account: document.getElementById("hub-account"),
  signin: document.getElementById("hub-signin"),
  user: document.getElementById("hub-user"),
  menuButton: document.getElementById("hub-user-menu-button"),
  menu: document.getElementById("hub-user-menu"),
  userName: document.getElementById("hub-user-name"),
  userEmail: document.getElementById("hub-user-email"),
  avatar: document.getElementById("hub-user-avatar"),
  avatarFallback: document.getElementById("hub-user-avatar-fallback"),
  menuAvatar: document.getElementById("hub-menu-avatar"),
  menuAvatarFallback: document.getElementById("hub-menu-avatar-fallback"),
  signout: document.getElementById("hub-signout")
};

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

let toastTimer = null;
function showToast(message, type = "info", duration = 4500) {
  let toast = document.getElementById("hub-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "hub-toast";
    toast.className = "hub-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `hub-toast ${type}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function setLockMessages(message, type = "") {
  document.querySelectorAll("[data-hub-message]").forEach(el => {
    el.textContent = message;
    el.hidden = !message;
    el.classList.toggle("error", type === "error");
  });
}

function setSigninLoading(loading, customText = "") {
  const buttons = [els.signin, ...document.querySelectorAll("[data-hub-signin]")].filter(Boolean);
  buttons.forEach(btn => {
    btn.disabled = loading;
    if (loading) {
      if (!btn.dataset.origText) btn.dataset.origText = btn.textContent;
      btn.textContent = customText || "正在登录…";
      btn.style.opacity = "0.75";
      btn.style.cursor = "wait";
    } else {
      btn.textContent = btn.dataset.origText || "Google 登录";
      btn.style.opacity = "";
      btn.style.cursor = "";
    }
  });
}

let isSigningIn = false;
async function signInWithGoogle() {
  if (isSigningIn) return;
  isSigningIn = true;
  setSigninLoading(true);
  setLockMessages("正在打开 Google 登录…");
  showToast("正在连接 Google 账号…", "info", 3000);

  try {
    // 直接在用户点击手势内调用 signInWithPopup（无前置 await），保障浏览器允许弹出窗口
    await signInWithPopup(auth, googleProvider);
    setLockMessages("");
    showToast("登录成功！", "info", 2000);
  } catch (error) {
    const code = error?.code || "";
    let text = error?.message || "登录失败，请稍后重试。";
    let isError = true;

    if (code.includes("popup-blocked")) {
      text = "浏览器拦截了登录弹窗，正在为您切换为整页跳转登录…";
      showToast(text, "info", 5000);
      setLockMessages(text);
      setSigninLoading(true, "正在跳转…");
      try {
        await signInWithRedirect(auth, googleProvider);
        return;
      } catch (redirErr) {
        text = "跳转登录失败，请在浏览器地址栏允许弹出窗口后重试。";
        showToast(text, "error", 6000);
      }
    } else if (code.includes("popup-closed")) {
      text = "登录已取消（窗口已关闭）";
      isError = false;
      showToast(text, "info", 2500);
    } else if (code.includes("network-request-failed")) {
      text = "网络连接超时：访问 Google 账号需要科学上网/代理环境，请检查代理后重试。";
      showToast(text, "error", 7000);
    } else if (code.includes("unauthorized-domain")) {
      text = "当前域名尚未在 Firebase Authentication 的 Authorized domains 中授权。";
      showToast(text, "error", 7000);
    } else {
      showToast(text, "error", 5000);
    }
    setLockMessages(text, isError ? "error" : "");
  } finally {
    isSigningIn = false;
    setSigninLoading(false);
  }
}

// ---- Plan 管理归档 → 连通性页面广播 ----
// 匹配对象是已归档记录的名称（Plan 名称 / 优惠名称），与提供方字段无关。
let plansUnsubscribe = null;
let promotionsUnsubscribe = null;
let archivedPlanNames = [];
let archivedPromotionNames = [];
const archivedPlanProviders = new Set();

function broadcastArchivedPlans() {
  document.dispatchEvent(new CustomEvent("hub-archived-plans", {
    detail: { providers: [...archivedPlanProviders] }
  }));
}

function rebuildArchivedNames() {
  archivedPlanProviders.clear();
  [...archivedPlanNames, ...archivedPromotionNames].forEach(text => {
    if (text) archivedPlanProviders.add(text);
  });
  broadcastArchivedPlans();
}

function subscribeArchivedNames(uid) {
  if (plansUnsubscribe) { plansUnsubscribe(); plansUnsubscribe = null; }
  if (promotionsUnsubscribe) { promotionsUnsubscribe(); promotionsUnsubscribe = null; }
  archivedPlanNames = [];
  archivedPromotionNames = [];
  if (!uid) { rebuildArchivedNames(); return; }
  plansUnsubscribe = onSnapshot(collection(db, "users", uid, "plans"), snapshot => {
    archivedPlanNames = snapshot.docs
      .filter(entry => entry.data().archived)
      .map(entry => String(entry.data().name || "").trim())
      .filter(Boolean);
    rebuildArchivedNames();
  }, rebuildArchivedNames);
  promotionsUnsubscribe = onSnapshot(collection(db, "users", uid, "promotions"), snapshot => {
    archivedPromotionNames = snapshot.docs
      .filter(entry => entry.data().archived)
      .map(entry => String(entry.data().title || "").trim())
      .filter(Boolean);
    rebuildArchivedNames();
  }, rebuildArchivedNames);
}

// ---- 通用用户数据读写（供内联脚本经 window.HubAuth 调用）----
function saveUserData(segments, data) {
  return setDoc(doc(db, ...segments), data);
}
async function loadUserData(segments) {
  const snapshot = await getDoc(doc(db, ...segments));
  return snapshot.exists() ? snapshot.data() : null;
}

// ---- 认证状态变化：门控视图 + 全局账号 UI ----
const authListeners = new Set();
let latestUser = null;

onAuthStateChanged(auth, user => {
  latestUser = user;
  document.body.classList.toggle("hub-signed-in", Boolean(user));
  GATED_VIEWS.forEach(name => {
    const view = document.getElementById(`view-${name}`);
    if (view) view.toggleAttribute("data-hub-locked", !user);
  });

  if (els.account) {
    els.account.dataset.state = user ? "signed-in" : "signed-out";
    els.signin.hidden = Boolean(user);
    els.user.hidden = !user;
  }
  if (user) {
    els.userName.textContent = user.displayName || "Google 用户";
    els.userEmail.textContent = user.email || "";
    const avatarUrl = safeUrl(user.photoURL);
    els.avatar.hidden = !avatarUrl;
    els.avatarFallback.hidden = Boolean(avatarUrl);
    els.menuAvatar.hidden = !avatarUrl;
    els.menuAvatarFallback.hidden = Boolean(avatarUrl);
    const initial = (user.displayName || user.email || "U").trim().slice(0, 1).toUpperCase();
    els.avatarFallback.textContent = initial;
    els.menuAvatarFallback.textContent = initial;
    if (avatarUrl) {
      els.avatar.src = avatarUrl;
      els.menuAvatar.src = avatarUrl;
    }
  } else {
    els.menu.hidden = true;
    els.menuButton.setAttribute("aria-expanded", "false");
  }

  subscribeArchivedNames(user?.uid || null);

  document.dispatchEvent(new CustomEvent("hub-auth-change", {
    detail: { signedIn: Boolean(user), uid: user?.uid || null }
  }));
  authListeners.forEach(cb => { try { cb(user); } catch {} });
});

function toggleUserMenu(force) {
  if (!els.menu || !els.menuButton) return;
  const willOpen = typeof force === "boolean" ? force : els.menu.hidden;
  els.menu.hidden = !willOpen;
  els.menuButton.setAttribute("aria-expanded", String(willOpen));
}

if (els.signin) els.signin.onclick = signInWithGoogle;
document.querySelectorAll("[data-hub-signin]").forEach(btn => { btn.onclick = signInWithGoogle; });
if (els.menuButton) {
  els.menuButton.onclick = event => {
    event.stopPropagation();
    toggleUserMenu();
  };
}

if (!window.__hub_doc_click_bound__) {
  window.__hub_doc_click_bound__ = true;
  document.addEventListener("click", event => {
    if (els.account && !els.account.contains(event.target)) {
      toggleUserMenu(false);
    }
  });
}

function handleSignOut() {
  if (GATED_VIEWS.some(name => location.hash.startsWith(`#${name}`))) {
    location.hash = "#tools";
  }
  return signOut(auth);
}

if (els.signout) els.signout.onclick = handleSignOut;

export { auth, db };

export const HubAuth = {
  auth,
  db,
  googleProvider,
  signIn: signInWithGoogle,
  signOut: handleSignOut,
  getUser: () => auth.currentUser,
  getArchivedPlanProviders: () => [...archivedPlanProviders],
  saveUserData,
  loadUserData,
  // 订阅认证变化；注册时立即回放当前状态，避免订阅过晚错过初始事件
  onChange: cb => {
    authListeners.add(cb);
    try { cb(latestUser); } catch {}
    return () => authListeners.delete(cb);
  }
};

window.HubAuth = HubAuth;
