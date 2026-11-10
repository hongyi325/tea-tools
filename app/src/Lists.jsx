import {useRef, useState} from "react";
import {Icon} from "./ui.jsx";
import {avTone, initial, jin, md, money, nf, nowYM, soldBy, stockState, sum, yrOf} from "./lib.js";

/* ---------- 庫存 ---------- */
function Cans({db, onOpen, onAdd, selected}) {
    const sold = soldBy(db.sales);
    return (
        <div className="cans">
            {db.items.map((it) => {
                const q = Number(it.qty || 0), r = q - (sold[it.id] || 0), [k, t] = stockState(r), pct = q > 0 ? Math.max(0, Math.min(100, (r / q) * 100)) : 0;
                return (
                    <button key={it.id} className="can" aria-current={selected === it.id ? "true" : undefined} onClick={() => onOpen(it)}>
                        <span><span className="nm">{it.name}</span><span className="rm num">{jin(r)}</span><span className="of num">共進 {jin(q)}</span></span>
                        <span className={"gauge " + k} role="img" aria-label={`剩 ${Math.round(pct)}%`}><i style={{height: pct + "%"}}/></span>
                        <span className={"state " + k}>{t}</span>
                    </button>
                );
            })}
            <button className="can addcan" onClick={onAdd}><Icon n="plus" s={26}/>新增茶種</button>
        </div>
    );
}

export function Stock({db, size, onOpen, onAdd, selected, detail}) {
    const sold = soldBy(db.sales), total = db.items.reduce((a, it) => a + Number(it.qty || 0) - (sold[it.id] || 0), 0);
    const sumLine = <div className="stock-sum"><span>總共剩</span><b className="num">{nf.format(Math.round(total * 100) / 100)}</b><span>斤 · {db.items.length} 種茶</span></div>;
    const hint = <div className="hint" style={{textAlign: "center"}}>剩 2 斤以下標為「偏低」；賣出會自動扣庫存</div>;
    if (size === "phone") return <>
        <div className="head"><h1>庫存</h1><button className="icon-btn filled" aria-label="新增茶種" onClick={onAdd}><Icon n="plus"/></button></div>
        {sumLine}<Cans db={db} onOpen={onOpen} onAdd={onAdd}/>{hint}
    </>;
    const main = <><div className="page-head"><h1>庫存</h1>{sumLine}</div><Cans db={db} onOpen={onOpen} onAdd={onAdd} selected={selected}/>{hint}</>;
    if (size === "desktop") return <div className="d-split"><section className="col">{main}</section><aside className="col right">{detail}</aside></div>;
    return main;
}

/* ---------- 客戶 ---------- */
// 手指往左滑露出「刪除」，滑超過一半直接刪（和 iPhone 內建 App 一樣）；滑鼠不會觸發
const SWIPE_W = 84;
function SwipeRow({id, open, setOpen, onDelete, children}) {
    const ref = useRef(null), st = useRef(null), swallow = useRef(false);
    const [drag, setDrag] = useState(null);
    const base = open === id ? -SWIPE_W : 0, x = drag ?? base;
    const down = (e) => {
        if (e.pointerType === "mouse" || e.button > 0) return;
        st.current = {x0: e.clientX, y0: e.clientY, base, on: false, x: base, w: ref.current ? ref.current.offsetWidth : 360};
    };
    const move = (e) => {
        const s = st.current;
        if (!s) return;
        const mx = e.clientX - s.x0, my = e.clientY - s.y0;
        if (!s.on) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { st.current = null; return; }
            if (Math.abs(mx) < 10) return;
            s.on = true;
            if (open !== id) setOpen(null);
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 不支援就算了 */ }
        }
        let nx = s.base + mx;
        if (nx > 0) nx = nx / 4;
        s.x = Math.max(-s.w, nx);
        setDrag(s.x);
    };
    const up = () => {
        const s = st.current;
        st.current = null;
        if (!s || !s.on) return;
        swallow.current = true;
        setTimeout(() => { swallow.current = false; }, 80);
        if (s.x < -s.w * 0.55) {
            setDrag(-s.w);
            setTimeout(() => { setDrag(null); setOpen(null); onDelete(); }, 200);
            return;
        }
        setDrag(null);
        setOpen(s.x < -SWIPE_W / 2 ? id : null);
    };
    const click = (e) => {
        if (swallow.current || open === id) {
            e.stopPropagation();
            e.preventDefault();
            if (open === id && !swallow.current) setOpen(null);
        }
    };
    return (
        <div className="swipe" ref={ref}>
            <button className="swipe-del" style={{width: Math.max(SWIPE_W, -x), visibility: x < 0 ? "visible" : "hidden"}} tabIndex={open === id ? 0 : -1} aria-hidden={x === 0}
                    onClick={() => { setOpen(null); onDelete(); }}><Icon n="trash" s={20}/>刪除</button>
            <div className={"swipe-front" + (drag !== null ? " dragging" : "")} style={{transform: x ? `translateX(${x}px)` : undefined}}
                 onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={click}>{children}</div>
        </div>
    );
}

