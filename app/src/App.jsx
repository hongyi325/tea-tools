import React, {useState, useEffect, useMemo} from "react";
import {
    Users, Package, ShoppingBag, Wallet, BarChart3, Plus, Search, Pencil, Trash2,
    Download, X, Phone, MapPin, Leaf, Calendar, TrendingUp, TrendingDown, Coins,
    AlertTriangle, ChevronDown, ChevronRight, Check, CheckCircle2, Circle
} from "lucide-react";
import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend} from "recharts";
import {initializeApp} from "firebase/app";
import {getFirestore, doc, onSnapshot, setDoc} from "firebase/firestore";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut
} from "firebase/auth";

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
const KEY = {customer: "customers", item: "items", sale: "sales", expD: "expD", expP: "expP", expG: "expG"};

const nf = new Intl.NumberFormat("zh-TW", {maximumFractionDigits: 3});
const money = (n) => "NT$ " + nf.format(Math.round(Number(n) || 0));
const jin = (n) => nf.format(Math.round((Number(n) || 0) * 100) / 100) + " 斤";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mOf = (d) => (d ? parseInt(d.slice(5, 7), 10) : 0);
const yrOf = (d) => (d ? d.slice(0, 4) : "");
// 全站日期一律用台灣時間（GMT+8，沒有日光節約時間），不受手機或電腦的時區設定影響。
// 做法：把現在的時間加 8 小時，再用 UTC 格式取出「年-月-日」。
const TW_OFFSET_MS = 8 * 60 * 60 * 1000;
const today = () => new Date(Date.now() + TW_OFFSET_MS).toISOString().slice(0, 10);

// ---- 茶廠收入：每斤單價 ----
// 金額 = 斤數 × 每斤單價（四捨五入到元）；兩者缺一就回傳空字串。
const calcAmount = (d) => {
    const j = Number(d.jin), p = Number(d.price);
    return j > 0 && p > 0 ? String(Math.round(j * p)) : "";
};
// 這個人最近一筆「有單價」的茶廠收入（依日期；同一天取後輸入的）。excludeId：編輯時排除正在編輯的那筆。
function lastPriceOf(list, who, excludeId) {
    const name = (who || "").trim();
    if (!name) return null;
    let best = null;
    list.forEach((r, i) => {
        if (r.id === excludeId || (r.who || "").trim() !== name || !(Number(r.price) > 0)) return;
        if (!best || r.date > best.r.date || (r.date === best.r.date && i > best.i)) best = {r, i};
    });
    return best ? best.r : null;
}
// 最近有記過單價的對象，給彈窗裡的快速選擇用。
function recentPayers(list, excludeId, limit = 6) {
    const latest = new Map();
    list.forEach((r) => {
        const name = (r.who || "").trim();
        if (!name || r.id === excludeId || !(Number(r.price) > 0)) return;
        if (!latest.has(name) || r.date > latest.get(name)) latest.set(name, r.date);
    });
    return [...latest.entries()]
        .sort((a, b) => b[1].localeCompare(a[1]))
        .slice(0, limit)
        .map(([name]) => ({name, price: Number(lastPriceOf(list, name, excludeId).price)}));
}
const md = (d) => (d ? `${mOf(d)}/${parseInt(d.slice(8, 10), 10)}` : "");

const EXP_MODES = {
    factoryOut: {type: "expD", label: "茶廠支出", kind: "io"},
    factoryIn: {type: "expP", label: "茶廠收入", kind: "who"},
    gardenOut: {type: "expG", label: "茶園支出", kind: "io"},
};

function authMsg(code) {
    if (!code) return "發生錯誤，請稍後再試。";
    if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "密碼錯誤。";
    if (/email-already-in-use/.test(code)) return "已設定過密碼，請改用登入。";
    if (/weak-password/.test(code)) return "密碼長度不符。";
    if (/too-many-requests/.test(code)) return "嘗試次數過多，請稍後再試。";
    if (/network/.test(code)) return "網路連線異常。";
    return "登入失敗，請確認 Firebase 設定與網路。";
}

const CSS = `
.ta-root{--bg:#FAF8F3;--card:#FFFFFF;--ink:#3D3A34;--muted:#9A9283;--line:#ECE6DA;
--sage:#7C9A7E;--sage-d:#5F7E62;--sage-soft:#EDF1EC;--clay:#C28A78;--clay-d:#A86E5C;
--clay-soft:#F6ECE7;--gold:#C9A86A;--gold-d:#A98A4A;--field:#FCFAF6;
font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,-apple-system,sans-serif;
color:var(--ink);-webkit-font-smoothing:antialiased;}
.ta-card{background:var(--card);border:1px solid var(--line);border-radius:18px;
box-shadow:0 1px 2px rgba(60,55,45,.04),0 10px 28px -20px rgba(60,55,45,.18);}
.ta-input{width:100%;box-sizing:border-box;background:var(--field);border:1px solid var(--line);
border-radius:12px;padding:10px 12px;font-size:14px;color:var(--ink);outline:none;
transition:border-color .15s,box-shadow .15s;font-family:inherit;}
.ta-input:focus{border-color:var(--sage);box-shadow:0 0 0 3px var(--sage-soft);}
.ta-input::placeholder{color:#C2BBAD;}
.ta-field{display:flex;flex-direction:column;gap:6px;}
.ta-label{font-size:12.5px;color:var(--muted);font-weight:500;letter-spacing:.02em;}
.ta-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;
cursor:pointer;border-radius:12px;font-size:14px;font-weight:500;padding:10px 16px;
transition:background .15s,transform .08s,opacity .15s;font-family:inherit;}
.ta-btn:active{transform:translateY(1px);}
.ta-btn:disabled{opacity:.45;cursor:not-allowed;}
.ta-primary{background:var(--sage);color:#fff;}
.ta-primary:hover{background:var(--sage-d);}
.ta-ghost{background:transparent;color:var(--muted);border:1px solid var(--line);}
.ta-ghost:hover{background:#F3EFE7;color:var(--ink);}
.ta-danger{background:var(--clay);color:#fff;}
.ta-danger:hover{background:var(--clay-d);}
.ta-tab{display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:11px;
font-size:14px;font-weight:500;cursor:pointer;color:var(--muted);transition:all .15s;
border:none;background:transparent;font-family:inherit;}
.ta-tab:hover{color:var(--ink);background:#F3EFE7;}
.ta-tab-on{background:var(--sage);color:#fff;}
.ta-tab-on:hover{background:var(--sage-d);color:#fff;}
.ta-row{transition:background .12s;}
.ta-row:hover{background:#FBF9F4;}
.ta-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;
border-radius:9px;border:none;background:transparent;cursor:pointer;color:var(--muted);transition:all .15s;}
.ta-icon-btn:hover{background:#F0EBE1;color:var(--ink);}
.ta-overlay{position:fixed;inset:0;background:rgba(54,49,40,.32);backdrop-filter:blur(2px);
display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;}
.ta-chip{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:500;}
.ta-paid{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;
font-size:12px;font-weight:500;border:none;cursor:pointer;font-family:inherit;transition:filter .15s;}
.ta-paid:hover{filter:brightness(.96);}
.ta-scroll::-webkit-scrollbar{height:8px;width:8px;}
.ta-scroll::-webkit-scrollbar-thumb{background:#E2DCCF;border-radius:8px;}
.ta-select{appearance:none;background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239A9283' stroke-width='2.5'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e");
background-repeat:no-repeat;background-position:right 12px center;padding-right:34px;}
.ta-seg{display:inline-flex;background:#F3EFE7;border-radius:11px;padding:3px;gap:2px;flex-wrap:wrap;}
.ta-seg button{border:none;background:transparent;padding:7px 13px;border-radius:9px;font-size:13.5px;
font-weight:500;cursor:pointer;color:var(--muted);font-family:inherit;transition:all .15s;}
.ta-seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(60,55,45,.1);}
.ta-stock{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:11px;
background:var(--field);border:1px solid var(--line);font-size:13px;}
.ta-affix{position:relative;}
.ta-affix .ta-input{padding-right:40px;}
.ta-affix.ta-has-pre .ta-input{padding-left:44px;}
.ta-affix-txt{position:absolute;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none;}
.ta-pick{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:-6px;}
.ta-pick-cap{font-size:12px;color:var(--muted);margin-right:2px;}
.ta-pick button{display:inline-flex;align-items:baseline;gap:5px;border:1px solid var(--line);background:var(--card);
border-radius:999px;padding:4px 10px;font-size:12.5px;color:var(--ink);cursor:pointer;font-family:inherit;transition:background .15s;}
.ta-pick button span{color:var(--muted);font-size:11.5px;}
.ta-pick button:hover{background:#F3EFE7;}
.ta-pick button.on{background:var(--sage-soft);border-color:var(--sage);color:var(--sage-d);}
.ta-pick button.on span{color:var(--sage-d);}
.ta-hint{font-size:12px;line-height:1.5;color:var(--muted);margin-top:-6px;}
.ta-hint b{font-weight:600;color:var(--sage-d);}
.ta-hint.ta-new b{color:var(--gold-d);}
.ta-amount{display:flex;align-items:center;gap:8px;background:var(--sage-soft);border:1px solid transparent;
border-radius:14px;padding:8px 12px;transition:border-color .15s,box-shadow .15s,background .15s;}
.ta-amount.ta-manual{background:#F7F0E1;}
.ta-amount:focus-within{border-color:var(--sage);box-shadow:0 0 0 3px var(--sage-soft);}
.ta-amount-cur{font-size:14px;color:var(--muted);font-weight:500;}
.ta-amount input{flex:1;min-width:0;border:none;background:transparent;font-size:22px;font-weight:700;
color:var(--ink);outline:none;font-family:inherit;padding:2px 0;font-variant-numeric:tabular-nums;}
.ta-amount input::placeholder{color:#C2BBAD;font-size:14px;font-weight:500;}
.ta-amount-tag{font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:999px;background:#fff;color:var(--sage-d);white-space:nowrap;}
.ta-manual .ta-amount-tag{color:var(--gold-d);}
.ta-formula{font-size:12.5px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;
font-variant-numeric:tabular-nums;margin-top:-6px;}
.ta-link{border:none;background:none;padding:0;color:var(--sage-d);font-size:12.5px;cursor:pointer;
text-decoration:underline;font-family:inherit;}
`;

