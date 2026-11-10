import {useLayoutEffect, useRef, useState} from "react";
import {Icon, M, PeriodNav} from "./ui.jsx";
import {catIcon, inPeriod, jin, KIND, mOf, money, pShort, sum, yrOf} from "./lib.js";

function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const axisFmt = (v) => (v === 0 ? "0" : v >= 10000 ? `${+(v / 10000).toFixed(1)}萬` : `${+(v / 1000).toFixed(1)}千`);

// 每月收支長條圖（收入／支出兩條並排）
function Trend({months, height = 190}) {
    const wrap = useRef(null), [w, setW] = useState(320), [act, setAct] = useState(null);
    useLayoutEffect(() => {
        const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
        ro.observe(wrap.current);
        return () => ro.disconnect();
    }, []);
    const H = height, L = 34, R = 4, T = 16, B = 22, ph = H - T - B, pw = w - L - R;
    const max = Math.max(1, ...months.map((m) => Math.max(m.inc, m.exp))), step = niceStep(max / 3), top = Math.ceil(max / step) * step;
    const y = (v) => T + ph - (v / top) * ph, col = pw / 12, bw = Math.max(3, Math.min(16, (col - 8) / 2)), gap = 2;
    const ticks = [];
    for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
    const bar = (x, v) => {
        const yy = y(v), h = T + ph - yy;
        if (h <= 0.5) return "";
        const r = Math.min(4, h, bw / 2);
        return `M${x},${T + ph}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${T + ph}Z`;
    };
    const peak = months.reduce((b, m, i) => (m.inc > months[b].inc ? i : b), 0), a = act !== null ? months[act] : null;
    return (
        <div className="chart-wrap" ref={wrap} onPointerLeave={() => setAct(null)}>
            <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label="各月收入與支出長條圖；各月數字見各月明細">
                {ticks.map((v) => <g key={v}><line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="var(--grid)"/>
                    <text className="axis" x={L - 5} y={y(v) + 4} textAnchor="end">{axisFmt(v)}</text></g>)}
                {months.map((m, i) => {
                    const x0 = L + i * col + (col - (bw * 2 + gap)) / 2;
                    return (
                        <g key={i} opacity={act !== null && act !== i ? 0.45 : 1}>
                            <path d={bar(x0, m.inc)} fill="var(--chart-in)"/><path d={bar(x0 + bw + gap, m.exp)} fill="var(--chart-out)"/>
                            <text className="axis" x={L + i * col + col / 2} y={H - 5} textAnchor="middle">{i + 1}{w > 560 ? "月" : ""}</text>
                            {i === peak && m.inc > 0 && act === null ? <text className="peak mv" x={x0 + bw / 2} y={y(m.inc) - 5} textAnchor="middle">{axisFmt(m.inc)}</text> : null}
                            <rect x={L + i * col} y={T} width={col} height={ph + B} fill="transparent" onPointerEnter={() => setAct(i)} onClick={() => setAct(i)}/>
                        </g>
                    );
                })}
            </svg>
            {a ? <div className="tip num" style={{left: Math.min(w - 76, Math.max(76, L + act * col + col / 2))}}><b>{act + 1} 月</b>
                <div><span>收入</span><span className="mv">{money(a.inc)}</span></div>
                <div><span>支出</span><span className="mv">{money(a.exp)}</span></div>
                <div><span>結餘</span><span className="mv">{money(a.inc - a.exp)}</span></div></div> : null}
        </div>
    );
}

function Rank({rows, out, empty}) {
    const max = Math.max(1, ...rows.map((r) => r.v));
    return rows.length ? (
        <div className={"rank" + (out ? " out" : "")}>{rows.map((r) => (
            <div className="rk" key={r.key || r.n}>
                <span className={"ic " + r.tone}><Icon n={r.icon} s={17}/></span>
                <span className="n">{r.n}{r.note ? <small className="num">{r.note}</small> : null}</span>
                <span className="v"><M v={r.v}/></span>
                <span className="bar"><i style={{width: (r.v / max) * 100 + "%"}}/></span>
            </div>))}</div>
    ) : <div className="hint">{empty}</div>;
}

