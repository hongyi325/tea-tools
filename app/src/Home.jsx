import {useMemo, useState} from "react";
import {Icon, M, PeriodNav} from "./ui.jsx";
import {compact, dayLabel, inPeriod, ledger, md, mOf, nowYM, pShort, today, yrOf} from "./lib.js";

function LedgerRows({entries, onOpen, onPaid, flash, removing, selected}) {
    return (
        <div className="rows">{entries.map((e) => (
            <div key={e.id} className={"rw" + (removing.includes(e.id) ? " removing" : "")}>
                <div>
                    <div className={"row" + (flash === e.id ? " flash" : "")} aria-current={selected === e.id ? "true" : undefined} role="button" tabIndex={0}
                         onClick={() => onOpen(e)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); onOpen(e); } }}>
                        <span className={"ic " + e.tone}><Icon n={e.icon}/></span>
                        <span className="mid"><div className="t1">{e.title}</div><div className="t2">{e.sub}</div></span>
                        <span className="end"><span className={"amt " + (e.v >= 0 ? "in" : "out")}><M v={e.v} sign/></span>
                            {e.unpaid ? <button className="due" aria-label="未收款，點一下標記為已收" onClick={(ev) => { ev.stopPropagation(); onPaid(e.r); }}>
                                <Icon n="circle" s={11} w={2.6}/>未收</button> : null}</span>
                    </div>
                </div>
            </div>
        ))}</div>
    );
}

function useHome(db, p, filter, sel, q) {
    const L = useMemo(() => ledger(db), [db]);
    const inP = L.filter((e) => inPeriod(e.date, p));
    const income = inP.filter((e) => e.v > 0).reduce((a, e) => a + e.v, 0), expense = -inP.filter((e) => e.v < 0).reduce((a, e) => a + e.v, 0);
    const due = L.filter((e) => e.unpaid);
    let list = filter === "unpaid" ? due : inP.filter((e) => filter === "all" || (filter === "in" ? e.v > 0 : e.v < 0));
    if (sel && filter !== "unpaid") list = list.filter((e) => e.date === sel);
    const qq = (q || "").trim().toLowerCase();
    if (qq) list = list.filter((e) => (e.title + e.sub).toLowerCase().includes(qq));
    const days = [];
    list.forEach((e) => {
        const d = days[days.length - 1];
        if (d && d.date === e.date) d.items.push(e); else days.push({date: e.date, items: [e]});
    });
    return {L, income, expense, due, days};
}

function Hero({p, setP, income, expense}) {
    const ratio = income > 0 ? Math.min(100, (expense / income) * 100) : expense > 0 ? 100 : 0;
    return (
        <section className="hero"><span className="wm"><Icon n="leaf" s={150} w={1}/></span>
            <PeriodNav p={p} setP={setP}/>
            <div><span className="cap">{pShort(p)}結餘</span><span className="big"><M v={income - expense} sign/></span></div>
            <div className="ratio" role="img" aria-label={`支出佔收入 ${Math.round(ratio)}%`}><i style={{width: ratio + "%"}}/></div>
            <div className="io">
                <span><span className="io-l"><Icon n="down" s={14}/>收入</span><b><M v={income}/></b></span>
                <span><span className="io-l"><Icon n="up" s={14}/>支出</span><b><M v={expense}/></b></span>
            </div>
        </section>
    );
}

function Remind({due, filter, setFilter}) {
    if (!due.length) return null;
    const names = [...new Set(due.map((e) => e.title))];
    return (
        <button className="remind" aria-pressed={filter === "unpaid"} onClick={() => setFilter(filter === "unpaid" ? "all" : "unpaid")}>
            <Icon n="alert" s={22}/>
            <span className="t"><b>{due.length} 筆還沒收款</b><small>{names.slice(0, 3).join("、")}{names.length > 3 ? ` 等 ${names.length} 人` : ""}</small></span>
            <span className="v"><M v={due.reduce((a, e) => a + e.v, 0)}/></span>
        </button>
    );
}

