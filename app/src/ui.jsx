import {useEffect, useRef, useState} from "react";
import {
    ArrowDownLeft, ArrowUpRight, Box, Calendar, ChartPie, Check, ChevronDown, CircleCheck, ChevronLeft, ChevronRight, Circle, CircleAlert,
    CloudAlert, CloudCheck, Copy, Delete, Download, Droplets, Eye, EyeOff, Factory, Flame, Gift, HandCoins, Leaf, List, LogOut,
    Moon, NotebookPen, Pencil, Plus, Receipt, RefreshCw, Scissors, Search, Settings, Sprout, Sun, Trash2, Truck, Undo2, User, Users, X, Zap,
} from "lucide-react";
import {atEndP, money, nowYM, pLabel, reduceMotion, stepP} from "./lib.js";

const ICONS = {
    list: List, calendar: Calendar, pie: ChartPie, box: Box, users: Users, settings: Settings, eye: Eye, eyeOff: EyeOff,
    chevLeft: ChevronLeft, chevRight: ChevronRight, chevDown: ChevronDown, leaf: Leaf, factory: Factory, truck: Truck, gift: Gift,
    zap: Zap, flame: Flame, sprout: Sprout, hand: HandCoins, droplets: Droplets, scissors: Scissors, receipt: Receipt, copy: Copy,
    search: Search, check: Check, x: X, backspace: Delete, undo: Undo2, download: Download, logout: LogOut, cloudCheck: CloudCheck,
    cloudAlert: CloudAlert, refresh: RefreshCw, alert: CircleAlert, trash: Trash2, pencil: Pencil, note: NotebookPen, user: User,
    up: ArrowUpRight, down: ArrowDownLeft, circle: Circle, circleCheck: CircleCheck, plus: Plus, sun: Sun, moon: Moon,
};
export function Icon({n, s = 20, w = 1.8, style}) {
    const C = ICONS[n] || Circle;
    return <C size={s} strokeWidth={w} style={style} aria-hidden="true" focusable="false"/>;
}
// 金額；開啟「隱藏金額」時 .mv 會模糊
export const M = ({v, sign}) => <span className="mv num">{sign ? (v >= 0 ? "+" : "−") : ""}{money(Math.abs(v))}</span>;

// 媒體查詢，例如判斷是不是用滑鼠和實體鍵盤（電腦）
export const FINE = "(hover: hover) and (pointer: fine)";
export function useMedia(q) {
    const get = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(q).matches;
    const [m, setM] = useState(get);
    useEffect(() => {
        const mq = window.matchMedia(q), h = () => setM(mq.matches);
        mq.addEventListener("change", h);
        h();
        return () => mq.removeEventListener("change", h);
    }, [q]);
    return m;
}

// 讓畫面跟著「看得到的區域」：iPhone 打開鍵盤時，App 縮到鍵盤上方，不會整個被推上去跑版
export function useVisualViewport() {
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return undefined;
        const root = document.documentElement;
        const h = () => {
            const zoomed = Math.abs(vv.scale - 1) > 0.01; // 使用者自己放大畫面時不跟
            root.style.setProperty("--vvh", (zoomed ? window.innerHeight : vv.height) + "px");
            root.style.setProperty("--vvt", (zoomed ? 0 : vv.offsetTop) + "px");
        };
        // 鍵盤收起後，iOS 有時會留下頁面捲動的位移，把它歸零
        const out = () => setTimeout(() => {
            if (!document.activeElement || !document.activeElement.closest("input,textarea,select")) {
                if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
                h();
            }
        }, 60);
        h();
        vv.addEventListener("resize", h);
        vv.addEventListener("scroll", h);
        window.addEventListener("focusout", out);
        return () => {
            vv.removeEventListener("resize", h);
            vv.removeEventListener("scroll", h);
            window.removeEventListener("focusout", out);
            root.style.removeProperty("--vvh");
            root.style.removeProperty("--vvt");
        };
    }, []);
}

// Esc 依序關掉最上層的視窗
const ESC = [];
if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && ESC.length) {
            e.preventDefault();
            ESC[ESC.length - 1]();
        }
    });
}
export function useEscape(handler, enabled = true, first = false) {
    const ref = useRef(handler);
    ref.current = handler;
    useEffect(() => {
        if (!enabled) return undefined;
        const h = () => ref.current();
        if (first) ESC.unshift(h); else ESC.push(h);
        return () => {
            const i = ESC.indexOf(h);
            if (i >= 0) ESC.splice(i, 1);
        };
    }, [enabled, first]);
}

