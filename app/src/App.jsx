import {useEffect, useRef, useState} from "react";
import {flushSync} from "react-dom";
import {initializeApp} from "firebase/app";
import {doc, getFirestore, onSnapshot, setDoc} from "firebase/firestore";
import {createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut} from "firebase/auth";
import {FINE, Icon, ThemeToggle, useMedia, useVisualViewport} from "./ui.jsx";
import EntryCore from "./Entry.jsx";
import {CustomerView, FormSheet, ItemView, SettingsSheet} from "./Views.jsx";
import {HomePhone, HomeWide} from "./Home.jsx";
import Stats from "./Stats.jsx";
import {Customers, Stock} from "./Lists.jsx";
import Login from "./Login.jsx";
import {FIELD, inPeriod, KIND, mOf, money, pref, reduceMotion, stepP, thisMonth, typingTarget, uid, yrOf} from "./lib.js";

const firebaseConfig = {
    apiKey: "AIzaSyDO_K_-UtsKOIThKVerk4itWY4df-MgCAU",
    authDomain: "tea-tools-8da4f.firebaseapp.com",
    projectId: "tea-tools-8da4f",
    storageBucket: "tea-tools-8da4f.firebasestorage.app",
    messagingSenderId: "349352673356",
    appId: "1:349352673356:web:e5ca1df9c8e78ef88734e9",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 單一帳號用的內部識別字串（使用者只需輸入 4 碼密碼；此字串不需真實存在）
const OWNER_EMAIL = "owner@tea-ledger.app";
const EMPTY = {customers: [], items: [], sales: [], expD: [], expP: [], expG: []};

function authMsg(code) {
    if (!code) return "發生錯誤，請稍後再試";
    if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "密碼不對，請再試一次";
    if (/email-already-in-use/.test(code)) return "已經設定過密碼，請改用登入";
    if (/weak-password/.test(code)) return "密碼長度不符";
    if (/too-many-requests/.test(code)) return "嘗試次數過多，請稍後再試";
    if (/network/.test(code)) return "網路連線異常，請檢查網路後再試";
    return "登入失敗，請確認網路後再試";
}

// 依視窗寬度決定版面：手機 <600、平板 600–1023、電腦 ≥1024（手機橫放高度不夠時仍用手機版）
const sizeOf = () => {
    const w = window.innerWidth, h = window.innerHeight;
    return w < 600 || (h < 500 && w < 1024) ? "phone" : w < 1024 ? "tablet" : "desktop";
};
function useSize() {
    const [s, setS] = useState(sizeOf);
    useEffect(() => {
        const h = () => setS(sizeOf());
        window.addEventListener("resize", h);
        return () => window.removeEventListener("resize", h);
    }, []);
    return s;
}

function Boot({text}) {
    return <div className="boot"><span className="seal lg">茶</span>{text}</div>;
}

export default function App() {
    const size = useSize();
    useVisualViewport();
    const [user, setUser] = useState(null), [authReady, setAuthReady] = useState(false);
    // 主題只有淺色、深色兩種，預設淺色（舊的「跟隨系統」當作淺色）
    const [theme, setThemeRaw] = useState(() => (pref.get("theme", "light") === "dark" ? "dark" : "light"));
    // 換主題：支援的瀏覽器用「新舊畫面淡入淡出」（GPU 處理，不卡），其他瀏覽器直接切換
    const setTheme = (t) => {
        pref.set("theme", t);
        const apply = () => {
            document.documentElement.dataset.theme = t;
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute("content", t === "dark" ? "#111714" : "#F4F6F1");
            flushSync(() => setThemeRaw(t));
        };
        if (document.startViewTransition && !reduceMotion()) document.startViewTransition(apply);
        else apply();
    };
    useEffect(() => {
        const r = document.documentElement;
        r.dataset.theme = theme;
        const meta = document.querySelectorAll('meta[name="theme-color"]');
        meta.forEach((m) => { m.setAttribute("content", theme === "dark" ? "#111714" : "#F4F6F1"); m.removeAttribute("media"); });
    }, [theme]);
    useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);

    const onAuth = async (mode, pin) => {
        try {
            const fn = mode === "signup" ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
            await fn(auth, OWNER_EMAIL, "tea" + pin);
            return null;
        } catch (e) {
            return authMsg(e.code || "");
        }
    };

    if (!authReady) return <Boot text="連線中…"/>;
    const wide = size !== "phone";
    if (!user) return <div className={"device " + size + (wide ? " wide" : "")}><Login size={size} onAuth={onAuth}/></div>;
    return <Ledger key={user.uid} user={user} size={size} theme={theme} setTheme={setTheme}/>;
}