function Field({label, required, children}) {
    return (
        <label className="ta-field">
            <span className="ta-label">{label}{required && <span style={{color: "var(--clay)"}}> *</span>}</span>
            {children}
        </label>
    );
}

// 「新增 / 編輯茶廠收入」彈窗的欄位：選對象自動帶入上次單價，斤數 × 單價自動算金額，金額仍可手動改。
function FactoryIncomeFields({editing, setEditing, records}) {
    const d = editing.data;
    const price = d.price ?? "";
    const last = lastPriceOf(records, d.who, d.id);
    const payers = useMemo(() => recentPayers(records, d.id), [records, d.id]);

    // 套用變更；金額沒有手動改過的話就重新計算。
    // 手動金額剛好等於「斤數 × 單價」時，視為回到自動計算。
    const apply = (e, data, flags = {}) => {
        const next = {...e, ...flags, data};
        const c = calcAmount(data);
        if (next.amountManual && c !== "" && Number(c) === Number(data.amount)) next.amountManual = false;
        if (!next.amountManual) next.data = {...data, amount: c};
        return next;
    };
    const setWho = (who, fromPick = false) => setEditing((e) => {
        const found = lastPriceOf(records, who, e.data.id);
        let p = e.data.price ?? "", priceAuto = e.priceAuto;
        if (found && (fromPick || priceAuto || p === "")) {
            p = String(found.price);
            priceAuto = true;
        } else if (!found && priceAuto) {
            p = "";
            priceAuto = false;
        }
        return apply(e, {...e.data, who, price: p}, {priceAuto});
    });
    const setJin = (v) => setEditing((e) => apply(e, {...e.data, jin: v}));
    const setPrice = (v) => setEditing((e) => apply(e, {...e.data, price: v}, {priceAuto: false}));
    // 金額清空就回到自動計算
    const setAmount = (v) => setEditing((e) => (v === ""
        ? apply(e, e.data, {amountManual: false})
        : apply(e, {...e.data, amount: v}, {amountManual: true})));
    const backToAuto = () => setEditing((e) => apply(e, e.data, {amountManual: false}));

    const j = Number(d.jin), p = Number(price), amt = Number(d.amount);
    const calc = calcAmount({jin: d.jin, price});
    const manual = !!editing.amountManual;
    const name = (d.who || "").trim();

    let hint = null;
    if (editing.priceAuto && last) {
        hint = <div className="ta-hint"><b>已帶入 {name} 上次的單價</b>（{md(last.date)}，{money(last.price)}/斤）。這次價錢不同可以直接改。</div>;
    } else if (!d.id && last && p > 0 && p !== Number(last.price)) {
        hint = <div className="ta-hint">和上次的單價（{money(last.price)}）不同，儲存後下次會帶入 {money(p)}。</div>;
    } else if (name && !last) {
        hint = <div className="ta-hint ta-new"><b>{name} 還沒有記過單價</b>：輸入後儲存，下次就會自動帶入。</div>;
    }

    let formula;
    if (calc && !(manual && amt !== Number(calc))) {
        formula = <span>{nf.format(j)} 斤 × {money(p)} = {money(calc)}</span>;
    } else if (manual && calc) {
        formula = <>
            <span>自動計算為 {money(calc)}，已手動改為 {money(amt)}</span>
            <button type="button" className="ta-link" onClick={backToAuto}>改回自動計算</button>
        </>;
    } else if (manual) {
        formula = <>
            <span>手動輸入的金額</span>
            <button type="button" className="ta-link" onClick={backToAuto}>改回自動計算</button>
        </>;
    } else {
        formula = <span>{j > 0 ? "輸入每斤單價就會算出金額" : p > 0 ? "輸入斤數就會算出金額" : "金額 = 斤數 × 每斤單價"}</span>;
    }

    return (<>
        <Field label="日期" required><input type="date" className="ta-input" value={d.date}
                                            onChange={(e) => setEditing((x) => ({...x, data: {...x.data, date: e.target.value}}))}/></Field>
        <Field label="誰" required><input className="ta-input" value={d.who} onChange={(e) => setWho(e.target.value)}
                                          placeholder="對象 / 來源" autoFocus/></Field>
        {payers.length > 0 && (
            <div className="ta-pick">
                <span className="ta-pick-cap">最近：</span>
                {payers.map((x) => (
                    <button type="button" key={x.name} className={x.name === name ? "on" : ""}
                            onClick={() => setWho(x.name, true)}>
                        {x.name}<span>{nf.format(x.price)}/斤</span>
                    </button>
                ))}
            </div>
        )}
        <div style={{display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 12}}>
            <Field label="幾斤" required>
                <div className="ta-affix">
                    <input type="number" min="0" step="0.1" inputMode="decimal" className="ta-input" value={d.jin}
                           onChange={(e) => setJin(e.target.value)} placeholder="0"/>
                    <span className="ta-affix-txt" style={{right: 12}}>斤</span>
                </div>
            </Field>
            <Field label="每斤單價">
                <div className="ta-affix ta-has-pre">
                    <span className="ta-affix-txt" style={{left: 12}}>NT$</span>
                    <input type="number" min="0" step="1" inputMode="numeric" className="ta-input" value={price}
                           onChange={(e) => setPrice(e.target.value)} placeholder="0"/>
                    <span className="ta-affix-txt" style={{right: 12}}>/斤</span>
                </div>
            </Field>
        </div>
        {hint}
        <Field label="金額" required>
            <div className={`ta-amount ${manual ? "ta-manual" : ""}`}>
                <span className="ta-amount-cur">NT$</span>
                <input type="number" min="0" step="1" inputMode="numeric" value={d.amount}
                       onChange={(e) => setAmount(e.target.value)} placeholder="輸入斤數與單價後自動計算"/>
                <span className="ta-amount-tag">{manual ? "手動調整" : "自動計算"}</span>
            </div>
        </Field>
        <div className="ta-formula">{formula}</div>
    </>);
}

function Empty({icon: Icon, text}) {
    return (
        <div style={{textAlign: "center", padding: "56px 20px", color: "var(--muted)"}}>
            <Icon size={34} strokeWidth={1.5} style={{opacity: .5, marginBottom: 12}}/>
            <div style={{fontSize: 14}}>{text}</div>
        </div>
    );
}

function Loading({text}) {
    return (
        <div className="ta-root" style={{
            background: "var(--bg)",
            minHeight: 480,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)"
        }}>
            <style>{CSS}</style>
            <div style={{textAlign: "center"}}>
                <Leaf size={28} strokeWidth={1.5} style={{color: "var(--sage)", marginBottom: 10}}/>
                <div style={{fontSize: 14}}>{text}</div>
            </div>
        </div>
    );
}

