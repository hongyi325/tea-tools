import {useEffect, useMemo, useRef, useState} from "react";
import {Ask, Icon, Panel, Sheet, useEscape, useSubSheet} from "./ui.jsx";
import {
    avTone, calcQP, catIcon, DEFAULT_CATS, evalExpr, hasOp, initial, jin, KIND, lastPriceOf, lastSalePrice, md, money, nf, nf0,
    recentCustomers, recentNames, soldBy, stockState, today, typingTarget, wd,
} from "./lib.js";

const blank = (k, date = today()) => ({
    sale: {date, customerId: null, customerName: "", itemId: "", itemName: "", qty: "", price: "", amount: "", paid: false, note: ""},
    expP: {date, who: "", jin: "", price: "", amount: ""},
    expD: {date, item: "", amount: ""},
    expG: {date, item: "", amount: ""},
})[k];

/* 記一筆（手機：底部面板／平板：置中視窗／電腦：右側常駐）
   panel：電腦版並排在右邊；sheet：疊上來的視窗。rec 有值就是編輯。 */
export default function EntryCore({panel, sheet, level = 0, db, wide, keyboard, entryKind, rec, presetCustomer, onSave, onDelete, onClose, onAddItem}) {
    const editing = !!rec;
    const [kind, setKind] = useState(entryKind || "sale");
    const init = useMemo(() => {
        if (!editing) return kind === "sale" && presetCustomer ? {...blank("sale"), customerId: presetCustomer.id, customerName: presetCustomer.name} : blank(kind);
        if (kind === "sale") return {...blank("sale"), ...rec, price: Number(rec.qty) > 0 ? String(Math.round(Number(rec.amount) / Number(rec.qty))) : ""};
        if (kind === "expP") return {...blank("expP"), ...rec, price: rec.price ?? ""};
        return {...blank(kind), ...rec};
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const [f, setF] = useState(init);
    const hasCalc = kind === "sale" || kind === "expP", qKey = kind === "sale" ? "qty" : "jin";
    const [active, setActiveRaw] = useState(editing || !hasCalc ? "amount" : "q");
    const [fresh, setFresh] = useState(true);
    const setActive = (k) => { setActiveRaw(k); setFresh(true); };
    // 茶廠收入：金額和「斤數 × 單價」對得上才算自動計算；舊紀錄沒有單價，金額就當作手動輸入的，不會被改掉
    const [manual, setManual] = useState(() => editing && kind === "expP" && (calcQP(init.jin, init.price) === "" || Number(calcQP(init.jin, init.price)) !== Number(init.amount)));
    const [why, setWhy] = useState(null), [err, setErr] = useState(""), [ask, setAsk] = useState(false), [custom, setCustom] = useState(false);
    const [pick, openPick, closePick] = useSubSheet();
    const [pq, setPq] = useState("");
    const dirty = JSON.stringify(f) !== JSON.stringify(init);
    const K = KIND[kind];
    const sold = useMemo(() => soldBy(db.sales), [db.sales]);

    const put = (patch, man = manual) => {
        setF((prev) => {
            const n = {...prev, ...patch};
            if (hasCalc && !man) n.amount = calcQP(n[qKey], n.price);
            return n;
        });
        setManual(man);
        setErr("");
    };
    const switchKind = (k) => {
        if (k === kind) return;
        setKind(k);
        setF(blank(k, f.date));
        setActive(k === "sale" || k === "expP" ? "q" : "amount");
        setManual(false);
        setWhy(null);
        setErr("");
        setCustom(false);
    };
    const requestClose = () => {
        if (dirty && !ask) { setAsk(true); return; }
        onClose();
    };
    const chooseItem = (it) => {
        const lp = lastSalePrice(db.sales, it.id, f.customerId, f.id);
        put({itemId: it.id, itemName: it.name, ...(lp ? {price: String(lp.price)} : {})});
        setWhy(lp ? lp.why : null);
        if (!f.qty) setActive("q");
    };
    const chooseCustomer = (c) => {
        const patch = {customerId: c ? c.id : null, customerName: c ? c.name : ""};
        if (f.itemId) {
            const lp = lastSalePrice(db.sales, f.itemId, c ? c.id : null, f.id);
            if (lp && (why || !f.price)) { patch.price = String(lp.price); setWhy(lp.why); }
        }
        put(patch);
    };
    const setWho = (name, fromChip) => {
        const lp = lastPriceOf(db.expP, name, f.id);
        put({who: name, ...(lp ? {price: String(lp.price)} : {})});
        setWhy(lp ? `沿用 ${name.trim()} ${md(lp.date)} 的單價` : null);
        if (fromChip) {
            setCustom(false);
            if (!f.jin) setActive("q");
        }
    };
    const fieldVal = active === "amount" ? String(f.amount ?? "") : String((active === "q" ? f[qKey] : f.price) ?? "");
    const press = (key) => {
        const cur = fresh && key !== "+" && key !== "-" ? "" : fieldVal;
        let next = cur;
        setFresh(false);
        if (key === "del") next = cur.slice(0, -1);
        else if (key === "+" || key === "-") {
            if (active !== "amount" || !cur) return;
            next = /[+\-]$/.test(cur) ? cur.slice(0, -1) + key : cur + key;
        } else if (key === ".") {
            if (active === "amount" || cur.includes(".")) return;
            next = (cur || "0") + ".";
        } else {
            const seg = cur.split(/[+\-]/).pop();
            if (/\.\d{2}$/.test(cur)) return;
            next = seg === "0" ? cur.slice(0, -1) + key.replace(/^0+(?=\d)/, "") : cur + key;
            if (next.replace(/\D/g, "").length > 9) return;
        }
        if (active === "amount") {
            if (hasCalc && next === "") put({amount: ""}, false);
            else put({amount: next}, hasCalc ? true : manual);
        } else if (active === "q") put({[qKey]: next});
        else { put({price: next}); setWhy(null); }
    };
    const save = () => {
        const amount = evalExpr(f.amount), n = {...f, amount: amount > 0 ? String(amount) : ""};
        const need = (msg, focus) => { setErr(msg); if (focus) setActive(focus); };
        if (!n.date) return need("請選日期");
        if (kind === "sale") {
            if (!n.itemId) return need("先點選茶種");
            if (!(Number(n.qty) > 0)) return need("輸入斤數", "q");
            if (!(amount > 0)) return need("輸入金額，或填單價自動算", "amount");
        }
        if (kind === "expP") {
            n.who = (n.who || "").trim();
            if (!n.who) return need("先選對象，或點「其他」輸入名字");
            if (!(Number(n.jin) > 0)) return need("輸入斤數", "q");
            if (!(amount > 0)) return need("輸入金額，或填單價自動算", "amount");
        }
        if (kind === "expD" || kind === "expG") {
            n.item = (n.item || "").trim();
            if (!n.item) return need("先點選類別，或點「自訂」");
            if (!(amount > 0)) return need("輸入金額", "amount");
        }
        if (kind === "sale") delete n.price;
        if (kind === "expP" && !(Number(n.price) > 0)) n.price = "";
        onSave(kind, n);
    };
    const keyRef = useRef(null);
    keyRef.current = {press, save};
    useEffect(() => {
        if (!keyboard) return undefined;
        const h = (e) => {
            if (typingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
            let k = null;
            if (/^[0-9]$/.test(e.key)) k = e.key;
            else if (e.key === ".") k = ".";
            else if (e.key === "+") k = "+";
            else if (e.key === "-") k = "-";
            else if (e.key === "Backspace") k = "del";
            else if (e.key === "Enter") {
                if (e.target && e.target.closest && e.target.closest("button")) return;
                e.preventDefault();
                keyRef.current.save();
                return;
            } else return;
            e.preventDefault();
            keyRef.current.press(k);
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [keyboard]);
    // 電腦版右側：Esc 回到新的一筆（在其他視窗之下）
    useEscape(() => { if (editing || dirty) requestClose(); }, !!panel, true);

    const showAmount = f.amount ? (hasOp(f.amount) ? f.amount.replace(/-/g, "−") : nf0.format(Number(f.amount) || 0)) : "0";
    let sub = null;
    if (hasOp(f.amount)) sub = <span className="num">＝ {money(evalExpr(f.amount))}</span>;
    else if (hasCalc && !manual && f.amount) sub = <span className="num">{jin(f[qKey])} × {money(f.price)}</span>;
    else if (hasCalc && manual && calcQP(f[qKey], f.price)) {
        sub = <span>手動改過，自動計算是 {money(calcQP(f[qKey], f.price))} · <button className="linkb" style={{padding: 0, fontSize: 12.5}}
            onClick={(e) => { e.stopPropagation(); put({}, false); }}>改回自動</button></span>;
    } else if (hasCalc && manual) sub = <span>手動輸入的金額</span>;
    else if (hasCalc) sub = <span>{kind === "sale" ? "選茶種、輸入斤數就會算出金額" : "選對象、輸入斤數就會算出金額"}</span>;
    const fb = (key, label, val, unit, pre) => (
        <button className="fbtn" aria-pressed={active === key} onClick={() => setActive(key)}>
            <span>{label}</span>
            <b className={"num" + (val ? "" : " ph")}>{pre && val ? pre + " " : ""}{val ? nf.format(Number(val)) + (String(val).endsWith(".") ? "." : "") : "0"}{unit ? " " + unit : ""}
                {active === key ? <i className="caret"/> : null}</b>
        </button>
    );

    let ctx = null;
    if (kind === "sale") {
        const cust = recentCustomers(db, 5);
        if (f.customerId && !cust.find((c) => c.id === f.customerId)) {
            const c = db.customers.find((x) => x.id === f.customerId);
            cust.unshift(c || {id: f.customerId, name: f.customerName || "（已刪除的客戶）"});
        }
        const gone = f.itemId && !db.items.find((i) => i.id === f.itemId);
        ctx = <>
            <div className="ctx-label"><span>茶種</span><span>剩餘庫存</span></div>
            {db.items.length === 0 && !gone ? (
                <div className="empty-note"><span>還沒有茶種，先新增一種茶才能記銷售</span>
                    {onAddItem ? <button className="btn sm primary" onClick={onAddItem}><Icon n="plus" s={16}/>新增茶種</button> : null}</div>
            ) : (
                <div className="tiles">
                    {gone ? <button className="tile gone" aria-pressed="true"><span className="n">{f.itemName}</span><span className="s">（已刪除）</span></button> : null}
                    {db.items.map((it) => {
                        const r = Number(it.qty || 0) - (sold[it.id] || 0) + (editing && init.itemId === it.id ? Number(init.qty || 0) : 0);
                        const [k] = stockState(r);
                        return <button key={it.id} className="tile" aria-pressed={f.itemId === it.id} onClick={() => chooseItem(it)}>
                            <span className="n">{it.name}</span><span className={"s num " + k}>剩 {jin(r)}</span></button>;
                    })}
                    {onAddItem ? <button className="tile add" onClick={onAddItem}><Icon n="plus" s={16}/>新增</button> : null}
                </div>
            )}
            <div className="ctx-label"><span>客戶</span></div>
            <div className="chips">
                <button className="chip" aria-pressed={!f.customerId} onClick={() => chooseCustomer(null)}>未指定</button>
                {cust.map((c) => <button key={c.id} className="chip" aria-pressed={f.customerId === c.id} onClick={() => chooseCustomer(db.customers.find((x) => x.id === c.id) || c)}>{c.name}</button>)}
                <button className="chip more" onClick={() => { setPq(""); openPick({}); }}><Icon n="search" s={16}/>全部客戶</button>
            </div>
            <div className="fields">{fb("q", "斤數", f.qty, "斤")}{fb("price", "每斤單價", f.price, "", "NT$")}</div>
            {why ? <div className="hint"><b>{why}</b>，不同價直接改單價。</div> : null}
            <button className="swrow" role="switch" aria-checked={!!f.paid} onClick={() => put({paid: !f.paid})}>
                <span><span className="t">已收款</span><span className="d">{f.paid ? "這筆錢已經收到" : "還沒收到，會出現在未收款提醒"}</span></span>
                <span className={"switch" + (f.paid ? " on" : "")}/>
            </button>
            <input className="text-in" placeholder="備註（選填），例如 宅配" value={f.note || ""} onChange={(e) => put({note: e.target.value})} aria-label="備註"/>
        </>;
    }
    if (kind === "expP") {
        const names = recentNames(db.expP, "who", f.id, 5, true);
        const typed = (f.who || "").trim();
        const showInput = custom || (typed && !names.includes(typed));
        ctx = <>
            <div className="ctx-label"><span>對象</span><span>上次單價</span></div>
            <div className="chips">
                {names.map((n) => <button key={n} className="chip" aria-pressed={typed === n && !custom} onClick={() => setWho(n, true)}>
                    {n}<small className="num">{nf.format(Number(lastPriceOf(db.expP, n, f.id).price))}/斤</small></button>)}
                <button className="chip more" aria-pressed={!!showInput} onClick={() => setCustom(true)}><Icon n="pencil" s={15}/>其他</button>
            </div>
            {showInput ? <input className="text-in" placeholder="輸入對象名字" value={f.who} autoFocus={custom} onChange={(e) => setWho(e.target.value)} aria-label="對象"/> : null}
            <div className="fields">{fb("q", "斤數", f.jin, "斤")}{fb("price", "每斤單價", f.price, "", "NT$")}</div>
            {why ? <div className="hint"><b>{why}</b>，這次不同可以直接改。</div>
                : typed && !lastPriceOf(db.expP, typed, f.id) ? <div className="hint"><b>{typed} 還沒記過單價</b>：這次輸入後，下次就會自動帶入。</div> : null}
        </>;
    }
    if (kind === "expD" || kind === "expG") {
        const cats = [...new Set([...recentNames(db[kind], "item", f.id, 7), ...DEFAULT_CATS[kind]])].slice(0, 7);
        const isCustom = custom || (f.item && !cats.includes(f.item));
        ctx = <>
            <div className="ctx-label"><span>類別</span><span>常用的排前面</span></div>
            <div className="cats">
                {cats.map((c) => <button key={c} className="cat" style={{color: `var(--${K.tone})`}} aria-pressed={f.item === c && !isCustom} onClick={() => { put({item: c}); setCustom(false); }}>
                    <span className={"ic " + K.tone}><Icon n={catIcon(c, kind)} s={22}/></span><span style={{color: "var(--ink-2)"}}>{c}</span></button>)}
                <button className="cat" style={{color: "var(--ink-2)"}} aria-pressed={!!isCustom} onClick={() => { setCustom(true); if (cats.includes(f.item)) put({item: ""}); }}>
                    <span className="ic" style={{background: "var(--sunken)"}}><Icon n="pencil" s={20}/></span><span>自訂</span></button>
            </div>
            {isCustom ? <input className="text-in" placeholder="輸入事項，例如 修理揉捻機" value={f.item} autoFocus={custom} onChange={(e) => put({item: e.target.value})} aria-label="事項"/> : null}
        </>;
    }
    const dateLabel = f.date === today() ? `今天 ${md(f.date)}` : f.date ? `${f.date.slice(0, 4) === today().slice(0, 4) ? "" : f.date.slice(0, 4) + "/"}${md(f.date)} 週${wd(f.date)}` : "選日期";
    const head = editing ? <h2 className="sh-title">編輯{K.label}</h2> : <>
        <div className="io-seg" role="group" aria-label="收入或支出">
            <span className="ind" style={{transform: `translateX(${K.group === "in" ? 0 : 100}%)`, background: K.group === "in" ? "var(--tea)" : "var(--clay)"}}/>
            <button aria-pressed={K.group === "in"} onClick={() => K.group !== "in" && switchKind("sale")}>收入</button>
            <button aria-pressed={K.group === "out"} onClick={() => K.group !== "out" && switchKind("expD")}>支出</button>
        </div>
        <span style={{flex: 1}}/>
    </>;
    const actions = editing ? <button className="icon-btn" aria-label="刪除這筆" style={{color: "var(--clay)"}} onClick={() => onDelete(kind, rec)}><Icon n="trash"/></button> : null;
    const keyLabel = active === "amount" ? "金額" + (K.group === "in" ? "" : "（可加減）") : active === "q" ? "斤數" : "每斤單價";
    const keypad = (
        <div className="keypad">
            <div className="kp-cap"><span>正在輸入：{keyLabel}</span>{active === "amount" ? <span>可以打 1200+800</span> : null}</div>
            {["1", "2", "3"].map((k) => <button key={k} className="k" onClick={() => press(k)}>{k}</button>)}
            <button className="k op" aria-label="刪除" onClick={() => press("del")}><Icon n="backspace" s={22}/></button>
            {["4", "5", "6"].map((k) => <button key={k} className="k" onClick={() => press(k)}>{k}</button>)}
            <button className="k op" disabled={active !== "amount"} onClick={() => press("+")}>＋</button>
            {["7", "8", "9"].map((k) => <button key={k} className="k" onClick={() => press(k)}>{k}</button>)}
            <button className="k op" disabled={active !== "amount"} onClick={() => press("-")}>－</button>
            <button className="k op" disabled={active === "amount"} onClick={() => press(".")}>.</button>
            <button className="k" onClick={() => press("0")}>0</button>
            <button className="k" onClick={() => press("00")}>00</button>
            <button className="k ok" onClick={save}>{editing ? "儲存" : "記下"}</button>
        </div>
    );
    const body = <>
        {ask ? <Ask text="還沒存，要放棄這一筆嗎？" keep="繼續記" onKeep={() => setAsk(false)} onDiscard={() => { setAsk(false); onClose(); }}/> : null}
        {!editing ? <div className="kinds">{Object.entries(KIND).filter(([, v]) => v.group === K.group).map(([k, v]) => (
            <button key={k} className={"kind " + v.tone} aria-pressed={kind === k} onClick={() => switchKind(k)}><Icon n={v.icon} s={16}/>{v.label}</button>))}</div> : null}
        <button className="amount-display" aria-pressed={active === "amount"} onClick={() => setActive("amount")}>
            <span className="ad-top"><span>{K.label}金額</span>{hasCalc ? <span className={"ad-tag" + (manual ? " man" : "")}>{manual ? "手動" : "自動計算"}</span> : null}</span>
            <span className={"ad-val num " + K.group}><span className="cur">NT$</span>{showAmount}{active === "amount" ? <i className="caret" style={{height: 30, verticalAlign: -4}}/> : null}</span>
            <span className="ad-sub">{sub}</span>
        </button>
        {err ? <div className="err" role="alert"><Icon n="alert" s={16}/>{err}</div> : null}
        {ctx}
        <div className="meta">
            <label className="mchip"><Icon n="calendar" s={16}/>{dateLabel}
                <input type="date" value={f.date} onChange={(e) => e.target.value && put({date: e.target.value})} aria-label="日期"/></label>
        </div>
        {keyboard && wide ? <div className="kbd-hint"><kbd>0–9</kbd> 輸入　<kbd>Enter</kbd> {editing ? "儲存" : "記下"}　<kbd>Esc</kbd> {panel ? (editing ? "回到記一筆" : "清空") : "關閉"}
            {panel ? <>　<kbd>N</kbd> 新的一筆</> : null}</div> : null}
    </>;
    const q = pq.trim().toLowerCase();
    const pickList = db.customers.filter((c) => !q || (c.name + (c.phone || "")).toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    const picker = pick ? (
        <Sheet title="選擇客戶" closing={pick.closing} z={level + 1} drag={!wide} onRequestClose={closePick}>
            <div className="search"><Icon n="search" s={18}/><input placeholder="輸入姓名或電話搜尋…" value={pq} onChange={(e) => setPq(e.target.value)} aria-label="搜尋客戶"/></div>
            <div>
                <button className="pickrow none" onClick={() => { chooseCustomer(null); closePick(); }}>
                    <span className="av" style={{background: "var(--sunken)"}}><Icon n="user" s={18}/></span><span className="grow">未指定客戶</span>{!f.customerId ? <Icon n="check"/> : null}</button>
                {pickList.map((c) => (
                    <button key={c.id} className="pickrow" onClick={() => { chooseCustomer(c); closePick(); }}>
                        <span className={"av " + avTone(c.name)}>{initial(c.name)}</span><span className="grow">{c.name}<span className="p num">{c.phone}</span></span>
                        {f.customerId === c.id ? <Icon n="check"/> : null}</button>
                ))}
                {pickList.length === 0 ? <div className="empty">{db.customers.length ? `找不到「${pq}」` : "還沒有客戶，可以到「客戶」分頁新增"}</div> : null}
            </div>
        </Sheet>
    ) : null;
    if (panel) return <><Panel title={editing ? "編輯" + K.label : "記一筆"} head={head} actions={actions} onClose={editing ? requestClose : null} bottom={keypad}>{body}</Panel>{picker}</>;
    return <><Sheet title={editing ? "編輯" + K.label : "記一筆"} head={head} actions={actions} closing={sheet.closing} z={level} tall drag={!wide} onRequestClose={requestClose} bottom={keypad}>{body}</Sheet>{picker}</>;
}