function Filters({filter, setFilter}) {
    return (
        <div className="filters">{[["all", "全部"], ["in", "收入"], ["out", "支出"], ["unpaid", "未收款"]].map(([v, n]) => (
            <button key={v} className="fchip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{n}</button>))}</div>
    );
}

function Feed({days, filter, sel, onOpen, onPaid, flash, removing, selected, q, empty}) {
    return <>
        {filter === "unpaid" ? <div className="day-head"><span>所有未收款（不分月份）</span></div> : null}
        {days.length === 0 ? (
            <div className="empty"><Icon n="note" s={30}/>{q ? `找不到「${q}」` : filter === "unpaid" ? "全部都收齊了" : sel ? "這天沒有紀錄" : empty ? "還沒有任何紀錄，按「記一筆」開始" : "這段期間還沒有紀錄"}</div>
        ) : days.map((d) => {
            const inc = d.items.filter((e) => e.v > 0).reduce((a, e) => a + e.v, 0), exp = -d.items.filter((e) => e.v < 0).reduce((a, e) => a + e.v, 0);
            return (
                <div className="day" key={d.date}>
                    <div className="day-head"><span>{dayLabel(d.date)}</span>
                        <span className="num">{inc ? <>收 <M v={inc}/></> : null}{inc && exp ? "　" : ""}{exp ? <>支 <M v={exp}/></> : null}</span></div>
                    <LedgerRows entries={d.items} onOpen={onOpen} onPaid={onPaid} flash={flash} removing={removing} selected={selected}/>
                </div>
            );
        })}
    </>;
}

function Calendar({L, p, setP, sel, setSel, compact: small}) {
    const now = nowYM(), t = today();
    if (p.mode === "year") {
        return (
            <div className="cal"><div className="cal-months">{Array.from({length: 12}, (_, i) => {
                const net = L.filter((e) => yrOf(e.date) === String(p.y) && mOf(e.date) === i + 1).reduce((a, e) => a + e.v, 0);
                const future = p.y === now.y && i + 1 > now.m;
                return (
                    <button key={i} className="cm" disabled={future} style={future ? {opacity: .4} : null} onClick={() => setP({...p, mode: "month", m: i + 1})}>
                        <b>{i + 1} 月</b><span className="mv num" style={{color: net >= 0 ? "var(--tea)" : "var(--clay)"}}>{net ? compact(net) : "－"}</span>
                    </button>
                );
            })}</div></div>
        );
    }
    const first = new Date(Date.UTC(p.y, p.m - 1, 1)).getUTCDay(), n = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate(), pad = (x) => String(x).padStart(2, "0"), cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= n; d++) cells.push(`${p.y}-${pad(p.m)}-${pad(d)}`);
    return (
        <div className={"cal" + (small ? " small" : "")}>
            <div className="cal-wd">{[..."日一二三四五六"].map((w) => <span key={w}>{w}</span>)}</div>
            <div className="cal-grid">{cells.map((d, i) => {
                if (!d) return <span key={"b" + i}/>;
                const es = L.filter((e) => e.date === d), net = es.reduce((a, e) => a + e.v, 0), due = es.some((e) => e.unpaid);
                const future = d > t && !es.length;
                return (
                    <button key={d} className={"cd" + (d === t ? " today" : "")} aria-pressed={sel === d} disabled={future} style={future ? {opacity: .35} : null}
                            aria-label={`${md(d)}${es.length ? `，${es.length} 筆` : "，沒有紀錄"}`} onClick={() => setSel(sel === d ? null : d)}>
                        <span className="d num">{parseInt(d.slice(8), 10)}</span>
                        {es.length ? <small className={"mv num " + (net >= 0 ? "in" : "out")}>{compact(net)}</small> : null}
                        {due ? <span className="dot"/> : null}
                    </button>
                );
            })}</div>
            {sel ? <button className="linkb cal-clear" onClick={() => setSel(null)}>顯示整個月</button> : null}
        </div>
    );
}

/* ---------- 明細（手機） ---------- */
export function HomePhone(props) {
    const {db, p, setP, view, setView, filter, setFilter, sel, setSel, masked, setMasked, openSettings, sync} = props;
    const h = useHome(db, p, filter, view === "calendar" && p.mode === "month" ? sel : null, "");
    return <>
        <div className="head">
            <span className="brand"><span className="seal">茶</span><b>茶葉記帳</b>
                {sync === "saving" ? <span className="sync saving"><Icon n="refresh" s={13}/>同步中</span> : sync === "error" ? <span className="sync error"><Icon n="cloudAlert" s={13}/>未同步</span> : null}</span>
            <button className="icon-btn" aria-label={masked ? "顯示金額" : "隱藏金額"} onClick={() => setMasked(!masked)}><Icon n={masked ? "eyeOff" : "eye"}/></button>
            <button className="icon-btn" aria-label="設定" onClick={openSettings}><Icon n="settings"/></button>
        </div>
        <Hero p={p} setP={(x) => { setP(x); setSel(null); }} income={h.income} expense={h.expense}/>
        <Remind due={h.due} filter={filter} setFilter={setFilter}/>
        <div className="toolbar">
            <span className="vseg" role="group" aria-label="檢視方式">
                <button aria-pressed={view === "list"} aria-label="列表" onClick={() => setView("list")}><Icon n="list" s={18}/></button>
                <button aria-pressed={view === "calendar"} aria-label="月曆" onClick={() => setView("calendar")}><Icon n="calendar" s={18}/></button>
            </span>
            <Filters filter={filter} setFilter={setFilter}/>
        </div>
        {view === "calendar" && filter !== "unpaid" ? <Calendar L={h.L} p={p} setP={setP} sel={sel} setSel={setSel}/> : null}
        <Feed days={h.days} filter={filter} sel={sel} onOpen={props.onOpen} onPaid={props.onPaid} flash={props.flash} removing={props.removing} empty={!h.L.length}/>
    </>;
}

/* ---------- 明細（平板兩欄／電腦三欄） ---------- */
export function HomeWide(props) {
    const {db, p, setP, filter, setFilter, sel, setSel, size, entryPanel, selected} = props;
    const [q, setQ] = useState("");
    const h = useHome(db, p, filter, sel, q);
    const left = <>
        <Hero p={p} setP={(x) => { setP(x); setSel(null); }} income={h.income} expense={h.expense}/>
        <Remind due={h.due} filter={filter} setFilter={setFilter}/>
        {filter !== "unpaid" ? <Calendar L={h.L} p={p} setP={setP} sel={sel} setSel={setSel} compact/> : null}
    </>;
    const mid = <>
        <div className="toolbar"><Filters filter={filter} setFilter={setFilter}/>
            <div className="search sm"><Icon n="search" s={16}/><input placeholder="搜尋客戶、茶種、事項…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜尋紀錄"/></div>
        </div>
        {sel && filter !== "unpaid" ? <div className="sel-banner">只看 {dayLabel(sel)}<button className="linkb" onClick={() => setSel(null)}>顯示整個月</button></div> : null}
        <Feed days={h.days} filter={filter} sel={sel} onOpen={props.onOpen} onPaid={props.onPaid} flash={props.flash} removing={props.removing} selected={selected} q={q} empty={!h.L.length}/>
    </>;
    if (size === "desktop") return <div className="d-home"><aside className="col">{left}</aside><section className="col mid">{mid}</section><aside className="col right">{entryPanel}</aside></div>;
    return <div className="t-home"><aside className="t-left">{left}</aside><section className="t-right">{mid}</section></div>;
}