export default function App() {
    const nowY = yrOf(today());
    const nowM = String(mOf(today()));

    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [authPass, setAuthPass] = useState("");
    const [authMode, setAuthMode] = useState("login");
    const [authErr, setAuthErr] = useState("");
    const [authBusy, setAuthBusy] = useState(false);

    const [tab, setTab] = useState("sales");
    const [customers, setCustomers] = useState([]);
    const [items, setItems] = useState([]);
    const [sales, setSales] = useState([]);
    const [expD, setExpD] = useState([]);
    const [expP, setExpP] = useState([]);
    const [expG, setExpG] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editing, setEditing] = useState(null);
    const [del, setDel] = useState(null);
    const [custModal, setCustModal] = useState(null);
    const [custFilter, setCustFilter] = useState({y: nowY, m: nowM});
    const [cSearch, setCSearch] = useState("");
    const [pickCust, setPickCust] = useState(false);
    const [pickQ, setPickQ] = useState("");

    const [sFilter, setSFilter] = useState({y: nowY, m: "all"});
    const [eFilter, setEFilter] = useState({y: nowY, m: "all"});
    const [expMode, setExpMode] = useState("factoryOut");
    const [repYear, setRepYear] = useState(nowY);

    const [exportOpen, setExportOpen] = useState(false);
    const [exportPeriod, setExportPeriod] = useState({y: nowY, m: "all"});
    const [exportTypes, setExportTypes] = useState({sales: true, exp: true, report: true});

    const ledgerRef = () => doc(db, "ledgers", user.uid);

    useEffect(() => onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
    }), []);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const ref = doc(db, "ledgers", user.uid);
        const unsub = onSnapshot(ref, (snap) => {
            const d = snap.exists() ? snap.data() : {};
            setCustomers(d.customers || []);
            setItems(d.items || []);
            setSales(d.sales || []);
            setExpD(d.expD || []);
            setExpP(d.expP || []);
            setExpG(d.expG || []);
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return unsub;
    }, [user]);

    async function saveField(field, value) {
        if (!user) return;
        try {
            await setDoc(ledgerRef(), {[field]: value}, {merge: true});
        } catch (e) {
            console.error("儲存失敗", e);
        }
    }

    async function doAuth() {
        setAuthErr("");
        setAuthBusy(true);
        try {
            const fn = authMode === "signup" ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
            await fn(auth, OWNER_EMAIL, "tea" + authPass);
        } catch (e) {
            setAuthErr(authMsg(e.code || ""));
        }
        setAuthBusy(false);
    }

    const colls = {customer: customers, item: items, sale: sales, expD, expP, expG};
    const setters = {
        customer: setCustomers,
        item: setItems,
        sale: setSales,
        expD: setExpD,
        expP: setExpP,
        expG: setExpG
    };

    function openNew(type) {
        const base = {
            customer: {name: "", phone: "", address: "", note: ""},
            item: {name: "", qty: ""},
            sale: {
                date: today(),
                customerId: null,
                customerName: "",
                itemId: "",
                itemName: "",
                qty: "",
                amount: "",
                paid: false,
                note: ""
            },
            expD: {date: today(), item: "", amount: ""},
            expP: {date: today(), who: "", jin: "", price: "", amount: ""},
            expG: {date: today(), item: "", amount: ""},
        }[type];
        setEditing({type, data: {...base}});
    }

    function openEdit(type, item) {
        if (type === "expP") {
            // 金額和「斤數 × 單價」對得上才視為自動計算；舊紀錄沒有單價，金額就當作手動輸入的，不會被改掉
            const calc = calcAmount(item);
            setEditing({type, data: {...item}, priceAuto: false, amountManual: !calc || Number(calc) !== Number(item.amount)});
            return;
        }
        setEditing({type, data: {...item}});
    }

    function setField(k, v) {
        setEditing((e) => ({...e, data: {...e.data, [k]: v}}));
    }

    const valid = useMemo(() => {
        if (!editing) return false;
        const d = editing.data;
        switch (editing.type) {
            case "customer":
                return d.name.trim().length > 0;
            case "item":
                return d.name.trim().length > 0 && d.qty !== "" && Number(d.qty) >= 0;
            case "sale":
                return d.date && d.itemId && Number(d.qty) > 0 && Number(d.amount) > 0;
            case "expD":
            case "expG":
                return d.date && d.item.trim() && Number(d.amount) > 0;
            case "expP":
                return d.date && d.who.trim() && Number(d.jin) > 0 && Number(d.amount) > 0;
            default:
                return false;
        }
    }, [editing]);

    function commit() {
        if (!valid) return;
        const {type, data} = editing;
        const list = colls[type];
        const next = data.id ? list.map((x) => (x.id === data.id ? data : x)) : [...list, {...data, id: uid()}];
        setters[type](next);
        saveField(KEY[type], next);
        setEditing(null);
    }

    function doDelete() {
        const {type, id} = del;
        const next = colls[type].filter((x) => x.id !== id);
        setters[type](next);
        saveField(KEY[type], next);
        setDel(null);
    }

    function togglePaid(s) {
        const next = sales.map((x) => (x.id === s.id ? {...x, paid: !x.paid} : x));
        setSales(next);
        saveField("sales", next);
    }

    const soldByItem = useMemo(() => {
        const m = {};
        sales.forEach((s) => {
            if (s.itemId) m[s.itemId] = (m[s.itemId] || 0) + Number(s.qty || 0);
        });
        return m;
    }, [sales]);
    const remainOf = (it) => Number(it.qty || 0) - (soldByItem[it.id] || 0);
    const totalRemain = items.reduce((a, it) => a + remainOf(it), 0);

    const years = useMemo(() => {
        const set = new Set([...sales, ...expD, ...expP, ...expG].map((r) => yrOf(r.date)).filter(Boolean));
        set.add(nowY);
        return [...set].sort((a, b) => b - a);
    }, [sales, expD, expP, expG]);

    const filteredCustomers = useMemo(() => {
        const q = cSearch.trim().toLowerCase();
        const arr = q ? customers.filter((c) => (c.name + c.phone + c.address).toLowerCase().includes(q)) : customers;
        return [...arr].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    }, [customers, cSearch]);

    const pickList = useMemo(() => {
        const q = pickQ.trim().toLowerCase();
        const arr = q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers;
        return [...arr].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    }, [customers, pickQ]);

    function custStats(cid, f) {
        let list = sales.filter((s) => s.customerId === cid);
        if (f) list = list.filter((s) => yrOf(s.date) === f.y && (f.m === "all" || mOf(s.date) === Number(f.m)));
        list = list.sort((a, b) => b.date.localeCompare(a.date));
        return {
            list, count: list.length,
            jin: list.reduce((a, s) => a + Number(s.qty || 0), 0),
            amt: list.reduce((a, s) => a + Number(s.amount || 0), 0),
            unpaid: list.filter((s) => !s.paid).reduce((a, s) => a + Number(s.amount || 0), 0),
        };
    }

    const inFilter = (d, f) => yrOf(d.date) === f.y && (f.m === "all" || mOf(d.date) === Number(f.m));
    const filteredSales = useMemo(() => sales.filter((s) => inFilter(s, sFilter)).sort((a, b) => b.date.localeCompare(a.date)), [sales, sFilter]);
    const salesSum = filteredSales.reduce((a, s) => a + Number(s.amount || 0), 0);
    const salesJin = filteredSales.reduce((a, s) => a + Number(s.qty || 0), 0);
    const unpaidSum = filteredSales.filter((s) => !s.paid).reduce((a, s) => a + Number(s.amount || 0), 0);

    const cur = EXP_MODES[expMode];
    const expListCur = colls[cur.type];
    const isIncome = expMode === "factoryIn";
    const filteredExp = useMemo(() => expListCur.filter((e) => inFilter(e, eFilter)).sort((a, b) => b.date.localeCompare(a.date)), [expListCur, eFilter]);
    const expSum = filteredExp.reduce((a, e) => a + Number(e.amount || 0), 0);

    const report = useMemo(() => {
        const months = Array.from({length: 12}, (_, i) => {
            const m = i + 1;
            const inM = (d) => yrOf(d.date) === repYear && mOf(d.date) === m;
            const 銷售 = sales.filter(inM).reduce((a, s) => a + Number(s.amount || 0), 0);
            const 茶園支出 = expG.filter(inM).reduce((a, e) => a + Number(e.amount || 0), 0);
            const 茶廠收入 = expP.filter(inM).reduce((a, e) => a + Number(e.amount || 0), 0);
            const 茶廠支出 = expD.filter(inM).reduce((a, e) => a + Number(e.amount || 0), 0);
            return {
                name: `${m}月`,
                銷售,
                茶園支出,
                茶廠收入,
                茶廠支出,
                營收: 銷售 + 茶廠收入,
                開支: 茶園支出 + 茶廠支出,
                淨利: 銷售 + 茶廠收入 - 茶園支出 - 茶廠支出
            };
        });
        const sum = (k) => months.reduce((a, x) => a + x[k], 0);
        return {
            months,
            園營收: sum("銷售"),
            園開支: sum("茶園支出"),
            廠營收: sum("茶廠收入"),
            廠開支: sum("茶廠支出")
        };
    }, [sales, expD, expP, expG, repYear]);
    const repRows = report.months.filter((m) => m.銷售 || m.茶園支出 || m.茶廠收入 || m.茶廠支出);

    function download(name, rows) {
        const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
        const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    }

    function runExport() {
        const {y, m} = exportPeriod;
        const inP = (d) => yrOf(d.date) === y && (m === "all" || mOf(d.date) === Number(m));
        const label = m === "all" ? "全年" : `${m}月`;
        const rows = [];
        const sep = () => {
            if (rows.length) rows.push([]);
        };
        if (exportTypes.sales) {
            sep();
            rows.push([`銷售明細（${y} ${label}）`]);
            rows.push(["日期", "客戶", "品項", "斤數", "金額", "已匯款", "備註"]);
            const list = sales.filter(inP).sort((a, b) => a.date.localeCompare(b.date));
            list.forEach((s) => rows.push([s.date, s.customerName || "未指定", s.itemName, s.qty, s.amount, s.paid ? "是" : "否", s.note || ""]));
            rows.push(["合計", "", "", "", list.reduce((a, s) => a + Number(s.amount || 0), 0), "", ""]);
        }
        if (exportTypes.exp) {
            sep();
            rows.push([`開支明細（${y} ${label}）`]);
            rows.push(["類型", "日期", "對象/事項", "斤數", "每斤單價", "金額"]);
            expD.filter(inP).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push(["茶廠支出", e.date, e.item, "", "", e.amount]));
            expP.filter(inP).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push(["茶廠收入", e.date, e.who, e.jin, Number(e.price) > 0 ? e.price : "", e.amount]));
            expG.filter(inP).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push(["茶園支出", e.date, e.item, "", "", e.amount]));
        }
        if (exportTypes.report) {
            sep();
            const sumIn = (arr) => arr.filter(inP).reduce((a, e) => a + Number(e.amount || 0), 0);
            const 園營收 = sumIn(sales), 園開支 = sumIn(expG), 廠營收 = sumIn(expP), 廠開支 = sumIn(expD);
            rows.push([`報表（${y} ${label}）`]);
            rows.push(["區塊", "營收", "開支", "淨利"]);
            rows.push(["茶園", 園營收, 園開支, 園營收 - 園開支]);
            rows.push(["茶廠", 廠營收, 廠開支, 廠營收 - 廠開支]);
            rows.push([]);
            rows.push(["各月明細"]);
            rows.push(["月份", "茶園營收", "茶園支出", "茶廠收入", "茶廠支出", "淨利"]);
            const mlist = m === "all" ? Array.from({length: 12}, (_, i) => i + 1) : [Number(m)];
            mlist.forEach((mm) => {
                const inM = (d) => yrOf(d.date) === y && mOf(d.date) === mm;
                const sale = sales.filter(inM).reduce((a, s) => a + Number(s.amount || 0), 0);
                const g = expG.filter(inM).reduce((a, e) => a + Number(e.amount || 0), 0);
                const p = expP.filter(inM).reduce((a, e) => a + Number(e.amount || 0), 0);
                const dd = expD.filter(inM).reduce((a, e) => a + Number(e.amount || 0), 0);
                if (sale || g || p || dd) rows.push([`${mm}月`, sale, g, p, dd, sale + p - g - dd]);
            });
        }
        if (rows.length === 0) return;
        download(`茶葉匯出_${y}_${label}.csv`, rows);
        setExportOpen(false);
    }

    const pickRowStyle = {
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
        textAlign: "left", border: "1px solid var(--line)", background: "transparent", borderRadius: 10,
        padding: "10px 12px", cursor: "pointer", fontSize: 14, fontFamily: "inherit", color: "var(--ink)",
    };
    const linkStyle = {
        background: "none",
        border: "none",
        color: "#C2BBAD",
        cursor: "pointer",
        fontSize: 12,
        textDecoration: "underline",
        fontFamily: "inherit",
        padding: 0
    };
    const stockColor = (r) => (r <= 0 ? "var(--clay-d)" : r <= 2 ? "var(--gold-d)" : "var(--sage-d)");

    if (!authReady) return <Loading text="連線中…"/>;

    if (!user) return (
        <div className="ta-root" style={{
            background: "var(--bg)",
            minHeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
        }}>
            <style>{CSS}</style>
            <div className="ta-card" style={{width: "100%", maxWidth: 360, padding: 26}}>
                <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 18}}>
                    <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 13,
                        background: "var(--sage-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        <Leaf size={22} strokeWidth={1.8} style={{color: "var(--sage-d)"}}/>
                    </div>
                    <div>
                        <div style={{fontSize: 18, fontWeight: 600}}>茶葉記帳</div>
                        <div style={{
                            fontSize: 12.5,
                            color: "var(--muted)"
                        }}>{authMode === "signup" ? "設定密碼" : "輸入密碼以同步資料"}</div>
                    </div>
                </div>
                <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                    <Field label="4 碼密碼"><input className="ta-input" type="password" inputMode="numeric"
                                                   maxLength={4} value={authPass}
                                                   onChange={(e) => setAuthPass(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                                   placeholder="輸入 4 碼數字" autoFocus onKeyDown={(e) => {
                        if (e.key === "Enter") doAuth();
                    }}/></Field>
                    {authErr && <div style={{fontSize: 12.5, color: "var(--clay-d)"}}>{authErr}</div>}
                    <button className="ta-btn ta-primary" disabled={authBusy || authPass.length !== 4}
                            onClick={doAuth}>
                        {authBusy ? "處理中…" : authMode === "signup" ? "設定密碼並進入" : "登入"}
                    </button>
                    <button onClick={() => {
                        setAuthMode(authMode === "signup" ? "login" : "signup");
                        setAuthErr("");
                    }}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--muted)",
                                cursor: "pointer",
                                fontSize: 13,
                                fontFamily: "inherit",
                                textDecoration: "underline"
                            }}>
                        {authMode === "signup" ? "已設定密碼？前往登入" : "第一次使用？設定密碼"}
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) return <Loading text="載入資料中…"/>;

    const TABS = [
        {k: "customers", t: "客戶", icon: Users},
        {k: "items", t: "品項", icon: Package},
        {k: "sales", t: "銷售", icon: ShoppingBag},
        {k: "expenses", t: "開支", icon: Wallet},
        {k: "reports", t: "報表", icon: BarChart3},
    ];
    const MSEL = (val, onChange) => (
        <select className="ta-input ta-select" style={{width: "auto", padding: "9px 34px 9px 12px"}} value={val.m}
                onChange={(e) => onChange({...val, m: e.target.value})}>
            <option value="all">全部</option>
            {Array.from({length: 12}, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
    );
    const YSEL = (val, onChange) => (
        <select className="ta-input ta-select" style={{width: "auto", padding: "9px 34px 9px 12px"}}
                value={val.y || val} onChange={(e) => onChange(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
        </select>
    );
    const cs = custModal ? custStats(custModal.id, custFilter) : null;
    const sides = [
        {title: "茶園", color: "var(--sage)", rev: report.園營收, exp: report.園開支},
        {title: "茶廠", color: "var(--gold)", rev: report.廠營收, exp: report.廠開支},
    ];

    return (
        <div className="ta-root" style={{background: "var(--bg)", minHeight: 600, padding: "28px 18px"}}>
            <style>{CSS}</style>
            <div style={{maxWidth: 880, margin: "0 auto"}}>

                <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 22}}>
                    <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 13,
                        background: "var(--sage-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        <Leaf size={22} strokeWidth={1.8} style={{color: "var(--sage-d)"}}/>
                    </div>
                    <div>
                        <div style={{fontSize: 19, fontWeight: 600}}>茶葉記帳</div>
                        <div style={{fontSize: 12.5, color: "var(--muted)"}}>客戶 · 品項 · 銷售 · 開支 · 報表</div>
                    </div>
                    <div style={{flex: 1}}/>
                    <button className="ta-btn ta-ghost" onClick={() => setExportOpen(true)}><Download size={15}/> 匯出
                    </button>
                </div>

                <div style={{display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap"}}>
                    {TABS.map((x) => (
                        <button key={x.k} className={`ta-tab ${tab === x.k ? "ta-tab-on" : ""}`}
                                onClick={() => setTab(x.k)}>
                            <x.icon size={16} strokeWidth={2}/>
                            {x.t}
                        </button>
                    ))}
                </div>

                {tab === "customers" && (
                    <div className="ta-card" style={{padding: 20}}>
                        <div style={{
                            display: "flex",
                            gap: 10,
                            marginBottom: 16,
                            flexWrap: "wrap",
                            alignItems: "center"
                        }}>
                            <div style={{position: "relative", flex: 1, minWidth: 200}}>
                                <Search size={16}
                                        style={{position: "absolute", left: 12, top: 12, color: "var(--muted)"}}/>
                                <input className="ta-input" style={{paddingLeft: 36}}
                                       placeholder="搜尋姓名、電話或地址…" value={cSearch}
                                       onChange={(e) => setCSearch(e.target.value)}/>
                            </div>
                            <button className="ta-btn ta-primary" onClick={() => openNew("customer")}><Plus
                                size={16}/> 新增客戶
                            </button>
                        </div>
                        {filteredCustomers.length === 0 ? (
                            <Empty icon={Users}
                                   text={customers.length ? "找不到符合的客戶" : "還沒有客戶，點「新增客戶」開始吧"}/>
                        ) : (
                            <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                {filteredCustomers.map((c) => (
                                    <div key={c.id} className="ta-row" onClick={() => {
                                        setCustFilter({y: nowY, m: nowM});
                                        setCustModal(c);
                                    }}
                                         style={{
                                             display: "flex",
                                             alignItems: "center",
                                             gap: 12,
                                             padding: "12px 12px",
                                             borderRadius: 12,
                                             border: "1px solid var(--line)",
                                             cursor: "pointer"
                                         }}>
                                        <div style={{flex: 1, minWidth: 0}}>
                                            <div style={{
                                                fontSize: 15,
                                                fontWeight: 600,
                                                marginBottom: 4
                                            }}>{c.name}</div>
                                            <div style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 3,
                                                fontSize: 13,
                                                color: "var(--muted)"
                                            }}>
                                                {c.phone && <span
                                                    style={{display: "flex", alignItems: "center", gap: 6}}><Phone
                                                    size={13}/>{c.phone}</span>}
                                                {c.address && <span style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 6
                                                }}><MapPin size={13} style={{
                                                    marginTop: 2,
                                                    flexShrink: 0
                                                }}/>{c.address}</span>}
                                                {c.note && <span style={{color: "#B5AE9F"}}>備註：{c.note}</span>}
                                            </div>
                                        </div>
                                        <div onClick={(e) => e.stopPropagation()}
                                             style={{display: "flex", gap: 2, alignItems: "center"}}>
                                            <button className="ta-icon-btn" onClick={() => openEdit("customer", c)}>
                                                <Pencil size={15}/></button>
                                            <button className="ta-icon-btn" onClick={() => setDel({
                                                type: "customer",
                                                id: c.id,
                                                name: c.name
                                            })}><Trash2 size={15}/></button>
                                            <ChevronRight size={16} style={{color: "#C8C0B0"}}/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{
                            marginTop: 14,
                            fontSize: 12.5,
                            color: "var(--muted)",
                            textAlign: "center"
                        }}>點客戶可查看其購買統計
                        </div>
                    </div>
                )}

                {tab === "items" && (
                    <div className="ta-card" style={{padding: 20}}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                            gap: 10,
                            flexWrap: "wrap"
                        }}>
                            <div
                                style={{fontSize: 14, color: "var(--muted)"}}>「庫存」為你設定的進貨斤數，「剩餘」自動扣除已售出
                            </div>
                            <button className="ta-btn ta-primary" onClick={() => openNew("item")}><Plus
                                size={16}/> 新增品項
                            </button>
                        </div>
                        {items.length === 0 ? (
                            <Empty icon={Package} text="還沒有品項，先新增你的茶葉品項吧"/>
                        ) : (
                            <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                {items.map((it) => {
                                    const r = remainOf(it), sold = soldByItem[it.id] || 0;
                                    return (
                                        <div key={it.id} className="ta-row" style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: "13px 14px",
                                            borderRadius: 12,
                                            border: "1px solid var(--line)"
                                        }}>
                                            <div style={{flex: 1, minWidth: 0}}>
                                                <div style={{
                                                    fontSize: 15.5,
                                                    fontWeight: 600,
                                                    marginBottom: 4
                                                }}>{it.name}</div>
                                                <div style={{
                                                    fontSize: 12.5,
                                                    color: "var(--muted)"
                                                }}>庫存 {jin(it.qty)} · 已售 {jin(sold)}</div>
                                            </div>
                                            <div style={{textAlign: "right"}}>
                                                <div style={{fontSize: 11.5, color: "var(--muted)"}}>剩餘</div>
                                                <div style={{
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    color: stockColor(r)
                                                }}>{jin(r)}</div>
                                            </div>
                                            <div style={{display: "flex", gap: 2}}>
                                                <button className="ta-icon-btn"
                                                        onClick={() => openEdit("item", it)}><Pencil size={15}/>
                                                </button>
                                                <button className="ta-icon-btn" onClick={() => setDel({
                                                    type: "item",
                                                    id: it.id,
                                                    name: it.name
                                                })}><Trash2 size={15}/></button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    alignItems: "center",
                                    gap: 8,
                                    marginTop: 6,
                                    padding: "12px 14px",
                                    background: "var(--sage-soft)",
                                    borderRadius: 12,
                                    fontSize: 14,
                                    color: "var(--sage-d)"
                                }}>
                                    <Package size={16}/> 目前剩餘總庫存 <b>{jin(totalRemain)}</b>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === "sales" && (
                    <div style={{display: "flex", flexDirection: "column", gap: 14}}>
                        <div className="ta-card" style={{padding: 16}}>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 12
                            }}>
                                <div style={{
                                    fontSize: 13.5,
                                    fontWeight: 600,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7
                                }}>
                                    <Package size={16} style={{color: "var(--sage-d)"}}/> 目前庫存（剩餘斤數）
                                </div>
                                <div style={{
                                    fontSize: 13.5,
                                    color: "var(--sage-d)",
                                    fontWeight: 600
                                }}>共 {jin(totalRemain)}</div>
                            </div>
                            {items.length === 0 ? (
                                <div style={{
                                    fontSize: 13,
                                    color: "var(--muted)"
                                }}>尚未設定品項，請到「品項」分頁新增。</div>
                            ) : (
                                <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
                                    {items.map((it) => {
                                        const r = remainOf(it);
                                        return (<span key={it.id} className="ta-stock">{it.name} <b
                                            style={{color: stockColor(r)}}>{jin(r)}</b></span>);
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="ta-card" style={{padding: 20}}>
                            <div style={{
                                display: "flex",
                                gap: 10,
                                marginBottom: 16,
                                flexWrap: "wrap",
                                alignItems: "center"
                            }}>
                                {YSEL(sFilter, (y) => setSFilter({...sFilter, y}))}
                                {MSEL(sFilter, setSFilter)}
                                <div style={{flex: 1}}/>
                                <button className="ta-btn ta-primary" onClick={() => openNew("sale")}><Plus
                                    size={16}/> 新增銷售
                                </button>
                            </div>
                            <div style={{display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap"}}>
                                <div style={{
                                    flex: 1,
                                    minWidth: 150,
                                    padding: "11px 14px",
                                    background: "var(--sage-soft)",
                                    borderRadius: 12,
                                    fontSize: 13,
                                    color: "var(--sage-d)"
                                }}>
                                    此區間 {filteredSales.length} 筆 · {jin(salesJin)}<br/><b
                                    style={{fontSize: 15}}>{money(salesSum)}</b>
                                </div>
                                <div style={{
                                    flex: 1,
                                    minWidth: 150,
                                    padding: "11px 14px",
                                    background: unpaidSum > 0 ? "var(--clay-soft)" : "var(--field)",
                                    borderRadius: 12,
                                    fontSize: 13,
                                    color: unpaidSum > 0 ? "var(--clay-d)" : "var(--muted)"
                                }}>
                                    未收款<br/><b style={{fontSize: 15}}>{money(unpaidSum)}</b>
                                </div>
                            </div>
                            {filteredSales.length === 0 ? (
                                <Empty icon={ShoppingBag} text="此區間還沒有銷售紀錄"/>
                            ) : (
                                <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                    {filteredSales.map((s) => (
                                        <div key={s.id} className="ta-row" onClick={() => openEdit("sale", s)}
                                             style={{
                                                 display: "flex",
                                                 alignItems: "center",
                                                 gap: 12,
                                                 padding: "11px 12px",
                                                 borderRadius: 12,
                                                 border: "1px solid var(--line)",
                                                 cursor: "pointer"
                                             }}>
                                            <div style={{width: 70, flexShrink: 0}}>
                                                <div style={{fontSize: 13, fontWeight: 600}}>{s.date.slice(5)}</div>
                                                <span className="ta-chip" style={{
                                                    background: "var(--field)",
                                                    color: "var(--muted)",
                                                    marginTop: 3
                                                }}>{mOf(s.date)}月</span>
                                            </div>
                                            <div style={{flex: 1, minWidth: 0}}>
                                                <div style={{
                                                    fontSize: 14.5,
                                                    fontWeight: 600
                                                }}>{s.customerName || "未指定客戶"}</div>
                                                <div style={{
                                                    fontSize: 12.5,
                                                    color: "var(--muted)"
                                                }}>{s.itemName} · {jin(s.qty)}{s.note ? ` · ${s.note}` : ""}</div>
                                            </div>
                                            <div style={{textAlign: "right", flexShrink: 0}}>
                                                <div style={{
                                                    fontSize: 14.5,
                                                    fontWeight: 600,
                                                    color: "var(--sage-d)",
                                                    marginBottom: 4
                                                }}>{money(s.amount)}</div>
                                                <button className="ta-paid" onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePaid(s);
                                                }}
                                                        style={{
                                                            background: s.paid ? "var(--sage-soft)" : "var(--clay-soft)",
                                                            color: s.paid ? "var(--sage-d)" : "var(--clay-d)"
                                                        }}>
                                                    {s.paid ? <CheckCircle2 size={12}/> :
                                                        <Circle size={12}/>} {s.paid ? "已匯款" : "未匯款"}
                                                </button>
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()}
                                                 style={{display: "flex", gap: 2}}>
                                                <button className="ta-icon-btn" onClick={() => openEdit("sale", s)}>
                                                    <Pencil size={15}/></button>
                                                <button className="ta-icon-btn" onClick={() => setDel({
                                                    type: "sale",
                                                    id: s.id,
                                                    name: `${s.itemName} ${jin(s.qty)}`
                                                })}><Trash2 size={15}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === "expenses" && (
                    <div className="ta-card" style={{padding: 20}}>
                        <div style={{
                            display: "flex",
                            gap: 10,
                            marginBottom: 16,
                            flexWrap: "wrap",
                            alignItems: "center"
                        }}>
                            <div className="ta-seg">
                                {Object.entries(EXP_MODES).map(([k, v]) => (
                                    <button key={k} className={expMode === k ? "on" : ""}
                                            onClick={() => setExpMode(k)}>{v.label}</button>
                                ))}
                            </div>
                            <div style={{flex: 1}}/>
                            {YSEL(eFilter, (y) => setEFilter({...eFilter, y}))}
                            {MSEL(eFilter, setEFilter)}
                            <button className="ta-btn ta-primary" onClick={() => openNew(cur.type)}><Plus
                                size={16}/> 新增
                            </button>
                        </div>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 14,
                            padding: "12px 14px",
                            borderRadius: 12,
                            fontSize: 13.5,
                            background: isIncome ? "var(--sage-soft)" : "var(--clay-soft)",
                            color: isIncome ? "var(--sage-d)" : "var(--clay-d)"
                        }}>
                            {isIncome ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                            此區間共 {filteredExp.length} 筆，{cur.label}合計 <b
                            style={{marginLeft: 2}}>{money(expSum)}</b>
                        </div>
                        {filteredExp.length === 0 ? (
                            <Empty icon={Wallet} text={`此區間還沒有${cur.label}紀錄`}/>
                        ) : (
                            <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                {filteredExp.map((e) => (
                                    <div key={e.id} className="ta-row" style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "11px 12px",
                                        borderRadius: 12,
                                        border: "1px solid var(--line)"
                                    }}>
                                        <div style={{width: 70, flexShrink: 0}}>
                                            <div style={{fontSize: 13, fontWeight: 600}}>{e.date.slice(5)}</div>
                                            <span className="ta-chip" style={{
                                                background: "var(--field)",
                                                color: "var(--muted)",
                                                marginTop: 3
                                            }}>{mOf(e.date)}月</span>
                                        </div>
                                        <div style={{flex: 1, minWidth: 0}}>
                                            {cur.kind === "io" ? (
                                                <div style={{fontSize: 14.5, fontWeight: 500}}>{e.item}</div>
                                            ) : (<>
                                                <div style={{fontSize: 14.5, fontWeight: 500}}>{e.who}</div>
                                                <div style={{
                                                    fontSize: 12.5,
                                                    color: "var(--muted)"
                                                }}>{jin(e.jin)}{Number(e.price) > 0 ? ` × ${money(e.price)}` : ""}</div>
                                            </>)}
                                        </div>
                                        <div style={{
                                            fontSize: 14.5,
                                            fontWeight: 600,
                                            color: isIncome ? "var(--sage-d)" : "var(--clay-d)"
                                        }}>{money(e.amount)}</div>
                                        <div style={{display: "flex", gap: 2}}>
                                            <button className="ta-icon-btn" onClick={() => openEdit(cur.type, e)}>
                                                <Pencil size={15}/></button>
                                            <button className="ta-icon-btn" onClick={() => setDel({
                                                type: cur.type,
                                                id: e.id,
                                                name: cur.kind === "io" ? e.item : e.who
                                            })}><Trash2 size={15}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === "reports" && (
                    <div style={{display: "flex", flexDirection: "column", gap: 16}}>
                        <div className="ta-card" style={{padding: 20}}>
                            <div style={{
                                display: "flex",
                                gap: 10,
                                marginBottom: 18,
                                flexWrap: "wrap",
                                alignItems: "center"
                            }}>
                                <Calendar size={16} style={{color: "var(--muted)"}}/>
                                {YSEL(repYear, setRepYear)}
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 18}}>
                                {sides.map((sd) => {
                                    const net = sd.rev - sd.exp;
                                    const cards = [
                                        {
                                            label: "全年營收",
                                            val: sd.rev,
                                            bg: "var(--sage-soft)",
                                            c: "var(--sage-d)"
                                        },
                                        {
                                            label: "全年開支",
                                            val: sd.exp,
                                            bg: "var(--clay-soft)",
                                            c: "var(--clay-d)"
                                        },
                                        {
                                            label: "全年淨利",
                                            val: net,
                                            bg: "#F6F1E3",
                                            c: net >= 0 ? "var(--sage-d)" : "var(--clay-d)"
                                        },
                                    ];
                                    return (
                                        <div key={sd.title}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                marginBottom: 10
                                            }}>
                                                <span style={{
                                                    width: 6,
                                                    height: 18,
                                                    borderRadius: 3,
                                                    background: sd.color
                                                }}/>
                                                <span style={{fontSize: 15, fontWeight: 700}}>{sd.title}</span>
                                            </div>
                                            <div style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(3,1fr)",
                                                gap: 12
                                            }}>
                                                {cards.map((x) => (
                                                    <div key={x.label} style={{
                                                        background: x.bg,
                                                        borderRadius: 14,
                                                        padding: "14px 14px"
                                                    }}>
                                                        <div style={{
                                                            fontSize: 11.5,
                                                            color: x.c,
                                                            marginBottom: 7,
                                                            lineHeight: 1.3
                                                        }}>{x.label}</div>
                                                        <div style={{
                                                            fontSize: 18,
                                                            fontWeight: 700,
                                                            color: x.c
                                                        }}>{money(x.val)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="ta-card" style={{padding: 20}}>
                            <div style={{fontSize: 14, fontWeight: 600, marginBottom: 14}}>各月營收與開支</div>
                            <div style={{height: 280}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={report.months} barGap={3}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#EFEADF" vertical={false}/>
                                        <XAxis dataKey="name" tick={{fontSize: 11, fill: "#9A9283"}}
                                               axisLine={false} tickLine={false} interval={0}/>
                                        <YAxis tick={{fontSize: 12, fill: "#B5AE9F"}} axisLine={false}
                                               tickLine={false}
                                               tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} width={42}/>
                                        <Tooltip formatter={(v) => money(v)} cursor={{fill: "#F5F1E8"}}
                                                 contentStyle={{
                                                     borderRadius: 12,
                                                     border: "1px solid #ECE6DA",
                                                     fontSize: 13
                                                 }}/>
                                        <Legend wrapperStyle={{fontSize: 13}} iconType="circle"/>
                                        <Bar dataKey="營收" fill="#5E9B7D" radius={[5, 5, 0, 0]} maxBarSize={26}/>
                                        <Bar dataKey="開支" fill="#CE7E54" radius={[5, 5, 0, 0]} maxBarSize={26}/>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="ta-card" style={{padding: 20}}>
                            <div style={{fontSize: 14, fontWeight: 600, marginBottom: 12}}>各月明細</div>
                            {repRows.length === 0 ? (
                                <div style={{
                                    padding: "24px",
                                    textAlign: "center",
                                    color: "var(--muted)",
                                    fontSize: 13.5
                                }}>{repYear} 年尚無資料</div>
                            ) : (
                                <div className="ta-scroll" style={{overflowX: "auto"}}>
                                    <table style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        fontSize: 13,
                                        minWidth: 560
                                    }}>
                                        <thead>
                                        <tr style={{color: "var(--muted)", fontSize: 12, textAlign: "right"}}>
                                            <th style={{
                                                textAlign: "left",
                                                padding: "8px 6px",
                                                fontWeight: 500
                                            }}>月份
                                            </th>
                                            <th style={{padding: "8px 6px", fontWeight: 500}}>茶園營收</th>
                                            <th style={{padding: "8px 6px", fontWeight: 500}}>茶園支出</th>
                                            <th style={{padding: "8px 6px", fontWeight: 500}}>茶廠收入</th>
                                            <th style={{padding: "8px 6px", fontWeight: 500}}>茶廠支出</th>
                                            <th style={{padding: "8px 6px", fontWeight: 500}}>淨利</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {repRows.map((m) => (
                                            <tr key={m.name}
                                                style={{borderTop: "1px solid var(--line)", textAlign: "right"}}>
                                                <td style={{
                                                    textAlign: "left",
                                                    padding: "10px 6px",
                                                    fontWeight: 600
                                                }}>{m.name}</td>
                                                <td style={{
                                                    padding: "10px 6px",
                                                    color: "var(--sage-d)"
                                                }}>{money(m.銷售)}</td>
                                                <td style={{
                                                    padding: "10px 6px",
                                                    color: "var(--clay-d)"
                                                }}>{money(m.茶園支出)}</td>
                                                <td style={{
                                                    padding: "10px 6px",
                                                    color: "var(--sage-d)"
                                                }}>{money(m.茶廠收入)}</td>
                                                <td style={{
                                                    padding: "10px 6px",
                                                    color: "var(--clay-d)"
                                                }}>{money(m.茶廠支出)}</td>
                                                <td style={{
                                                    padding: "10px 6px",
                                                    fontWeight: 600,
                                                    color: m.淨利 >= 0 ? "var(--sage-d)" : "var(--clay-d)"
                                                }}>{money(m.淨利)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{
                                            borderTop: "2px solid var(--line)",
                                            textAlign: "right",
                                            background: "#FBF9F4"
                                        }}>
                                            <td style={{
                                                textAlign: "left",
                                                padding: "11px 6px",
                                                fontWeight: 700
                                            }}>合計
                                            </td>
                                            <td style={{
                                                padding: "11px 6px",
                                                fontWeight: 700,
                                                color: "var(--sage-d)"
                                            }}>{money(report.園營收)}</td>
                                            <td style={{
                                                padding: "11px 6px",
                                                fontWeight: 700,
                                                color: "var(--clay-d)"
                                            }}>{money(report.園開支)}</td>
                                            <td style={{
                                                padding: "11px 6px",
                                                fontWeight: 700,
                                                color: "var(--sage-d)"
                                            }}>{money(report.廠營收)}</td>
                                            <td style={{
                                                padding: "11px 6px",
                                                fontWeight: 700,
                                                color: "var(--clay-d)"
                                            }}>{money(report.廠開支)}</td>
                                            <td style={{
                                                padding: "11px 6px",
                                                fontWeight: 700,
                                                color: "var(--sage-d)"
                                            }}>{money(report.園營收 + report.廠營收 - report.園開支 - report.廠開支)}</td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div style={{textAlign: "center", marginTop: 22, fontSize: 12, color: "#C2BBAD"}}>
                    已同步至雲端
                    <span style={{margin: "0 8px"}}>·</span>
                    <button onClick={() => signOut(auth)} style={linkStyle}>登出</button>
                </div>
            </div>

            {exportOpen && (
                <div className="ta-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) setExportOpen(false);
                }}>
                    <div className="ta-card" style={{width: "100%", maxWidth: 420, padding: 22}}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 18
                        }}>
                            <div style={{fontSize: 16, fontWeight: 600}}>匯出 CSV</div>
                            <button className="ta-icon-btn" onClick={() => setExportOpen(false)}><X size={18}/>
                            </button>
                        </div>
                        <div style={{display: "flex", flexDirection: "column", gap: 16}}>
                            <Field label="時間（最多匯出整年）">
                                <div style={{display: "flex", gap: 8}}>
                                    {YSEL(exportPeriod, (y) => setExportPeriod((f) => ({...f, y})))}
                                    {MSEL(exportPeriod, setExportPeriod)}
                                </div>
                            </Field>
                            <div className="ta-field">
                                <span className="ta-label">資料類型</span>
                                <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                    {[{k: "sales", t: "銷售"}, {k: "exp", t: "開支"}, {
                                        k: "report",
                                        t: "報表整頁"
                                    }].map((o) => (
                                        <button key={o.k}
                                                onClick={() => setExportTypes((t) => ({...t, [o.k]: !t[o.k]}))}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 9,
                                                    cursor: "pointer",
                                                    padding: "11px 12px",
                                                    border: "1px solid var(--line)",
                                                    borderRadius: 12,
                                                    background: exportTypes[o.k] ? "var(--sage-soft)" : "var(--field)",
                                                    fontFamily: "inherit",
                                                    textAlign: "left",
                                                    width: "100%"
                                                }}>
                                            {exportTypes[o.k] ?
                                                <CheckCircle2 size={18} style={{color: "var(--sage-d)"}}/> :
                                                <Circle size={18} style={{color: "var(--muted)"}}/>}
                                            <span style={{
                                                fontSize: 14,
                                                color: exportTypes[o.k] ? "var(--sage-d)" : "var(--ink)",
                                                fontWeight: 500
                                            }}>{o.t}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{display: "flex", gap: 10, marginTop: 22}}>
                            <button className="ta-btn ta-ghost" style={{flex: 1}}
                                    onClick={() => setExportOpen(false)}>取消
                            </button>
                            <button className="ta-btn ta-primary" style={{flex: 1}}
                                    disabled={!exportTypes.sales && !exportTypes.exp && !exportTypes.report}
                                    onClick={runExport}>匯出 CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editing && (
                <div className="ta-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) setEditing(null);
                }}>
                    <div className="ta-card"
                         style={{width: "100%", maxWidth: 440, padding: 22, maxHeight: "88vh", overflowY: "auto"}}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 18
                        }}>
                            <div style={{fontSize: 16, fontWeight: 600}}>
                                {editing.data.id ? "編輯" : "新增"}
                                {{
                                    customer: "客戶",
                                    item: "品項",
                                    sale: "銷售",
                                    expD: "茶廠支出",
                                    expP: "茶廠收入",
                                    expG: "茶園支出"
                                }[editing.type]}
                            </div>
                            <button className="ta-icon-btn" onClick={() => setEditing(null)}><X size={18}/></button>
                        </div>
                        <div style={{display: "flex", flexDirection: "column", gap: 14}}>
                            {editing.type === "customer" && (<>
                                <Field label="姓名" required><input className="ta-input" value={editing.data.name}
                                                                    onChange={(e) => setField("name", e.target.value)}
                                                                    placeholder="客戶姓名" autoFocus/></Field>
                                <Field label="電話"><input className="ta-input" value={editing.data.phone}
                                                           onChange={(e) => setField("phone", e.target.value)}
                                                           placeholder="09xx-xxx-xxx"/></Field>
                                <Field label="收件地址"><input className="ta-input" value={editing.data.address}
                                                               onChange={(e) => setField("address", e.target.value)}
                                                               placeholder="寄送地址"/></Field>
                                <Field label="備註"><input className="ta-input" value={editing.data.note}
                                                           onChange={(e) => setField("note", e.target.value)}
                                                           placeholder="偏好口味、注意事項…"/></Field>
                            </>)}
                            {editing.type === "item" && (<>
                                <Field label="品項名稱" required><input className="ta-input"
                                                                        value={editing.data.name}
                                                                        onChange={(e) => setField("name", e.target.value)}
                                                                        placeholder="例：高山烏龍"
                                                                        autoFocus/></Field>
                                <Field label="庫存（斤）" required><input type="number" min="0" step="0.1"
                                                                        className="ta-input"
                                                                        value={editing.data.qty}
                                                                        onChange={(e) => setField("qty", e.target.value)}
                                                                        placeholder="目前進貨總斤數"/></Field>
                                <div
                                    style={{fontSize: 12, color: "var(--muted)", marginTop: -4}}>之後補貨時，回來把這個斤數加上去即可。
                                </div>
                            </>)}
                            {editing.type === "sale" && (<>
                                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12}}>
                                    <Field label="日期" required><input type="date" className="ta-input"
                                                                        value={editing.data.date}
                                                                        onChange={(e) => setField("date", e.target.value)}/></Field>
                                    <Field label="客戶">
                                        <button type="button" className="ta-input" style={{
                                            textAlign: "left",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 8
                                        }} onClick={() => {
                                            setPickQ("");
                                            setPickCust(true);
                                        }}>
                                            <span style={{
                                                color: editing.data.customerName ? "var(--ink)" : "#C2BBAD",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap"
                                            }}>{editing.data.customerName || "選擇客戶"}</span>
                                            <ChevronDown size={16} style={{color: "var(--muted)", flexShrink: 0}}/>
                                        </button>
                                    </Field>
                                </div>
                                <Field label="品項" required>
                                    <select className="ta-input ta-select" value={editing.data.itemId}
                                            onChange={(e) => {
                                                const it = items.find((i) => i.id === e.target.value);
                                                setEditing((p) => ({
                                                    ...p,
                                                    data: {
                                                        ...p.data,
                                                        itemId: it ? it.id : "",
                                                        itemName: it ? it.name : ""
                                                    }
                                                }));
                                            }}>
                                        <option
                                            value="">{items.length ? "選擇品項" : "（請先到品項分頁新增）"}</option>
                                        {editing.data.itemId && !items.find((i) => i.id === editing.data.itemId) &&
                                            <option
                                                value={editing.data.itemId}>{editing.data.itemName}（已刪除）</option>}
                                        {items.map((i) => <option key={i.id}
                                                                  value={i.id}>{i.name}（剩 {jin(remainOf(i))}）</option>)}
                                    </select>
                                </Field>
                                <div style={{display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12}}>
                                    <Field label="數量（斤）" required><input type="number" min="0" step="0.1"
                                                                            className="ta-input"
                                                                            value={editing.data.qty}
                                                                            onChange={(e) => setField("qty", e.target.value)}
                                                                            placeholder="斤"/></Field>
                                    <Field label="總計" required><input type="number" min="0" className="ta-input"
                                                                        value={editing.data.amount}
                                                                        onChange={(e) => setField("amount", e.target.value)}
                                                                        placeholder="總金額"/></Field>
                                </div>
                                <div onClick={() => setField("paid", !editing.data.paid)} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 9,
                                    cursor: "pointer",
                                    padding: "11px 12px",
                                    border: "1px solid var(--line)",
                                    borderRadius: 12,
                                    background: editing.data.paid ? "var(--sage-soft)" : "var(--field)"
                                }}>
                                    {editing.data.paid ?
                                        <CheckCircle2 size={19} style={{color: "var(--sage-d)"}}/> :
                                        <Circle size={19} style={{color: "var(--muted)"}}/>}
                                    <span style={{
                                        fontSize: 14,
                                        color: editing.data.paid ? "var(--sage-d)" : "var(--ink)",
                                        fontWeight: 500
                                    }}>已匯款</span>
                                </div>
                                <Field label="備註"><input className="ta-input" value={editing.data.note}
                                                           onChange={(e) => setField("note", e.target.value)}
                                                           placeholder="選填"/></Field>
                            </>)}
                            {(editing.type === "expD" || editing.type === "expG") && (<>
                                <Field label="日期" required><input type="date" className="ta-input"
                                                                    value={editing.data.date}
                                                                    onChange={(e) => setField("date", e.target.value)}/></Field>
                                <Field label="事項" required><input className="ta-input" value={editing.data.item}
                                                                    onChange={(e) => setField("item", e.target.value)}
                                                                    placeholder="例：包裝紙盒、肥料、工資" autoFocus/></Field>
                                <Field label="金額" required><input type="number" min="0" className="ta-input"
                                                                    value={editing.data.amount}
                                                                    onChange={(e) => setField("amount", e.target.value)}
                                                                    placeholder="金額"/></Field>
                            </>)}
                            {editing.type === "expP" && (
                                <FactoryIncomeFields editing={editing} setEditing={setEditing} records={expP}/>
                            )}
                        </div>
                        <div style={{display: "flex", gap: 10, marginTop: 22}}>
                            <button className="ta-btn ta-ghost" style={{flex: 1}}
                                    onClick={() => setEditing(null)}>取消
                            </button>
                            <button className="ta-btn ta-primary" style={{flex: 1}} disabled={!valid}
                                    onClick={commit}>儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editing && pickCust && (
                <div className="ta-overlay" style={{zIndex: 60}} onClick={(e) => {
                    if (e.target === e.currentTarget) setPickCust(false);
                }}>
                    <div className="ta-card" style={{
                        width: "100%",
                        maxWidth: 380,
                        padding: 18,
                        maxHeight: "80vh",
                        display: "flex",
                        flexDirection: "column"
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 14
                        }}>
                            <div style={{fontSize: 15.5, fontWeight: 600}}>選擇客戶</div>
                            <button className="ta-icon-btn" onClick={() => setPickCust(false)}><X size={18}/>
                            </button>
                        </div>
                        <div style={{position: "relative", marginBottom: 12}}>
                            <Search size={16}
                                    style={{position: "absolute", left: 12, top: 12, color: "var(--muted)"}}/>
                            <input className="ta-input" style={{paddingLeft: 36}} placeholder="輸入姓名搜尋…"
                                   autoFocus value={pickQ} onChange={(e) => setPickQ(e.target.value)}/>
                        </div>
                        <div className="ta-scroll" style={{
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            maxHeight: "50vh"
                        }}>
                            <button className="ta-row" style={pickRowStyle} onClick={() => {
                                setEditing((p) => ({...p, data: {...p.data, customerId: null, customerName: ""}}));
                                setPickCust(false);
                            }}>
                                <span style={{color: "var(--muted)"}}>未指定客戶</span>
                                {!editing.data.customerId && <Check size={16} style={{color: "var(--sage-d)"}}/>}
                            </button>
                            {pickList.length === 0 ? (
                                <div style={{
                                    padding: "24px 8px",
                                    textAlign: "center",
                                    color: "var(--muted)",
                                    fontSize: 13.5
                                }}>{customers.length ? "找不到符合的客戶" : "還沒有客戶，請先到「客戶」分頁新增"}</div>
                            ) : pickList.map((c) => (
                                <button key={c.id} className="ta-row" style={pickRowStyle} onClick={() => {
                                    setEditing((p) => ({
                                        ...p,
                                        data: {...p.data, customerId: c.id, customerName: c.name}
                                    }));
                                    setPickCust(false);
                                }}>
              <span style={{minWidth: 0}}>
                <span style={{fontWeight: 500, display: "block"}}>{c.name}</span>
                  {c.phone && <span style={{fontSize: 12, color: "var(--muted)"}}>{c.phone}</span>}
              </span>
                                    {editing.data.customerId === c.id &&
                                        <Check size={16} style={{color: "var(--sage-d)", flexShrink: 0}}/>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {custModal && cs && (
                <div className="ta-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) setCustModal(null);
                }}>
                    <div className="ta-card" style={{
                        width: "100%",
                        maxWidth: 440,
                        padding: 22,
                        maxHeight: "88vh",
                        display: "flex",
                        flexDirection: "column"
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 14
                        }}>
                            <div>
                                <div style={{fontSize: 17, fontWeight: 600}}>{custModal.name}</div>
                                <div style={{
                                    fontSize: 12.5,
                                    color: "var(--muted)",
                                    marginTop: 3
                                }}>{custModal.phone}{custModal.phone && custModal.address ? " · " : ""}{custModal.address}</div>
                            </div>
                            <button className="ta-icon-btn" onClick={() => setCustModal(null)}><X size={18}/>
                            </button>
                        </div>
                        <div style={{display: "flex", gap: 8, marginBottom: 14}}>
                            {YSEL(custFilter, (y) => setCustFilter((f) => ({...f, y})))}
                            {MSEL(custFilter, setCustFilter)}
                        </div>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3,1fr)",
                            gap: 10,
                            marginBottom: 8
                        }}>
                            {[
                                {label: "訂單數", val: `${cs.count} 筆`, c: "var(--ink)"},
                                {label: "總斤數", val: jin(cs.jin), c: "var(--sage-d)"},
                                {label: "總金額", val: money(cs.amt), c: "var(--sage-d)"},
                            ].map((x) => (
                                <div key={x.label} style={{
                                    background: "var(--field)",
                                    borderRadius: 12,
                                    padding: "12px 10px",
                                    textAlign: "center"
                                }}>
                                    <div style={{
                                        fontSize: 11.5,
                                        color: "var(--muted)",
                                        marginBottom: 5
                                    }}>{x.label}</div>
                                    <div style={{fontSize: 15, fontWeight: 700, color: x.c}}>{x.val}</div>
                                </div>
                            ))}
                        </div>
                        {cs.unpaid > 0 && (
                            <div style={{
                                padding: "10px 14px",
                                background: "var(--clay-soft)",
                                borderRadius: 12,
                                fontSize: 13,
                                color: "var(--clay-d)",
                                marginBottom: 8
                            }}>尚有未收款 <b>{money(cs.unpaid)}</b></div>
                        )}
                        <div style={{fontSize: 12.5, color: "var(--muted)", margin: "10px 0 8px"}}>購買紀錄</div>
                        <div className="ta-scroll" style={{
                            overflowY: "auto",
                            maxHeight: "40vh",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6
                        }}>
                            {cs.list.length === 0 ? (
                                <div style={{
                                    padding: "20px",
                                    textAlign: "center",
                                    color: "var(--muted)",
                                    fontSize: 13.5
                                }}>此區間尚無購買紀錄</div>
                            ) : cs.list.map((s) => (
                                <div key={s.id} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "9px 12px",
                                    border: "1px solid var(--line)",
                                    borderRadius: 10
                                }}>
                                    <div style={{
                                        fontSize: 12.5,
                                        color: "var(--muted)",
                                        width: 64,
                                        flexShrink: 0
                                    }}>{s.date.slice(2)}</div>
                                    <div style={{flex: 1, minWidth: 0}}>
                                        <div style={{fontSize: 13.5, fontWeight: 500}}>{s.itemName}</div>
                                        <div style={{fontSize: 12, color: "var(--muted)"}}>{jin(s.qty)}</div>
                                    </div>
                                    <div style={{textAlign: "right"}}>
                                        <div style={{
                                            fontSize: 13.5,
                                            fontWeight: 600,
                                            color: "var(--sage-d)"
                                        }}>{money(s.amount)}</div>
                                        {!s.paid &&
                                            <span style={{fontSize: 11, color: "var(--clay-d)"}}>未匯款</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {del && (
                <div className="ta-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) setDel(null);
                }}>
                    <div className="ta-card"
                         style={{width: "100%", maxWidth: 360, padding: 24, textAlign: "center"}}>
                        <div style={{
                            width: 46,
                            height: 46,
                            borderRadius: 14,
                            background: "var(--clay-soft)",
                            margin: "0 auto 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            <AlertTriangle size={22} style={{color: "var(--clay-d)"}}/>
                        </div>
                        <div style={{fontSize: 15.5, fontWeight: 600, marginBottom: 6}}>確定刪除？</div>
                        <div
                            style={{fontSize: 13.5, color: "var(--muted)", marginBottom: 20}}>將永久刪除「{del.name}」，此動作無法復原。
                        </div>
                        <div style={{display: "flex", gap: 10}}>
                            <button className="ta-btn ta-ghost" style={{flex: 1}}
                                    onClick={() => setDel(null)}>取消
                            </button>
                            <button className="ta-btn ta-danger" style={{flex: 1}} onClick={doDelete}>刪除</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
