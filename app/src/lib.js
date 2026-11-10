// 共用的格式、日期與帳務計算。資料結構和原本一樣：customers、items、sales、expD（茶廠支出）、expP（茶廠收入）、expG（茶園支出）。

const NB = " ";
export const nf = new Intl.NumberFormat("zh-TW", {maximumFractionDigits: 2});
export const nf0 = new Intl.NumberFormat("zh-TW");
export const money = (n) => "NT$" + NB + nf0.format(Math.round(Number(n) || 0));
export const jin = (n) => nf.format(Math.round((Number(n) || 0) * 100) / 100) + NB + "斤";
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const mOf = (d) => (d ? parseInt(d.slice(5, 7), 10) : 0);
export const yrOf = (d) => (d ? d.slice(0, 4) : "");
export const sum = (a, k = "amount") => a.reduce((s, x) => s + Number(x[k] || 0), 0);

// 全站日期一律用台灣時間（GMT+8，沒有日光節約時間），不受手機或電腦的時區設定影響。
// 做法：把現在的時間加 8 小時，再用 UTC 格式取出「年-月-日」。
const TW_OFFSET_MS = 8 * 60 * 60 * 1000;
export const today = () => new Date(Date.now() + TW_OFFSET_MS).toISOString().slice(0, 10);
export const nowYM = () => {
    const t = today();
    return {y: Number(yrOf(t)), m: mOf(t)};
};
const WD = "日一二三四五六";
export const wd = (d) => WD[new Date(d + "T00:00:00Z").getUTCDay()];
export const md = (d) => (d ? `${mOf(d)}/${parseInt(d.slice(8, 10), 10)}` : "");
const shiftDay = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
export const dayLabel = (d) => {
    const t = today();
    const name = d === t ? "今天" : d === shiftDay(t, -1) ? "昨天" : `${mOf(d)}月${parseInt(d.slice(8, 10), 10)}日`;
    return `${name} 週${wd(d)}`;
};

// 期間：{mode: "month" | "year", y, m}
export const inPeriod = (d, p) => yrOf(d) === String(p.y) && (p.mode === "year" || mOf(d) === p.m);
export const pLabel = (p) => (p.mode === "year" ? `${p.y} 年` : `${p.y} 年 ${p.m} 月`);
export const pShort = (p) => (p.mode === "year" ? `${p.y}年` : `${p.m}月`);
export const thisMonth = () => ({mode: "month", ...nowYM()});
export const stepP = (p, d) => {
    const now = nowYM();
    if (p.mode === "year") return {...p, y: Math.min(now.y, p.y + d)};
    let m = p.m + d, y = p.y;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    if (y > now.y || (y === now.y && m > now.m)) return p;
    return {...p, y, m};
};
export const atEndP = (p) => {
    const now = nowYM();
    return p.mode === "year" ? p.y >= now.y : p.y > now.y || (p.y === now.y && p.m >= now.m);
};

export const compact = (v) => {
    const a = Math.abs(v);
    const s = a >= 10000 ? `${+(a / 10000).toFixed(1)}萬` : a >= 1000 ? `${+(a / 1000).toFixed(1)}千` : String(Math.round(a));
    return (v >= 0 ? "+" : "−") + s;
};
// 金額欄可以打 1200+800-300
export const evalExpr = (s) => String(s || "").split(/(?=[+\-])/).reduce((a, t) => a + (Number(t) || 0), 0);
export const hasOp = (s) => /[+\-]/.test(String(s || "").slice(1));
export const reduceMotion = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const typingTarget = (t) => t && t.closest && t.closest("input,textarea,select,[contenteditable]");

/* ---------- 帳務 ---------- */
export const KIND = {
    sale: {label: "銷售", icon: "leaf", tone: "tea", group: "in"},
    expP: {label: "茶廠收入", icon: "factory", tone: "celadon", group: "in"},
    expD: {label: "茶廠支出", icon: "receipt", tone: "clay", group: "out"},
    expG: {label: "茶園支出", icon: "sprout", tone: "moss", group: "out"},
};
// 紀錄種類 → Firestore 欄位
export const FIELD = {sale: "sales", expP: "expP", expD: "expD", expG: "expG", customer: "customers", item: "items"};
export const DEFAULT_CATS = {expD: ["宅配運費", "包裝紙盒", "茶罐採購", "電費", "炭焙木炭"], expG: ["茶園肥料", "採茶工資", "除草工資", "灌溉水管"]};
export const catIcon = (n, kind) => /運|宅配|寄/.test(n) ? "truck" : /盒|包裝|罐|袋/.test(n) ? "gift" : /電/.test(n) ? "zap" : /炭|柴|瓦斯/.test(n) ? "flame" : /肥/.test(n) ? "sprout"
    : /採茶|工資|人工/.test(n) ? "hand" : /草|修剪/.test(n) ? "scissors" : /水/.test(n) ? "droplets" : kind === "expG" ? "sprout" : "receipt";