function Ledger({user, size, theme, setTheme}) {
    const wide = size !== "phone";
    const [data, setData] = useState(EMPTY), [loading, setLoading] = useState(true);
    const dataRef = useRef(EMPTY);
    const [tab, setTabRaw] = useState("home");
    const [hp, setHp] = useState(thisMonth), [sp, setSp] = useState(thisMonth);
    const [pview, setPview] = useState("list"), [filter, setFilter] = useState("all"), [sel, setSel] = useState(null);
    const [masked, setMaskedRaw] = useState(() => pref.get("masked", false));
    const setMasked = (v) => { setMaskedRaw(v); pref.set("masked", v); };
    const [cq, setCq] = useState(""), [cSort, setCSort] = useState("name"), [selC, setSelC] = useState(null), [selI, setSelI] = useState(null);
    const [deskEdit, setDeskEdit] = useState(null), [newKey, setNewKey] = useState(0), [lastKind, setLastKind] = useState("sale");
    const [sheets, setSheets] = useState([]), [toasts, setToasts] = useState([]), [sync, setSync] = useState("ok");
    const [flash, setFlash] = useState(null), [removing, setRemoving] = useState([]);
    const scrollRef = useRef(null), pending = useRef(0);
    const fine = useMedia(FINE);

    // 雲端資料：ledgers/{uid}，一個文件裡六個陣列
    useEffect(() => {
        const ref = doc(db, "ledgers", user.uid);
        return onSnapshot(ref, (snap) => {
            const d = snap.exists() ? snap.data() : {};
            const next = {customers: d.customers || [], items: d.items || [], sales: d.sales || [], expD: d.expD || [], expP: d.expP || [], expG: d.expG || []};
            dataRef.current = next;
            setData(next);
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
            toast("讀取雲端資料失敗，請檢查網路後重新整理");
        });
    }, [user.uid]); // eslint-disable-line react-hooks/exhaustive-deps

    const toast = (text, opt = {}) => {
        const id = uid();
        setToasts((a) => [...a.slice(-1), {id, text, ...opt}]);
        setTimeout(() => {
            setToasts((a) => a.map((t) => (t.id === id ? {...t, leaving: true} : t)));
            setTimeout(() => setToasts((a) => a.filter((t) => t.id !== id)), 220);
        }, opt.action ? 6000 : 3500);
    };
    // 寫回整個欄位（和原本一樣用 merge），畫面先更新，雲端確認後才顯示「已同步」
    const write = (field, next) => {
        dataRef.current = {...dataRef.current, [field]: next};
        setData(dataRef.current);
        pending.current++;
        setSync("saving");
        setDoc(doc(db, "ledgers", user.uid), {[field]: next}, {merge: true}).then(() => {
            pending.current--;
            if (!pending.current) setSync("ok");
        }, (e) => {
            console.error("儲存失敗", e);
            pending.current--;
            setSync("error");
            toast("沒有存到雲端，請檢查網路後再試一次");
        });
    };
    const list = (field) => dataRef.current[field];

    const setTab = (k) => {
        setTabRaw(k);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    };
    const openSheet = (s) => setSheets((a) => [...a, {id: uid(), ...s}]);
    const closeSheet = (id) => {
        setSheets((a) => a.map((s) => (s.id === id ? {...s, closing: true} : s)));
        setTimeout(() => setSheets((a) => a.filter((s) => s.id !== id)), reduceMotion() ? 0 : 340);
    };
    const closeAll = () => {
        setSheets((a) => a.map((s) => ({...s, closing: true})));
        setTimeout(() => setSheets([]), reduceMotion() ? 0 : 340);
    };
    const doFlash = (id) => {
        setFlash(id);
        setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600);
    };
    const deskEntry = size === "desktop" && tab === "home";
    const startNew = (kind) => {
        if (size === "desktop") {
            setTab("home");
            setDeskEdit(null);
            if (kind) setLastKind(kind);
            setNewKey((k) => k + 1);
        } else openSheet({kind: "entry", entryKind: kind || "sale"});
    };

    const saveRec = (type, rec0, sheetId) => {
        const field = FIELD[type], isNew = !rec0.id, rec = isNew ? {...rec0, id: uid()} : rec0;
        const cur = list(field);
        write(field, isNew ? [...cur, rec] : cur.map((x) => (x.id === rec.id ? rec : x)));
        if (sheetId) closeSheet(sheetId);
        doFlash(rec.id);
        if (KIND[type]) {
            if (!sheetId) { setDeskEdit(null); setLastKind(type); setNewKey((x) => x + 1); }
            if (isNew && !inPeriod(rec.date, hp)) { setHp({mode: "month", y: Number(yrOf(rec.date)), m: mOf(rec.date)}); setSel(null); }
            toast(`${isNew ? "已記下" : "已更新"}${KIND[type].label} ${money(rec.amount)}`,
                isNew && size !== "desktop" ? {action: () => openSheet({kind: "entry", entryKind: type}), label: "再記一筆", icon: "plus"} : {});
        } else toast(`${isNew ? "已新增" : "已更新"}${type === "customer" ? "客戶" : "茶種"}「${rec.name}」`);
    };
    // 刪除後 6 秒內可以復原
    const removeRec = (type, rec) => {
        const field = FIELD[type], label = KIND[type] ? `${KIND[type].label} ${money(rec.amount)}` : `「${rec.name}」`;
        closeAll();
        if (deskEdit && deskEdit.r.id === rec.id) { setDeskEdit(null); setNewKey((x) => x + 1); }
        if (selC === rec.id) setSelC(null);
        if (selI === rec.id) setSelI(null);
        const wait = reduceMotion() ? 0 : 260;
        setTimeout(() => {
            setRemoving((r) => [...r, rec.id]);
            setTimeout(() => {
                const cur = list(field), at = cur.findIndex((x) => x.id === rec.id);
                write(field, cur.filter((x) => x.id !== rec.id));
                setRemoving((r) => r.filter((i) => i !== rec.id));
                toast(`已刪除 ${label}`, {
                    label: "復原", icon: "undo", action: () => {
                        const now = list(field);
                        if (now.some((x) => x.id === rec.id)) return;
                        const arr = [...now];
                        arr.splice(at < 0 ? arr.length : Math.min(at, arr.length), 0, rec);
                        write(field, arr);
                        doFlash(rec.id);
                        toast("已復原");
                    },
                });
            }, reduceMotion() ? 0 : 230);
        }, wait);
    };
    const setPaid = (s, paid) => write("sales", list("sales").map((x) => (x.id === s.id ? {...x, paid} : x)));
    const markPaid = (s) => {
        setPaid(s, true);
        toast(`${s.customerName || "這筆"} ${money(s.amount)} 標記為已收`, {label: "復原", icon: "undo", action: () => setPaid(s, false)});
    };
    const onAction = (t) => {
        setToasts((a) => a.filter((x) => x.id !== t.id));
        t.action();
    };
    const top = sheets.filter((s) => !s.closing).slice(-1)[0];
    const openRow = (e) => (deskEntry ? setDeskEdit({k: e.k, r: e.r}) : openSheet({kind: "entry", entryKind: e.k, rec: e.r}));
    const addItem = () => openSheet({kind: "form", type: "item"});

    // 電腦版快捷鍵：N 新的一筆、← → 換月
    useEffect(() => {
        const h = (e) => {
            if (typingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || loading) return;
            if ((e.key === "n" || e.key === "N") && !sheets.length && wide) { e.preventDefault(); startNew(); }
            else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && tab === "home" && !sheets.length && wide) {
                e.preventDefault();
                setHp((p) => stepP(p, e.key === "ArrowLeft" ? -1 : 1));
                setSel(null);
            }
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    });

    if (loading) return <Boot text="載入資料中…"/>;

    const sheetEls = sheets.map((s, i) => {
        const c = {sheet: s, level: i, db: data, wide};
        if (s.kind === "entry") return <EntryCore key={s.id} {...c} entryKind={s.entryKind} rec={s.rec} presetCustomer={s.presetCustomer} keyboard={!s.closing && i === sheets.length - 1}
                                                  onClose={() => closeSheet(s.id)} onSave={(t, d) => saveRec(t, d, s.id)} onDelete={removeRec} onAddItem={addItem}/>;
        if (s.kind === "form") return <FormSheet key={s.id} {...c} onClose={() => closeSheet(s.id)} onSave={(t, d) => saveRec(t, d, s.id)} onDelete={removeRec}/>;
        if (s.kind === "customer") return <CustomerView key={s.id} {...c} cid={s.cid} onClose={() => closeSheet(s.id)} onEdit={(cu) => openSheet({kind: "form", type: "customer", rec: cu})} onPaid={markPaid}
                                                        onOpenEntry={(cu) => openSheet({kind: "entry", entryKind: "sale", presetCustomer: cu})}/>;
        if (s.kind === "item") return <ItemView key={s.id} {...c} iid={s.iid} onClose={() => closeSheet(s.id)} onEdit={(it) => openSheet({kind: "form", type: "item", rec: it})}/>;
        if (s.kind === "settings") return <SettingsSheet key={s.id} {...c} masked={masked} setMasked={setMasked} sync={sync} onClose={() => closeSheet(s.id)}
                                                         onLogout={() => { setSheets([]); signOut(auth); }}
                                                         onExported={(name) => { closeSheet(s.id); toast(`已匯出「${name}」`); }}/>;
        return null;
    });

    const entryPanel = deskEntry ? <EntryCore key={deskEdit ? "e-" + deskEdit.r.id : "n-" + newKey} panel db={data} wide keyboard={!sheets.length}
                                              entryKind={deskEdit ? deskEdit.k : lastKind} rec={deskEdit ? deskEdit.r : undefined} onAddItem={addItem}
                                              onClose={() => { setDeskEdit(null); setNewKey((k) => k + 1); }} onSave={(t, d) => saveRec(t, d, null)} onDelete={removeRec}/> : null;
    const firstByName = (data.customers.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))[0] || {}).id;
    const recentC = () => {
        const s = data.sales.slice().sort((a, b) => b.date.localeCompare(a.date)).find((x) => x.customerId && data.customers.some((c) => c.id === x.customerId));
        return s ? s.customerId : firstByName;
    };
    const curC = (selC && data.customers.some((c) => c.id === selC) ? selC : null) || (wide ? recentC() : null);
    const curI = (selI && data.items.some((i) => i.id === selI) ? selI : null) || (size === "desktop" && data.items[0] ? data.items[0].id : null);

    let content = null;
    const homeProps = {db: data, p: hp, setP: setHp, view: pview, setView: setPview, filter, setFilter, sel, setSel, masked, setMasked, sync, size, theme, setTheme,
        openSettings: () => openSheet({kind: "settings"}), onOpen: openRow, onPaid: markPaid, flash, removing, entryPanel, selected: deskEdit ? deskEdit.r.id : null};
    if (tab === "home") content = size === "phone" ? <HomePhone {...homeProps}/> : <HomeWide {...homeProps}/>;
    if (tab === "stats") content = <Stats db={data} p={sp} setP={setSp} masked={masked} setMasked={setMasked} size={size}/>;
    if (tab === "stock") content = <Stock db={data} size={size} selected={curI} onAdd={addItem}
                                          onOpen={(it) => (size === "desktop" ? setSelI(it.id) : openSheet({kind: "item", iid: it.id}))}
                                          detail={size === "desktop" ? <ItemView key={curI} iid={curI} panel db={data} wide onEdit={(it) => openSheet({kind: "form", type: "item", rec: it})}/> : null}/>;
    if (tab === "customers") content = <Customers db={data} size={size} q={cq} setQ={setCq} sort={cSort} setSort={setCSort} selected={wide ? curC : null} removing={removing}
                                                  onDelete={(cu) => removeRec("customer", cu)}
                                                  onOpen={(cu) => (wide ? setSelC(cu.id) : openSheet({kind: "customer", cid: cu.id}))} onAdd={() => openSheet({kind: "form", type: "customer"})}
                                                  detail={wide ? <CustomerView key={curC} cid={curC} panel db={data} wide onEdit={(cu) => openSheet({kind: "form", type: "customer", rec: cu})} onPaid={markPaid}
                                                                               onOpenEntry={(cu) => openSheet({kind: "entry", entryKind: "sale", presetCustomer: cu})}/> : null}/>;

    const tabsDef = [["home", "明細", "list"], ["stats", "報表", "pie"], ["stock", "庫存", "box"], ["customers", "客戶", "users"]];
    const pushed = size === "phone" && sheets.some((s) => !s.closing);
    const fixedLayout = size === "desktop" ? tab !== "stats" : size === "tablet" && tab === "customers";

    let appEl;
    if (size === "phone") {
        const navs = [tabsDef[0], tabsDef[1], null, tabsDef[2], tabsDef[3]];
        appEl = (
            <div className={"app phone" + (pushed ? " pushed" : "") + (masked ? " masked" : "")}>
                <div className="scroll" ref={scrollRef}><div className="inner">{content}</div></div>
                <nav className="nav" aria-label="主要分頁">
                    {navs.map((n) => n
                        ? <button key={n[0]} className="nav-item" aria-current={tab === n[0] ? "page" : undefined} onClick={() => setTab(n[0])}><Icon n={n[2]} s={23}/>{n[1]}</button>
                        : <button key="add" className="add" aria-label="記一筆" onClick={() => startNew()}><Icon n="plus" s={30} w={2.4}/></button>)}
                    <span className="add-label">記一筆</span>
                </nav>
            </div>
        );
    } else {
        appEl = (
            <div className={"app " + size + (masked ? " masked" : "")}>
                <header className="dbar">
                    <span className="dbrand"><span className="seal">茶</span><b>茶葉記帳</b>
                        <span className={"sync " + sync}><Icon n={sync === "saving" ? "refresh" : sync === "error" ? "cloudAlert" : "cloudCheck"} s={14}/>
                            {sync === "saving" ? "同步中…" : sync === "error" ? "未同步" : "已同步"}</span></span>
                    <nav className="dtabs" aria-label="主要分頁">{tabsDef.map(([k, t, ic]) => (
                        <button key={k} className="dtab" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}><Icon n={ic} s={18}/>{t}</button>))}</nav>
                    <span className="dact">
                        <ThemeToggle theme={theme} setTheme={setTheme}/>
                        <button className="icon-btn" aria-label={masked ? "顯示金額" : "隱藏金額"} onClick={() => setMasked(!masked)}><Icon n={masked ? "eyeOff" : "eye"}/></button>
                        <button className="icon-btn" aria-label="設定" onClick={() => openSheet({kind: "settings"})}><Icon n="settings"/></button>
                        {size === "desktop" ? <button className="btn primary sm" onClick={() => startNew()}><Icon n="plus" s={18}/>記一筆{fine ? <kbd className="kb">N</kbd> : null}</button> : null}
                    </span>
                </header>
                <div className={"content" + (fixedLayout ? " fixed" : "")} ref={scrollRef}><div className={"content-in " + tab}>{content}</div></div>
                {size === "tablet" && tab !== "customers" ? <button className="fab" onClick={() => startNew()}><Icon n="plus" s={24} w={2.4}/>記一筆</button> : null}
            </div>
        );
    }

    return (
        <div className={"device " + size + (wide ? " wide" : "")}>
            {appEl}{sheetEls}
            <div className="toasts" aria-live="polite">{toasts.map((t) => (
                <div key={t.id} className={"toast" + (t.leaving ? " leaving" : "")}>
                    <span className="msg">{t.text}{t.sub ? <small>{t.sub}</small> : null}</span>
                    {t.action ? <button onClick={() => onAction(t)}>{t.icon ? <Icon n={t.icon} s={16}/> : null}{t.label}</button> : null}
                </div>))}</div>
        </div>
    );
}
