import {useMemo, useRef, useState} from "react";
import {Ask, FINE, Icon, Panel, PeriodNav, Sheet, useMedia} from "./ui.jsx";
import {avTone, buildCsvRows, downloadCsv, initial, inPeriod, jin, md, money, nowYM, soldBy, stockState, sum, thisMonth, yearsOf} from "./lib.js";

/* ---------- 新增／編輯 客戶、茶種 ---------- */
export function FormSheet({sheet, level, db, wide, onSave, onDelete, onClose}) {
    const {type} = sheet, editing = !!sheet.rec;
    const init = useMemo(() => (type === "customer" ? {name: "", phone: "", address: "", note: "", ...sheet.rec} : {name: "", qty: "", ...sheet.rec}), []); // eslint-disable-line react-hooks/exhaustive-deps
    const [f, setF] = useState(init), [errs, setErrs] = useState({}), [ask, setAsk] = useState(false);
    // 電腦才自動把游標放進第一格；手機、平板等使用者點了才跳鍵盤，視窗滑上來時不會跟鍵盤搶動畫
    const autoFocus = useMedia(FINE) && !editing;
    const dirty = JSON.stringify(f) !== JSON.stringify(init);
    const set = (k, v) => {
        setF((x) => ({...x, [k]: v}));
        setErrs((e) => ({...e, [k]: undefined}));
    };
    const sold = soldBy(db.sales)[f.id] || 0;
    const submit = () => {
        const e = {};
        if (!f.name.trim()) e.name = type === "customer" ? "請輸入客戶姓名" : "請輸入茶種名稱";
        if (type === "item" && (String(f.qty).trim() === "" || !(Number(f.qty) >= 0))) e.qty = "請輸入進貨總斤數，例如 20";
        setErrs(e);
        const k = Object.keys(e)[0];
        if (k) {
            const el = document.getElementById("ff-" + k);
            if (el) el.focus();
            return;
        }
        onSave(type, {...f, name: f.name.trim(), ...(type === "item" ? {qty: String(f.qty).trim()} : {})});
    };
    const inp = (k, ph, extra = {}) => (
        <input id={"ff-" + k} className="text-in" value={f[k] ?? ""} placeholder={ph} autoComplete="off" onChange={(e) => set(k, e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") submit(); }} {...extra}/>
    );
    const fld = (k, label, req, input, hint) => (
        <div className={"field" + (errs[k] ? " bad" : "")}>
            <label htmlFor={"ff-" + k}>{label}{req ? <span className="req"> *</span> : null}</label>{input}
            {errs[k] ? <span className="emsg">{errs[k]}</span> : hint ? <span className="hint">{hint}</span> : null}
        </div>
    );
    const requestClose = () => {
        if (dirty && !ask) { setAsk(true); return; }
        onClose();
    };
    return (
        <Sheet title={(editing ? "編輯" : "新增") + (type === "customer" ? "客戶" : "茶種")} closing={sheet.closing} z={level} drag={!wide} onRequestClose={requestClose}
               actions={editing ? <button className="icon-btn" aria-label="刪除" style={{color: "var(--clay)"}} onClick={() => onDelete(type, sheet.rec)}><Icon n="trash"/></button> : null}
               footer={<button className="btn primary grow" onClick={submit}>{editing ? "儲存" : "新增"}</button>}>
            {ask ? <Ask text="還沒存，要放棄修改嗎？" keep="繼續編輯" onKeep={() => setAsk(false)} onDiscard={onClose}/> : null}
            {type === "customer" ? <>
                {fld("name", "姓名", true, inp("name", "客戶姓名", {autoFocus}))}
                {fld("phone", "電話", false, inp("phone", "09xx-xxx-xxx", {inputMode: "tel"}))}
                {fld("address", "收件地址", false, inp("address", "寄送地址"))}
                {fld("note", "備註", false, inp("note", "偏好口味、注意事項…"))}
            </> : <>
                {fld("name", "茶種名稱", true, inp("name", "例如 高山烏龍", {autoFocus}))}
                {fld("qty", "進貨總斤數", true, inp("qty", "0", {inputMode: "decimal"}),
                    editing ? `已賣出 ${jin(sold)}，目前剩 ${jin(Number(f.qty || 0) - sold)}` : "剩餘會自動扣掉賣出的斤數")}
                <div className="chips"><span className="hint" style={{alignSelf: "center"}}>補貨</span>
                    {[1, 5, 10].map((d) => <button key={d} className="chip num" onClick={() => set("qty", String(Math.round(((Number(f.qty) || 0) + d) * 100) / 100))}>＋{d} 斤</button>)}</div>
            </>}
        </Sheet>
    );
}

/* ---------- 客戶詳情（手機疊上來／平板電腦並排） ---------- */
export function CustomerView({cid, panel, sheet, level = 0, db, wide, onClose, onEdit, onPaid, onOpenEntry}) {
    const live = db.customers.find((x) => x.id === cid), keep = useRef(live);
    if (live) keep.current = live;
    const c = keep.current;
    const [p, setP] = useState(thisMonth);
    const [copied, setCopied] = useState(false);
    if (!c) return panel ? <section className="panel"><div className="pn-empty">{db.customers.length ? "點左邊的客戶查看資料" : "還沒有客戶"}</div></section> : null;
    const all = db.sales.filter((s) => s.customerId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const list = all.filter((s) => inPeriod(s.date, p)), due = all.filter((s) => !s.paid);
    const copy = () => {
        const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
        try { navigator.clipboard.writeText(c.phone).then(done, done); } catch { done(); }
    };
    const edit = <button className="icon-btn" aria-label="編輯客戶" onClick={() => onEdit(c)}><Icon n="pencil"/></button>;
    const body = <>
        <div className="prof"><span className={"av lg " + avTone(c.name)}>{initial(c.name)}</span>
            <div><h2>{c.name}</h2>
                <p className="num">{c.phone ? <><a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} style={{color: "inherit"}}>{c.phone}</a> · <button className="linkb" style={{padding: 0, fontSize: 13.5}} onClick={copy}>{copied ? "已複製" : "複製"}</button></> : "沒有電話"}</p>
                {c.address ? <p>{c.address}</p> : null}{c.note ? <p>備註：{c.note}</p> : null}</div>
        </div>
        {due.length ? <>
            <div className="group-title">未收款 · <span className="mv num">{money(sum(due))}</span></div>
            <div className="list-card">{due.map((s) => (
                <div className="lrow" key={s.id}>
                    <span className="grow"><span className="num">{md(s.date)}</span> {s.itemName} {jin(s.qty)}<br/><small className="mv num">{money(s.amount)}</small></span>
                    <button className="btn sm soft" onClick={() => onPaid(s)}><Icon n="check" s={16}/>收到了</button>
                </div>))}</div>
        </> : null}
        <PeriodNav p={p} setP={setP} light/>
        <div className="stats">
            <div className="stat"><span>訂單</span><b className="num">{list.length} 筆</b></div>
            <div className="stat"><span>斤數</span><b className="num">{jin(sum(list, "qty"))}</b></div>
            <div className="stat"><span>金額</span><b className="mv num">{money(sum(list))}</b></div>
        </div>
        <div className="group-title">購買紀錄</div>
        {list.length ? <div className="hist">{list.map((s) => (
            <div className="hrow" key={s.id}><span className="d num">{md(s.date)}</span>
                <span className="m">{s.itemName} · <span className="num">{jin(s.qty)}</span></span>
                <span className="mv num" style={{fontWeight: 600}}>{money(s.amount)}</span>
                {!s.paid ? <span className="due" style={{pointerEvents: "none"}}>未收</span> : null}</div>))}</div>
            : <div className="empty" style={{padding: 16}}>{p.mode === "year" ? "這一年沒有買" : "這個月沒有買"}</div>}
    </>;
    const foot = <button className="btn primary grow" onClick={() => onOpenEntry(c)}><Icon n="plus" s={18}/>幫 {c.name} 記一筆</button>;
    if (panel) return <Panel title={c.name} head={<span className="pn-kicker">客戶資料</span>} actions={edit} footer={foot}>{body}</Panel>;
    return <Sheet title={c.name} closing={sheet.closing} z={level} drag={!wide} onRequestClose={onClose} head={<span style={{flex: 1}}/>} actions={edit} footer={foot}>{body}</Sheet>;
}

/* ---------- 茶種詳情 ---------- */
export function ItemView({iid, panel, sheet, level = 0, db, wide, onClose, onEdit}) {
    const live = db.items.find((x) => x.id === iid), keep = useRef(live);
    if (live) keep.current = live;
    const it = keep.current;
    if (!it) return panel ? <section className="panel"><div className="pn-empty">{db.items.length ? "點左邊的茶罐查看詳情" : "還沒有茶種"}</div></section> : null;
    const sales = db.sales.filter((s) => s.itemId === it.id).sort((a, b) => b.date.localeCompare(a.date));
    const sold = sum(sales, "qty"), q = Number(it.qty || 0), r = q - sold, [k, t] = stockState(r);
    const body = <>
        {panel ? <h2 className="pn-big">{it.name}</h2> : null}
        <div className="stats">
            <div className="stat"><span>剩餘</span><b className="num">{jin(r)}</b></div>
            <div className="stat"><span>進貨</span><b className="num">{jin(q)}</b></div>
            <div className="stat"><span>已賣出</span><b className="num">{jin(sold)}</b></div>
        </div>
        <span className={"state " + k} style={{marginTop: -4}}>{t}</span>
        <div className="group-title">最近賣出</div>
        {sales.length ? <div className="hist">{sales.slice(0, 20).map((s) => (
            <div className="hrow" key={s.id}><span className="d num">{md(s.date)}</span><span className="m">{s.customerName || "未指定客戶"}</span>
                <span className="num">{jin(s.qty)}</span><span className="mv num" style={{fontWeight: 600, width: 84, textAlign: "right"}}>{money(s.amount)}</span></div>))}</div>
            : <div className="empty" style={{padding: 16}}>還沒賣出</div>}
    </>;
    const foot = <button className="btn primary grow" onClick={() => onEdit(it)}><Icon n="pencil" s={18}/>補貨或修改</button>;
    if (panel) return <Panel title={it.name} head={<span className="pn-kicker">茶種詳情</span>} footer={foot}>{body}</Panel>;
    return <Sheet title={it.name} closing={sheet.closing} z={level} drag={!wide} onRequestClose={onClose} footer={foot}>{body}</Sheet>;
}

/* ---------- 設定：匯出、外觀、帳號 ---------- */
export function SettingsSheet({sheet, level, db, wide, theme, setTheme, masked, setMasked, sync, onClose, onExported, onLogout}) {
    const [y, setY] = useState(() => nowYM().y), [m, setM] = useState("all"), [t, setT] = useState({sales: true, exp: true, report: true}), [err, setErr] = useState("");
    const years = yearsOf(db);
    const run = () => {
        if (!t.sales && !t.exp && !t.report) { setErr("至少選一種資料"); return; }
        const {rows, name} = buildCsvRows(db, y, m, t);
        downloadCsv(name, rows);
        onExported(name);
    };
    return (
        <Sheet title="設定" closing={sheet.closing} z={level} drag={!wide} onRequestClose={onClose}>
            <div className="group-title">匯出 CSV</div>
            <div className="chips">
                {years.map((yy) => <button key={yy} className="chip num" aria-pressed={y === yy} onClick={() => setY(yy)}>{yy}</button>)}
                <select className="chip" value={m} onChange={(e) => setM(e.target.value)} aria-label="月份">
                    <option value="all">全年</option>
                    {Array.from({length: 12}, (_, i) => <option key={i} value={i + 1}>{i + 1} 月</option>)}
                </select>
            </div>
            <div className="toggles">{[["sales", "銷售明細"], ["exp", "開支與茶廠收入"], ["report", "報表整頁"]].map(([k, n]) => (
                <button key={k} className="tog" aria-pressed={t[k]} onClick={() => { setT((x) => ({...x, [k]: !x[k]})); setErr(""); }}>
                    <span className="box">{t[k] ? <Icon n="check" s={15} w={2.6}/> : null}</span>{n}</button>))}</div>
            {err ? <span className="emsg">{err}</span> : null}
            <button className="btn primary" onClick={run}><Icon n="download" s={18}/>匯出 {y} {m === "all" ? "全年" : m + " 月"}</button>
            <div className="group-title">外觀與隱私</div>
            <div className="chips">{[["system", "跟隨系統"], ["light", "淺色"], ["dark", "深色"]].map(([v, n]) => (
                <button key={v} className="chip" aria-pressed={theme === v} onClick={() => setTheme(v)}>{n}</button>))}</div>
            <button className="swrow" role="switch" aria-checked={masked} onClick={() => setMasked(!masked)}>
                <span><span className="t">隱藏金額</span><span className="d">在別人面前打開 App 時，金額會先模糊</span></span>
                <span className={"switch" + (masked ? " on" : "")}/>
            </button>
            <div className="group-title">帳號</div>
            <div className="list-card">
                <div className="lrow"><Icon n={sync === "saving" ? "refresh" : sync === "error" ? "cloudAlert" : "cloudCheck"}/>
                    <span className="grow">{sync === "saving" ? "同步中…" : sync === "error" ? "有資料還沒存到雲端，請檢查網路" : "已同步到雲端"}</span></div>
                <button className="lrow" onClick={onLogout} style={{color: "var(--clay)"}}><Icon n="logout"/><span className="grow">登出</span></button>
            </div>
        </Sheet>
    );
}