export const soldBy = (sales) => {
    const m = {};
    sales.forEach((s) => { if (s.itemId) m[s.itemId] = (m[s.itemId] || 0) + Number(s.qty || 0); });
    return m;
};
// 剩 2 斤以下算偏低（和原本的顏色規則一樣）
export const stockState = (r) => (r <= 0 ? ["out", "已售完"] : r <= 2 ? ["low", "偏低"] : ["ok", "充足"]);
export const avTone = (name) => "a" + ([...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % 4);
// 頭像用名字的第一個字（跳過開頭的括號、符號）
export const initial = (name) => { const m = (name || "").match(/[\p{L}\p{N}]/u); return m ? m[0] : "?"; };

// 四種紀錄合成一條流水帳，新的在前
export function ledger(db) {
    const out = [];
    db.sales.forEach((r) => out.push({k: "sale", r, id: r.id, date: r.date, v: Number(r.amount) || 0, title: r.customerName || "未指定客戶",
        sub: `${r.itemName} · ${jin(r.qty)}${r.note ? " · " + r.note : ""}`, icon: "leaf", tone: "tea", unpaid: !r.paid}));
    db.expP.forEach((r) => out.push({k: "expP", r, id: r.id, date: r.date, v: Number(r.amount) || 0, title: r.who,
        sub: `茶廠收入 · ${jin(r.jin)}${Number(r.price) > 0 ? " × " + money(r.price) : ""}`, icon: "factory", tone: "celadon"}));
    db.expD.forEach((r) => out.push({k: "expD", r, id: r.id, date: r.date, v: -(Number(r.amount) || 0), title: r.item, sub: "茶廠支出", icon: catIcon(r.item, "expD"), tone: "clay"}));
    db.expG.forEach((r) => out.push({k: "expG", r, id: r.id, date: r.date, v: -(Number(r.amount) || 0), title: r.item, sub: "茶園支出", icon: catIcon(r.item, "expG"), tone: "moss"}));
    return out.sort((a, b) => b.date.localeCompare(a.date));
}

// 斤數 × 單價（四捨五入到元）；缺一就回傳空字串
export const calcQP = (q, p) => {
    const a = Number(q), b = Number(p);
    return a > 0 && b > 0 ? String(Math.round(a * b)) : "";
};
// 茶廠收入：這個人最近一筆「有單價」的紀錄（依日期；同一天取後輸入的）。excludeId：編輯時排除正在編輯的那筆。
export function lastPriceOf(list, who, excludeId) {
    const name = (who || "").trim();
    if (!name) return null;
    let best = null;
    list.forEach((r, i) => {
        if (r.id === excludeId || (r.who || "").trim() !== name || !(Number(r.price) > 0)) return;
        if (!best || r.date > best.r.date || (r.date === best.r.date && i > best.i)) best = {r, i};
    });
    return best ? best.r : null;
}
// 銷售：沿用同一位客戶買同一種茶的上次每斤價格，沒有就用這種茶最近一次的價格（只用來帶入金額，不另外存欄位）
export function lastSalePrice(sales, itemId, customerId, excludeId) {
    let mine = null, any = null;
    sales.forEach((s) => {
        if (s.id === excludeId || s.itemId !== itemId || !(Number(s.qty) > 0) || !(Number(s.amount) > 0)) return;
        if (!any || s.date > any.date) any = s;
        if (customerId && s.customerId === customerId && (!mine || s.date > mine.date)) mine = s;
    });
    const s = mine || any;
    if (!s) return null;
    return {price: Math.round(Number(s.amount) / Number(s.qty)), why: mine ? `沿用 ${s.customerName} ${md(s.date)} 的價格` : `沿用這種茶 ${md(s.date)} 的價格`};
}
export const recentNames = (list, key, excludeId, limit, needPrice) => {
    const latest = new Map();
    list.forEach((r) => {
        const n = (r[key] || "").trim();
        if (!n || r.id === excludeId || (needPrice && !(Number(r.price) > 0))) return;
        if (!latest.has(n) || r.date > latest.get(n)) latest.set(n, r.date);
    });
    return [...latest.entries()].sort((a, b) => b[1].localeCompare(a[1])).slice(0, limit).map(([n]) => n);
};
export const recentCustomers = (db, limit) => {
    const latest = new Map();
    db.sales.forEach((s) => { if (s.customerId && (!latest.has(s.customerId) || s.date > latest.get(s.customerId))) latest.set(s.customerId, s.date); });
    return db.customers.slice()
        .sort((a, b) => (latest.get(b.id) || "").localeCompare(latest.get(a.id) || "") || a.name.localeCompare(b.name, "zh-Hant"))
        .slice(0, limit);
};
export const yearsOf = (db) => {
    const set = new Set([...db.sales, ...db.expD, ...db.expP, ...db.expG].map((r) => Number(yrOf(r.date))).filter(Boolean));
    set.add(nowYM().y);
    return [...set].sort((a, b) => b - a);
};

/* ---------- 匯出 CSV（欄位和原本一樣） ---------- */
export function buildCsvRows(db, y, m, types) {
    const ys = String(y);
    const inP = (d) => yrOf(d.date) === ys && (m === "all" || mOf(d.date) === Number(m));
    const label = m === "all" ? "全年" : `${m}月`;
    const rows = [];
    const sep = () => { if (rows.length) rows.push([]); };
    if (types.sales) {
        sep();
        rows.push([`銷售明細（${ys} ${label}）`]);
        rows.push(["日期", "客戶", "品項", "斤數", "金額", "已匯款", "備註"]);
        const list = db.sales.filter(inP).sort((a, b) => a.date.localeCompare(b.date));
        list.forEach((s) => rows.push([s.date, s.customerName || "未指定", s.itemName, s.qty, s.amount, s.paid ? "是" : "否", s.note || ""]));
        rows.push(["合計", "", "", "", list.reduce((a, s) => a + Number(s.amount || 0), 0), "", ""]);
    }
    if (types.exp) {
        sep();
        rows.push([`開支明細（${ys} ${label}）`]);
        rows.push(["類型", "日期", "對象/事項", "斤數", "每斤單價", "金額"]);
        db.expD.filter(inP).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push(["茶廠支出", e.date, e.item, "", "", e.amount]));
        db.expP.filter(inP).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push(["茶廠收入", e.date, e.who, e.jin, Number(e.price) > 0 ? e.price : "", e.amount]));
        db.expG.filter(inP).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push(["茶園支出", e.date, e.item, "", "", e.amount]));
    }
    if (types.report) {
        sep();
        const sumIn = (arr) => arr.filter(inP).reduce((a, e) => a + Number(e.amount || 0), 0);
        const 園營收 = sumIn(db.sales), 園開支 = sumIn(db.expG), 廠營收 = sumIn(db.expP), 廠開支 = sumIn(db.expD);
        rows.push([`報表（${ys} ${label}）`]);
        rows.push(["區塊", "營收", "開支", "淨利"]);
        rows.push(["茶園", 園營收, 園開支, 園營收 - 園開支]);
        rows.push(["茶廠", 廠營收, 廠開支, 廠營收 - 廠開支]);
        rows.push([]);
        rows.push(["各月明細"]);
        rows.push(["月份", "茶園營收", "茶園支出", "茶廠收入", "茶廠支出", "淨利"]);
        const mlist = m === "all" ? Array.from({length: 12}, (_, i) => i + 1) : [Number(m)];
        mlist.forEach((mm) => {
            const inM = (d) => yrOf(d.date) === ys && mOf(d.date) === mm;
            const sale = sum(db.sales.filter(inM)), g = sum(db.expG.filter(inM)), p = sum(db.expP.filter(inM)), dd = sum(db.expD.filter(inM));
            if (sale || g || p || dd) rows.push([`${mm}月`, sale, g, p, dd, sale + p - g - dd]);
        });
    }
    return {rows, name: `茶葉匯出_${ys}_${label}.csv`};
}
export function downloadCsv(name, rows) {
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 偏好設定只存在這台裝置（主題、隱藏金額）
export const pref = {
    get: (k, d) => { try { const v = localStorage.getItem("tea-" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem("tea-" + k, JSON.stringify(v)); } catch { /* 私密瀏覽等情況存不了就算了 */ } },
};
