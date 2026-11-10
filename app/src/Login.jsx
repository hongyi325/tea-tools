import {useEffect, useRef, useState} from "react";
import {Icon} from "./ui.jsx";
import {mOf, today, wd} from "./lib.js";

// 茶園梯田：三層山，後兩層畫茶樹行（用同一條稜線往下平移）
function Hills({paper}) {
    const mid = "M0 124 C110 92 220 84 330 100 C430 114 520 86 640 94", front = "M0 186 C140 154 260 160 380 174 C480 188 560 162 640 154";
    const rows = (top, n, step) => Array.from({length: n}, (_, k) => <path key={k} d={top} transform={`translate(0 ${(k + 1) * step})`}/>);
    const id = paper ? "hp" : "hd";
    return (
        <svg className={"lg-hills" + (paper ? " to-paper" : "")} viewBox="0 0 640 220" aria-hidden="true">
            <defs>
                <clipPath id={id + "m"}><path d={mid + " V220 H0Z"}/></clipPath>
                <clipPath id={id + "f"}><path d={front + " V220 H0Z"}/></clipPath>
            </defs>
            <path className="h-far" d="M0 84 C100 58 180 52 270 64 C350 74 410 46 490 40 C570 34 615 50 640 56 V220 H0Z"/>
            <path className="h-mid" d={mid + " V220 H0Z"}/>
            <g className="h-rows" clipPath={`url(#${id}m)`}>{rows(mid, 6, 13)}</g>
            <path className="h-front" d={front + " V220 H0Z"}/>
            {paper ? null : <g className="h-rows" clipPath={`url(#${id}f)`}>{rows(front, 5, 14)}</g>}
        </svg>
    );
}

/* 登入：輸入 4 碼密碼，打滿自動送出。
   手機＝全螢幕數字鍵盤；平板＝上方茶園意象、下方放大鍵盤；電腦＝左邊茶園意象、右邊輸入，可以全程用鍵盤。
   onAuth(mode, pin) 成功回傳 null（畫面會由登入狀態切走），失敗回傳錯誤訊息。 */
export default function Login({size, onAuth}) {
    const wide = size !== "phone";
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
            : <span className="lg-status">{size === "desktop" ? <>直接用鍵盤輸入，打滿 4 碼自動登入 · <kbd>Backspace</kbd> 刪除</> : "打滿 4 碼自動登入"}</span>;
    const t = today();
    const date = `${mOf(t)} 月 ${parseInt(t.slice(8, 10), 10)} 日 星期${wd(t)}`;
    return (
        <div className={"login " + size}>
            <section className="lg-brand"><span className="lg-sun" aria-hidden="true"/>
                <div className="lg-mark"><span className="seal lg">茶</span><b>茶葉記帳</b></div>
                <div className="lg-copy">{size === "desktop"
                    ? <><h2>茶園到茶廠，<br/>一本帳記清楚</h2><p>銷售、收款、支出和庫存都在這裡。<br/>手機、平板、電腦看到的是同一本帳。</p></>
                    : <p>茶園到茶廠，一本帳記清楚</p>}</div>
                <span className="lg-date">{date}</span>
                <Hills paper={size === "tablet"}/>
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