/* ---------- 報表 ---------- */
export default function Stats({db, p, setP, masked, setMasked, size}) {
    const [open, setOpen] = useState(null);
    const f = (r) => inPeriod(r.date, p);
    const S = db.sales.filter(f), FI = db.expP.filter(f), FO = db.expD.filter(f), GO = db.expG.filter(f);
    const inc = sum(S) + sum(FI), exp = sum(FO) + sum(GO), net = inc - exp, total = inc || 1;
    const sources = [
        {n: "茶園銷售", v: sum(S), tone: "tea", icon: "leaf", note: `${Math.round((sum(S) / total) * 100)}%`},
        {n: "茶廠收入", v: sum(FI), tone: "celadon", icon: "factory", note: `${Math.round((sum(FI) / total) * 100)}%`},
    ].filter((x) => x.v > 0);
    const cat = new Map();
    [...FO.map((r) => ["expD", r]), ...GO.map((r) => ["expG", r])].forEach(([k, r]) => {
        const key = k + "|" + r.item;
        const c = cat.get(key) || {key, n: r.item, v: 0, tone: KIND[k].tone, icon: catIcon(r.item, k), note: k === "expD" ? "茶廠" : "茶園"};
        c.v += Number(r.amount) || 0;
        cat.set(key, c);
    });
    const cats = [...cat.values()].sort((a, b) => b.v - a.v).slice(0, 6);
    const tea = new Map();
    S.forEach((s) => {
        const c = tea.get(s.itemName) || {n: s.itemName, v: 0, q: 0, tone: "tea", icon: "leaf"};
        c.v += Number(s.amount) || 0;
        c.q += Number(s.qty) || 0;
        tea.set(s.itemName, c);
    });
    const teas = [...tea.values()].sort((a, b) => b.v - a.v).map((t) => ({...t, note: jin(t.q)}));
    const cu = new Map();
    S.forEach((s) => {
        const k = s.customerName || "未指定客戶";
        const c = cu.get(k) || {n: k, v: 0, cnt: 0, tone: "tea", icon: "user"};
        c.v += Number(s.amount) || 0;
        c.cnt++;
        cu.set(k, c);
    });
    const custs = [...cu.values()].sort((a, b) => b.v - a.v).slice(0, 5).map((c) => ({...c, note: `${c.cnt} 筆`}));
    const months = p.mode === "year" ? Array.from({length: 12}, (_, i) => {
        const g = (r) => yrOf(r.date) === String(p.y) && mOf(r.date) === i + 1;
        const s = sum(db.sales.filter(g)), fi = sum(db.expP.filter(g)), fo = sum(db.expD.filter(g)), go = sum(db.expG.filter(g));
        return {s, fi, fo, go, inc: s + fi, exp: fo + go};
    }) : null;
    const wide = size !== "phone";
    const unpaid = sum(S.filter((s) => !s.paid));
    const cards = [
        <section className="card" key="net"><h3>{pShort(p)}淨利<small>收入 − 支出</small></h3>
            <div className="num" style={{fontSize: 34, fontWeight: 600, lineHeight: 1.1, color: net < 0 ? "var(--clay)" : "var(--ink)"}}><M v={net} sign/></div>
            <div className="duo" style={{marginTop: 12}}>
                <div><h4>茶園</h4><dl className="num"><dt>營收</dt><dd><M v={sum(S)}/></dd><dt>支出</dt><dd><M v={sum(GO)}/></dd><dt>淨利</dt><dd><M v={sum(S) - sum(GO)} sign/></dd></dl></div>
                <div><h4>茶廠</h4><dl className="num"><dt>收入</dt><dd><M v={sum(FI)}/></dd><dt>支出</dt><dd><M v={sum(FO)}/></dd><dt>淨利</dt><dd><M v={sum(FI) - sum(FO)} sign/></dd></dl></div>
            </div>
        </section>,
        months ? <section className="card span2" key="trend"><h3>每月收支</h3>
            <div className="legend"><span><i style={{background: "var(--chart-in)"}}/>收入</span><span><i style={{background: "var(--chart-out)"}}/>支出</span></div>
            <Trend months={months} height={wide ? 230 : 190}/></section> : null,
        <section className="card" key="src"><h3>收入來源<small className="mv num">{money(inc)}</small></h3><Rank rows={sources} empty="這段期間沒有收入"/></section>,
        <section className="card" key="cat"><h3>錢花在哪<small className="mv num">{money(exp)}</small></h3><Rank rows={cats} out empty="這段期間沒有支出"/></section>,
        <section className="card" key="tea"><h3>哪種茶賣最好<small className="num">{S.length} 筆 · {jin(sum(S, "qty"))}{unpaid ? <> · 未收 <span className="mv">{money(unpaid)}</span></> : null}</small></h3>
            <Rank rows={teas} empty="這段期間沒有賣茶"/></section>,
        <section className="card" key="cust"><h3>熟客排行</h3><Rank rows={custs} empty="這段期間沒有客戶紀錄"/></section>,
        months ? <section className="card span2" key="months"><h3>各月明細<small>點月份展開</small></h3>
            {months.map((m, i) => (m.inc || m.exp) ? (
                <div key={i}>
                    <button className="mrow" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                        <b>{i + 1} 月</b><span className="sub num">收 <span className="mv">{money(m.inc)}</span> · 支 <span className="mv">{money(m.exp)}</span></span>
                        <span className="num" style={{fontWeight: 600, color: m.inc - m.exp < 0 ? "var(--clay)" : "var(--tea)"}}><M v={m.inc - m.exp} sign/></span>
                        <Icon n={open === i ? "chevDown" : "chevRight"} s={16}/>
                    </button>
                    {open === i ? <div className="mdet num">
                        <span>茶園營收<b className="mv">{money(m.s)}</b></span><span>茶園支出<b className="mv">{money(m.go)}</b></span>
                        <span>茶廠收入<b className="mv">{money(m.fi)}</b></span><span>茶廠支出<b className="mv">{money(m.fo)}</b></span></div> : null}
                </div>
            ) : null)}
            <div className="mrow" style={{fontWeight: 700}}><b>合計</b><span/>
                <span className="num" style={{color: net < 0 ? "var(--clay)" : "var(--tea)"}}><M v={net} sign/></span><span/></div>
        </section> : null,
    ].filter(Boolean);
    if (!wide) return <>
        <div className="head"><h1>報表</h1>
            <button className="icon-btn" aria-label={masked ? "顯示金額" : "隱藏金額"} onClick={() => setMasked(!masked)}><Icon n={masked ? "eyeOff" : "eye"}/></button></div>
        <PeriodNav p={p} setP={setP} light/>{cards}
    </>;
    return <><div className="page-head"><h1>報表</h1><PeriodNav p={p} setP={setP} light/></div><div className={"cards " + size}>{cards}</div></>;
}