// 手機：從底部滑上來，可以往下拖關閉；平板與電腦：置中的視窗
export function Sheet({title, head, actions, closing, z = 0, tall, drag: canDrag = true, onRequestClose, children, footer, bottom}) {
    const [shown, setShown] = useState(false);
    const ref = useRef(null), drag = useRef(null), closeRef = useRef(onRequestClose);
    closeRef.current = onRequestClose;
    useEffect(() => {
        let a = requestAnimationFrame(() => { a = requestAnimationFrame(() => setShown(true)); });
        return () => cancelAnimationFrame(a);
    }, []);
    useEscape(() => closeRef.current());
    const open = shown && !closing;
    const down = (e) => {
        if (!canDrag || e.button > 0 || e.target.closest("button,input,select,textarea,a")) return;
        drag.current = {y: e.clientY, dy: 0, lastY: e.clientY, lastT: performance.now(), v: 0};
        ref.current.style.transition = "none";
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
        const d = drag.current;
        if (!d) return;
        let dy = e.clientY - d.y;
        if (dy < 0) dy = -Math.pow(-dy, 0.65);
        const now = performance.now();
        d.v = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
        d.lastY = e.clientY;
        d.lastT = now;
        d.dy = dy;
        ref.current.style.transform = `translateY(${dy}px)`;
    };
    const up = () => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        ref.current.style.transition = "";
        ref.current.style.transform = "";
        if (d.dy > 120 || d.v > 0.55) closeRef.current();
    };
    return (
        <div className={"layer" + (open ? " open" : "")} style={{zIndex: 40 + z * 2}}>
            <div className="scrim" onClick={() => closeRef.current()}/>
            <div className={"sheet" + (tall ? " tall" : "")} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
                <div className="sh-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                    <div className="grabber" aria-hidden="true"/>
                    <div className="sh-row">{head || <h2 className="sh-title">{title}</h2>}{actions}
                        <button className="icon-btn" aria-label="關閉" onClick={() => closeRef.current()}><Icon n="x"/></button>
                    </div>
                </div>
                <div className="sh-body">{children}</div>
                {footer ? <div className="sh-foot">{footer}</div> : null}
                {bottom || null}
            </div>
        </div>
    );
}

// 平板與電腦：並排在右邊的窗格
export function Panel({title, head, actions, onClose, children, footer, bottom}) {
    return (
        <section className="panel" aria-label={title}>
            <div className="pn-head">{head || <h2 className="sh-title">{title}</h2>}{actions}
                {onClose ? <button className="icon-btn" aria-label="關閉" onClick={onClose}><Icon n="x"/></button> : null}
            </div>
            <div className="pn-body">{children}</div>
            {footer ? <div className="pn-foot">{footer}</div> : null}
            {bottom || null}
        </section>
    );
}

// 視窗裡再疊一層（例如選客戶）
export function useSubSheet() {
    const [st, setSt] = useState(null);
    const close = () => {
        setSt((s) => (s ? {...s, closing: true} : s));
        setTimeout(() => setSt(null), reduceMotion() ? 0 : 330);
    };
    return [st, setSt, close];
}

// 期間切換：上一期／下一期，月或年
export function PeriodNav({p, setP, light}) {
    const now = nowYM();
    return (
        <div className={"pnav" + (light ? " light" : "")}>
            <button aria-label="上一期" onClick={() => setP(stepP(p, -1))}><Icon n="chevLeft"/></button>
            <span className="lbl num">{pLabel(p)}</span>
            <button aria-label="下一期" disabled={atEndP(p)} onClick={() => setP(stepP(p, 1))}><Icon n="chevRight"/></button>
            <span className="mseg">{[["month", "月"], ["year", "年"]].map(([v, n]) => (
                <button key={v} aria-pressed={p.mode === v}
                        onClick={() => setP({...p, mode: v, m: v === "month" ? (p.y === now.y ? now.m : 12) : p.m})}>{n}</button>))}</span>
        </div>
    );
}

export function Ask({text, keep, onKeep, onDiscard}) {
    return (
        <div className="ask" role="alert"><span>{text}</span>
            <div>
                <button className="btn sm ghost" onClick={onKeep}>{keep}</button>
                <button className="btn sm danger" onClick={onDiscard}>放棄</button>
            </div>
        </div>
    );
}
