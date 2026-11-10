import {useEffect, useRef, useState} from "react";
import {FINE, Icon, useMedia} from "./ui.jsx";
import {mOf, today, wd} from "./lib.js";

// 一心二葉：一芽兩葉的茶枝，柔和漸層，慢慢擺動；旁邊幾點光點往上飄（光暈在卡片背景）
function Sprig() {
    const stop = (c, o) => <stop offset={o} style={{stopColor: `var(${c})`}}/>;
    return (
        <svg className="lg-sprig" viewBox="0 0 400 540" aria-hidden="true">
            <defs>
                <linearGradient id="lg-leaf1" x1="1" y1="1" x2="0" y2="0">{stop("--leaf-lo", 0)}{stop("--leaf-hi", 1)}</linearGradient>
                <linearGradient id="lg-leaf2" x1="0" y1="1" x2="1" y2="0">{stop("--leaf-lo", 0)}{stop("--leaf-hi", 1)}</linearGradient>
                <linearGradient id="lg-bud" x1="0" y1="1" x2="0.3" y2="0">{stop("--bud-lo", 0)}{stop("--bud-hi", 1)}</linearGradient>
            </defs>
            <g className="sway">
                <path className="stem" d="M214 560 C206 480 216 410 206 336 C198 276 206 214 199 154"/>
                <path d="M206 346 C252 298 308 268 370 266 C340 326 274 364 206 346 Z" fill="url(#lg-leaf2)"/>
                <path className="rib" d="M212 340 C262 314 312 290 358 272"/>
                <path d="M202 252 C158 262 102 230 66 156 C130 152 184 194 202 252 Z" fill="url(#lg-leaf1)"/>
                <path className="rib" d="M198 246 C158 220 116 192 80 164"/>
                <path d="M199 156 C186 116 192 72 218 34 C230 78 223 122 199 156 Z" fill="url(#lg-bud)"/>
            </g>
            {[[262, 120, 2.6, 0], [318, 214, 2.2, 1.8], [150, 120, 2, 3.4], [292, 380, 2.4, 5]].map(([cx, cy, r, d]) => (
                <circle key={cx} className="mote" cx={cx} cy={cy} r={r} style={{animationDelay: `${d}s`}}/>))}
        </svg>
    );
}

/* 登入：輸入 4 碼密碼，打滿自動送出。
   手機＝全螢幕數字鍵盤；平板＝上方茶園意象、下方放大鍵盤；電腦＝左邊茶園意象、右邊輸入，可以全程用鍵盤。
   onAuth(mode, pin) 成功回傳 null（畫面會由登入狀態切走），失敗回傳錯誤訊息。 */
export default function Login({size, onAuth}) {
    const wide = size !== "phone", fine = useMedia(FINE);
    const [pin, setPin] = useState(""), [mode, setMode] = useState("login"), [phase, setPhase] = useState("idle"), [err, setErr] = useState(""), [hit, setHit] = useState(null);
    const cur = useRef();
    cur.current = {pin, phase, mode, onAuth};
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);
    const submit = async (p) => {
        setPhase("busy");
        const msg = await cur.current.onAuth(cur.current.mode, p);
        if (!alive.current || !msg) return;
        setErr(msg);
        setPhase("err");
        setTimeout(() => { if (alive.current) setPin(""); }, 420);
    };
    const press = (d) => {
        const {pin: p, phase: ph} = cur.current;
        if (ph === "busy" || p.length >= 4) return;
        const n = p + d;
        setPin(n);
        if (ph === "err") { setPhase("idle"); setErr(""); }
        if (n.length === 4) submit(n);
    };
    const back = () => {
        if (cur.current.phase === "busy") return;
        setPin((p) => p.slice(0, -1));
    };
    const flash = (k) => {
        setHit(k);
        setTimeout(() => setHit((h) => (h === k ? null : h)), 140);
    };
    useEffect(() => {
        const h = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (/^[0-9]$/.test(e.key)) { press(e.key); flash(e.key); }
            else if (e.key === "Backspace") { back(); flash("del"); }
            else if (e.key === "Escape" && cur.current.phase !== "busy") setPin("");
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const switchMode = () => {
        if (phase === "busy") return;
        setMode(mode === "login" ? "signup" : "login");
        setPin("");
        setErr("");
        setPhase("idle");
    };
    const title = mode === "login" ? "輸入 4 碼密碼" : "設定 4 碼密碼";
    const pad = (
        <div className="pad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} className={"pk" + (hit === d ? " hit" : "")} onClick={() => press(d)}>{d}</button>)}
            <span/>
            <button className={"pk" + (hit === "0" ? " hit" : "")} onClick={() => press("0")}>0</button>
            <button className="pk ghost" aria-label="刪除一碼" onClick={back}><Icon n="backspace" s={24}/></button>
        </div>
    );
    const link = <button className="linkb" onClick={switchMode}>{mode === "login" ? "第一次使用？設定密碼" : "已設定過？前往登入"}</button>;
    if (!wide) {
        const sub = phase === "busy" ? (mode === "login" ? "登入中…" : "設定中…") : err || (mode === "login" ? "輸入 4 碼密碼" : "第一次使用，設定 4 碼密碼");
        return (
            <div className="login"><div className="login-card"><span className="seal lg">茶</span><h2>茶葉記帳</h2>
                <p className={"sub" + (err ? " bad" : "")} role={err ? "alert" : undefined} aria-live="polite">{sub}</p>
                <div className={"dots" + (phase === "err" ? " bad" : "")} role="img" aria-label={`已輸入 ${pin.length} 碼`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < pin.length ? "on" : ""}/>)}</div>
                {pad}{link}
            </div></div>
        );
    }
    const status = phase === "busy" ? <span className="lg-status busy"><Icon n="refresh" s={15}/>{mode === "login" ? "登入中…" : "設定中…"}</span>
        : err ? <span className="lg-status err" role="alert"><Icon n="alert" s={16}/>{err}</span>
            : <span className="lg-status">{fine ? <>直接用鍵盤輸入，打滿 4 碼自動登入 · <kbd>Backspace</kbd> 刪除</> : "打滿 4 碼自動登入"}</span>;
    const t = today();
    const date = `${mOf(t)} 月 ${parseInt(t.slice(8, 10), 10)} 日 星期${wd(t)}`;
    return (
        <div className={"login " + size}>
            <section className="lg-brand">
                <div className="lg-mark"><span className="seal lg">茶</span><b>茶葉記帳</b></div>
                <div className="lg-copy">
                    <h2>茶園到茶廠，<br/>一本帳記清楚</h2>
                    <p>銷售、收款、支出和庫存都在這裡。<br/>手機、平板、電腦看到的是同一本帳。</p>
                </div>
                <span className="lg-date">{date}</span>
                <Sprig/>
            </section>
            <section className="lg-form">
                <div className="lg-head"><p className="lg-kicker">{mode === "login" ? "歡迎回來" : "第一次使用"}</p><h2>{title}</h2></div>
                <div className={"pins" + (phase === "err" ? " bad" : phase === "busy" ? " busy" : "")} role="img" aria-label={`已輸入 ${pin.length} 碼`}>
                    {[0, 1, 2, 3].map((i) => <i key={i} className={(i < pin.length ? "on" : "") + (i === pin.length && phase !== "busy" ? " cur" : "")}/>)}</div>
                {status}{pad}{link}
            </section>
        </div>
    );
}