function CustomerList({db, q, setQ, sort, setSort, onOpen, selected, onAdd, onDelete, removing = []}) {
    const [open, setOpen] = useState(null);
    const year = String(nowYM().y);
    const info = (c) => {
        const ss = db.sales.filter((s) => s.customerId === c.id);
        return {last: ss.reduce((a, s) => (s.date > a ? s.date : a), ""), year: sum(ss.filter((s) => yrOf(s.date) === year)), due: sum(ss.filter((s) => !s.paid))};
    };
    const qq = q.trim().toLowerCase();
    let list = db.customers.filter((c) => !qq || (c.name + (c.phone || "") + (c.address || "")).toLowerCase().includes(qq)).map((c) => ({c, ...info(c)}));
    const byName = (a, b) => a.c.name.localeCompare(b.c.name, "zh-Hant");
    list.sort(sort === "due" ? (a, b) => b.due - a.due || byName(a, b) : byName);
    if (sort === "due") list = list.filter((x) => x.due > 0);
    return <>
        <div className="head"><h1>客戶</h1><button className="icon-btn filled" aria-label="新增客戶" onClick={onAdd}><Icon n="plus"/></button></div>
        <div className="search"><Icon n="search" s={18}/><input placeholder="搜尋姓名、電話或地址…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜尋客戶"/></div>
        <div className="filters">{[["name", "依姓名"], ["due", "未收款"]].map(([v, n]) => (
            <button key={v} className="fchip" aria-pressed={sort === v} onClick={() => setSort(v)}>{n}</button>))}</div>
        {list.length === 0 ? (
            <div className="empty"><Icon n="users" s={30}/>{q ? `找不到「${q}」` : sort === "due" && db.customers.length ? "沒有人欠款" : "還沒有客戶，按右上角的 ＋ 新增"}</div>
        ) : (
            <div className="rows">{list.map(({c, last, year: y, due}) => {
                const row = (
                    <div className="row" aria-current={selected === c.id ? "true" : undefined} role="button" tabIndex={0} onClick={() => onOpen(c)} onKeyDown={(e) => e.key === "Enter" && onOpen(c)}>
                        <span className={"av " + avTone(c.name)}>{initial(c.name)}</span>
                        <span className="mid"><div className="t1">{c.name}</div><div className="t2 num">{last ? `最近買 ${md(last)}` : c.phone || "還沒買過"}</div></span>
                        <span className="end"><span className="num" style={{fontWeight: 600, fontSize: 15}}><span className="t2" style={{fontWeight: 400, marginRight: 4}}>今年</span><span className="mv">{money(y)}</span></span>
                            {due > 0 ? <span className="due" style={{pointerEvents: "none"}}>未收 <span className="mv num">{money(due)}</span></span> : null}</span>
                    </div>
                );
                return (
                    <div className={"rw" + (removing.includes(c.id) ? " removing" : "")} key={c.id}>
                        {onDelete ? <SwipeRow id={c.id} open={open} setOpen={setOpen} onDelete={() => onDelete(c)}>{row}</SwipeRow> : <div>{row}</div>}
                    </div>
                );
            })}</div>
        )}
    </>;
}

export function Customers(props) {
    if (props.size === "phone") return <CustomerList {...props}/>;
    return <div className="split"><section className="col list"><CustomerList {...props}/></section><aside className="col right">{props.detail}</aside></div>;
}
