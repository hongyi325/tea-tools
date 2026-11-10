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
function CustomerList({db, q, setQ, sort, setSort, onOpen, selected, onAdd}) {
    const year = String(nowYM().y);
    const info = (c) => {
        const ss = db.sales.filter((s) => s.customerId === c.id);
        return {last: ss.reduce((a, s) => (s.date > a ? s.date : a), ""), year: sum(ss.filter((s) => yrOf(s.date) === year)), due: sum(ss.filter((s) => !s.paid))};
    };
    const qq = q.trim().toLowerCase();
    let list = db.customers.filter((c) => !qq || (c.name + (c.phone || "") + (c.address || "")).toLowerCase().includes(qq)).map((c) => ({c, ...info(c)}));
    const byName = (a, b) => a.c.name.localeCompare(b.c.name, "zh-Hant");
    list.sort(sort === "recent" ? (a, b) => b.last.localeCompare(a.last) || byName(a, b)
        : sort === "amount" ? (a, b) => b.year - a.year || byName(a, b)
            : sort === "name" ? byName : (a, b) => b.due - a.due || byName(a, b));
    if (sort === "due") list = list.filter((x) => x.due > 0);
    return <>
        <div className="head"><h1>客戶</h1><button className="icon-btn filled" aria-label="新增客戶" onClick={onAdd}><Icon n="plus"/></button></div>
        <div className="search"><Icon n="search" s={18}/><input placeholder="搜尋姓名、電話或地址…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜尋客戶"/></div>
        <div className="filters">{[["recent", "最近買過"], ["amount", "今年買最多"], ["due", "有未收款"], ["name", "依姓名"]].map(([v, n]) => (
            <button key={v} className="fchip" aria-pressed={sort === v} onClick={() => setSort(v)}>{n}</button>))}</div>
        {list.length === 0 ? (
            <div className="empty"><Icon n="users" s={30}/>{q ? `找不到「${q}」` : sort === "due" && db.customers.length ? "沒有人欠款" : "還沒有客戶，按右上角的 ＋ 新增"}</div>
        ) : (
            <div className="rows">{list.map(({c, last, year: y, due}) => (
                <div className="rw" key={c.id}><div>
                    <div className="row" aria-current={selected === c.id ? "true" : undefined} role="button" tabIndex={0} onClick={() => onOpen(c)} onKeyDown={(e) => e.key === "Enter" && onOpen(c)}>
                        <span className={"av " + avTone(c.name)}>{initial(c.name)}</span>
                        <span className="mid"><div className="t1">{c.name}</div><div className="t2 num">{last ? `最近買 ${md(last)}` : c.phone || "還沒買過"}</div></span>
                        <span className="end"><span className="num" style={{fontWeight: 600, fontSize: 15}}><span className="t2" style={{fontWeight: 400, marginRight: 4}}>今年</span><span className="mv">{money(y)}</span></span>
                            {due > 0 ? <span className="due" style={{pointerEvents: "none"}}>未收 <span className="mv num">{money(due)}</span></span> : null}</span>
                    </div>
                </div></div>
            ))}</div>
        )}
    </>;
}

export function Customers(props) {
    if (props.size === "phone") return <CustomerList {...props}/>;
    return <div className="split"><section className="col list"><CustomerList {...props}/></section><aside className="col right">{props.detail}</aside></div>;
}
