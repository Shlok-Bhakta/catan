import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ConvexProvider,
  ConvexReactClient,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import {
  BookOpen,
  Copy,
  ArrowRight,
  Plus,
  Users,
  Dice5,
  Home,
  Route,
  Landmark,
  Scroll,
  Ship,
  HandCoins,
  Check,
  X,
  Menu,
  ChevronRight,
  RotateCcw,
  Crown,
  Shield,
  ExternalLink,
} from "lucide-react";
import {
  COSTS,
  RESOURCES,
  legalTargets,
  emptyBag,
  type Action,
  type Game,
  type Resource,
  type ResourceBag,
} from "./game";
import "./style.css";
const url = import.meta.env.VITE_CONVEX_URL || "http://localhost:3210";
const client = new ConvexReactClient(url);
const guestToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const labels: Record<Resource, string> = {
  wood: "Lumber",
  brick: "Brick",
  wool: "Wool",
  grain: "Grain",
  ore: "Ore",
};
const icons: Record<Resource, string> = {
  wood: "♣",
  brick: "▣",
  wool: "●",
  grain: "✦",
  ore: "◆",
};
const terrainColors: Record<string, [string, string]> = {
  wood: ["#668d70", "#456d60"],
  brick: ["#c66e52", "#a44d3f"],
  wool: ["#a3ac78", "#778d65"],
  grain: ["#d5b368", "#b88c4e"],
  ore: ["#8b9190", "#646c71"],
  desert: ["#dcc18e", "#bfa579"],
};
const view = (h: { q: number; r: number }) => ({
  x: Math.sqrt(3) * (h.q + h.r / 2) * 72,
  y: 1.5 * h.r * 72,
});
function hexPoints(cx: number, cy: number, size: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return `${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`;
  }).join(" ");
}
function App() {
  const [token] = useState(() => {
    let s = localStorage.getItem("settlers-token");
    if (!s) {
      s = guestToken();
      localStorage.setItem("settlers-token", s);
    }
    return s;
  });
  const [name, setName] = useState(localStorage.getItem("settlers-name") || "");
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get("room")?.toUpperCase() || "",
  );
  const [joinCode, setJoinCode] = useState("");
  const [seats, setSeats] = useState(4);
  const [tab, setTab] = useState<"create" | "join">("create");
  const [rules, setRules] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useMutation(api.games.create),
    join = useMutation(api.games.join),
    start = useMutation(api.games.start),
    act = useMutation(api.games.act);
  const result = useQuery(api.games.get, code ? { code, token } : "skip");
  const game = result && !result.needsJoin ? (result.game as Game) : undefined;
  const you = result && !result.needsJoin ? result.you : undefined;
  useEffect(() => {
    if (code) {
      history.replaceState(null, "", `?room=${code}`);
    } else history.replaceState(null, "", location.pathname);
  }, [code]);
  async function run(fn: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function saveName() {
    localStorage.setItem("settlers-name", name.trim());
  }
  function submitCreate() {
    if (!name.trim()) {
      setError("Enter your name first.");
      return;
    }
    saveName();
    run(async () => setCode(await create({ name, token, maxPlayers: seats })));
  }
  function submitJoin(target = joinCode) {
    if (!name.trim()) {
      setError("Enter your name first.");
      return;
    }
    saveName();
    run(async () =>
      setCode(await join({ code: target.trim().toUpperCase(), name, token })),
    );
  }
  function action(a: Action) {
    if (!game) return;
    run(() => act({ code: game.code, token, action: a }));
  }
  return (
    <>
      <div className="shell">
        <header className="topbar">
          <button className="brand" onClick={() => setCode("")}>
            <span className="brand-mark">S</span>
            <span>
              SETTLERS'<i> TABLE</i>
            </span>
          </button>
          <div className="top-actions">
            <span className="top-caption">A place to build your story</span>
            <button className="text-button" onClick={() => setRules(true)}>
              <BookOpen size={17} /> Rules & guide
            </button>
            {code && (
              <button
                className="circle-button"
                title="Leave view"
                onClick={() => setCode("")}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </header>
        {!code ? (
          <Landing
            name={name}
            setName={setName}
            tab={tab}
            setTab={setTab}
            seats={seats}
            setSeats={setSeats}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onCreate={submitCreate}
            onJoin={() => submitJoin()}
            busy={busy}
          />
        ) : result === undefined ? (
          <div className="loading">Setting the table…</div>
        ) : result === null ? (
          <div className="empty">
            <h2>We couldn't find that table.</h2>
            <button className="button primary" onClick={() => setCode("")}>
              Back to the hall
            </button>
          </div>
        ) : result.needsJoin ? (
          <div className="join-page">
            <div className="eyebrow">INVITATION · {code}</div>
            <h1>You've found the table.</h1>
            <p>
              {result.players?.join(", ")}{" "}
              {result.status === "lobby"
                ? "are waiting to play."
                : "have started playing."}
            </p>
            {result.status === "lobby" && !result.full ? (
              <div className="join-box">
                <label>
                  Your name
                  <input
                    value={name}
                    maxLength={24}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                  />
                </label>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => submitJoin(code)}
                >
                  Take a seat <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <p className="muted">
                This table is {result.full ? "full" : "already in play"}.
              </p>
            )}
          </div>
        ) : game && you ? (
          <GameView
            game={game}
            you={you}
            action={action}
            start={() => run(() => start({ code, token }))}
            busy={busy}
            openRules={() => setRules(true)}
          />
        ) : null}
        {error && (
          <div className="toast" role="alert">
            {error}
            <button onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <footer className="site-footer">
          <span>SETTLERS' TABLE</span>
          <span>Gather. Trade. Build. Begin again.</span>
          <button onClick={() => setRules(true)}>
            How to play <ArrowRight size={14} />
          </button>
        </footer>
      </div>
      {rules && <Rules onClose={() => setRules(false)} />}
    </>
  );
}
function Landing(p: {
  name: string;
  setName: (v: string) => void;
  tab: "create" | "join";
  setTab: (v: "create" | "join") => void;
  seats: number;
  setSeats: (n: number) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  busy: boolean;
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="small-star">✦</span> THE TABLE IS OPEN
          </div>
          <h1>
            A whole island.
            <br />
            <em>One evening.</em>
            <br />
            Your move.
          </h1>
          <p>
            Gather your people around a living board. Make a deal, build a road,
            and see where the next roll takes you.
          </p>
          <div className="hero-proof">
            <div className="avatar-stack">
              <span>A</span>
              <span>M</span>
              <span>J</span>
              <span>+</span>
            </div>
            <span>3–8 players · Real-time play · Private rooms</span>
          </div>
        </div>
        <div className="hero-board" aria-hidden="true">
          <DecorBoard />
          <span className="board-float">
            YOUR NEXT ADVENTURE
            <br />
            <strong>STARTS HERE ↗</strong>
          </span>
        </div>
      </section>
      <section className="entry-wrap">
        <div className="entry-card">
          <div className="entry-head">
            <div>
              <div className="eyebrow">PULL UP A CHAIR</div>
              <h2>Make room for everyone.</h2>
            </div>
            <div className="entry-tabs">
              <button
                className={p.tab === "create" ? "active" : ""}
                onClick={() => p.setTab("create")}
              >
                Create table
              </button>
              <button
                className={p.tab === "join" ? "active" : ""}
                onClick={() => p.setTab("join")}
              >
                Join with code
              </button>
            </div>
          </div>
          <div className="entry-form">
            <label>
              Your name
              <input
                placeholder="e.g. The road baron"
                value={p.name}
                maxLength={24}
                onChange={(e) => p.setName(e.target.value)}
              />
            </label>
            {p.tab === "create" ? (
              <>
                <label>
                  Seats at the table
                  <select
                    value={p.seats}
                    onChange={(e) => p.setSeats(Number(e.target.value))}
                  >
                    {[3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} players{n > 6 ? " · extended board" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button primary"
                  disabled={p.busy}
                  onClick={p.onCreate}
                >
                  Create a table <ArrowRight size={19} />
                </button>
              </>
            ) : (
              <>
                <label>
                  Six-character room code
                  <input
                    className="code-input"
                    placeholder="ABC123"
                    maxLength={6}
                    value={p.joinCode}
                    onChange={(e) =>
                      p.setJoinCode(e.target.value.toUpperCase())
                    }
                  />
                </label>
                <button
                  className="button primary"
                  disabled={p.busy}
                  onClick={p.onJoin}
                >
                  Join the table <ArrowRight size={19} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="entry-note">
          <span className="tiny-icon">✦</span>
          <p>
            <strong>No accounts. No setup.</strong> Share a private room code
            and start playing. Your seat stays yours on this browser.
          </p>
        </div>
      </section>
      <section className="features">
        <div>
          <span>01 / GATHER</span>
          <Users />
          <h3>Bring the whole crew.</h3>
          <p>Private rooms with room codes for three to eight players.</p>
        </div>
        <div>
          <span>02 / PLAY</span>
          <Dice5 />
          <h3>Every roll matters.</h3>
          <p>Live turns, trades, the robber, and all the familiar decisions.</p>
        </div>
        <div>
          <span>03 / RETURN</span>
          <Crown />
          <h3>Come back to it.</h3>
          <p>Your game lives on the server. Pick up where you left off.</p>
        </div>
      </section>
    </>
  );
}
function DecorBoard() {
  const tiles = [
    ["wood", -1, -1],
    ["grain", 0, -1],
    ["brick", 1, -1],
    ["wool", -1, 0],
    ["desert", 0, 0],
    ["ore", 1, 0],
    ["ore", -1, 1],
    ["wood", 0, 1],
    ["grain", 1, 1],
  ] as const;
  return (
    <svg viewBox="-190 -185 380 370">
      <defs>
        {Object.entries(terrainColors).map(([t, c]) => (
          <linearGradient id={"d" + t} key={t} x2=".8" y2="1">
            <stop stopColor={c[0]} />
            <stop offset="1" stopColor={c[1]} />
          </linearGradient>
        ))}
      </defs>
      {tiles.map(([t, q, r], i) => {
        const { x, y } = view({ q, r });
        return (
          <g key={i}>
            <polygon
              points={hexPoints(x, y, 70)}
              fill={`url(#d${t})`}
              stroke="#e7d5aa"
              strokeWidth="4"
            />
            <text
              x={x}
              y={y + 10}
              textAnchor="middle"
              fontSize="38"
              opacity=".55"
              fill="#fff"
            >
              {t === "wood"
                ? "♣"
                : t === "brick"
                  ? "▣"
                  : t === "wool"
                    ? "●"
                    : t === "grain"
                      ? "✦"
                      : t === "ore"
                        ? "◆"
                        : "☀"}
            </text>
          </g>
        );
      })}
      <circle cx="0" cy="0" r="15" fill="#f6e9cc" />
      <text x="0" y="5" textAnchor="middle" fill="#775b40" fontWeight="bold">
        7
      </text>
    </svg>
  );
}
function GameView({
  game: g,
  you,
  action,
  start,
  busy,
  openRules,
}: {
  game: Game;
  you: string;
  action: (a: Action) => void;
  start: () => void;
  busy: boolean;
  openRules: () => void;
}) {
  const me = g.players.find((p) => p.id === you)!;
  const active = g.players[g.turn];
  const mine = active?.id === you;
  const [tool, setTool] = useState<
    "road" | "settlement" | "city" | "robber" | null
  >(null);
  const [panel, setPanel] = useState<"trade" | "development" | null>(null);
  const [r1, setR1] = useState<Resource>("wood"),
    [r2, setR2] = useState<Resource>("brick");
  const [give, setGive] = useState<ResourceBag>(emptyBag()),
    [want, setWant] = useState<ResourceBag>(emptyBag());
  const [target, setTarget] = useState("");
  const [devChoice, setDevChoice] = useState<Resource>("wood");
  const [roadFirst, setRoadFirst] = useState<number | null>(null);
  const [devRoad, setDevRoad] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (g.phase === "setup-settlement" && mine) setTool("settlement");
    else if (g.phase === "setup-road" && mine) setTool("road");
    else if (g.phase === "robber" && mine) setTool("robber");
    else if (!["main"].includes(g.phase)) setTool(null);
  }, [g.phase, g.turn, mine]);
  const legal = useMemo(
    () => (tool && tool !== "robber" ? legalTargets(g, you, tool) : []),
    [g, you, tool],
  );
  function boardClick(kind: "vertex" | "edge" | "hex", index: number) {
    if (busy || !mine) return;
    if (kind === "hex" && tool === "robber") {
      action({ type: "robber", hex: index });
      setTool(null);
    }
    if (
      kind === "vertex" &&
      (tool === "settlement" || tool === "city") &&
      legal.includes(index)
    ) {
      action({ type: tool, vertex: index });
      if (g.phase === "main") setTool(null);
    }
    if (kind === "edge" && tool === "road" && legal.includes(index)) {
      if (devRoad) {
        if (roadFirst === null) setRoadFirst(index);
        else {
          action({
            type: "playDev",
            card: "roadBuilding",
            edge1: roadFirst,
            edge2: index,
          });
          setRoadFirst(null);
          setDevRoad(false);
          setTool(null);
        }
      } else {
        action({ type: "road", edge: index });
        if (g.phase === "main") setTool(null);
      }
    }
  }
  const myTurnText =
    g.status === "lobby"
      ? "Waiting for players to join."
      : g.status === "finished"
        ? `${g.players.find((p) => p.id === g.winner)?.name} won the game`
        : g.phase.startsWith("setup")
          ? `${active?.name} is placing ${g.phase === "setup-settlement" ? "a settlement" : "a road"}`
          : g.phase === "discard"
            ? "Discard before the robber moves"
            : g.phase === "robber"
              ? `${active?.name} is moving the robber`
              : g.phase === "steal"
                ? `${active?.name} is stealing a card`
                : g.phase === "roll"
                  ? `${active?.name} is rolling`
                  : g.paired
                    ? `${active?.name} is taking a paired action phase`
                    : `${active?.name} is building & trading`;
  const rate = (r: Resource) => {
    const ports = [...me.settlements, ...me.cities].flatMap((v) =>
      g.vertices[v].port ? [g.vertices[v].port] : [],
    );
    return ports.includes(r) ? 2 : ports.includes("any") ? 3 : 4;
  };
  return (
    <div className="game-page">
      <div className="game-header">
        <div>
          <div className="eyebrow">PRIVATE GAME · {g.maxPlayers} SEATS</div>
          <h1>Island of {g.code}</h1>
          <p>{myTurnText}</p>
        </div>
        <div className="game-head-actions">
          <button
            className="room-code"
            onClick={() => {
              (async () => {
                let ok = false;
                try {
                  if (navigator.clipboard) {
                    await navigator.clipboard.writeText(location.href);
                    ok = true;
                  }
                } catch {}
                if (!ok) {
                  const field = document.createElement("textarea");
                  field.value = location.href;
                  field.style.position = "fixed";
                  field.style.opacity = "0";
                  document.body.appendChild(field);
                  field.select();
                  ok = document.execCommand("copy");
                  field.remove();
                }
                if (ok) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              })();
            }}
          >
            <span>ROOM CODE</span>
            <strong>{g.code}</strong>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button className="round-rule" title="Rules" onClick={openRules}>
            <BookOpen size={21} />
          </button>
        </div>
      </div>
      {g.status === "lobby" ? (
        <div className="lobby">
          <div className="lobby-left">
            <div className="eyebrow">THE CREW</div>
            <h2>Waiting at the table.</h2>
            <p>
              Share the room code with friends. Everyone joins from their own
              browser.
            </p>
            <div className="seat-grid">
              {Array.from({ length: g.maxPlayers }, (_, i) => {
                const p = g.players[i];
                return (
                  <div className={"seat " + (!p ? "vacant" : "")} key={i}>
                    <span
                      className="seat-avatar"
                      style={{ background: p?.color }}
                    >
                      {p?.name[0]?.toUpperCase() || "+"}
                    </span>
                    <span>{p?.name || "Open seat"}</span>
                    {p?.id === g.host && <small>HOST</small>}
                  </div>
                );
              })}
            </div>
            {g.houseRules && (
              <div className="house-note">
                7–8 players uses a larger, custom board. The official Catan
                rules cover up to six.
              </div>
            )}
            {g.host === you ? (
              <button
                className="button primary"
                disabled={g.players.length < 3 || busy}
                onClick={start}
              >
                Start game <ArrowRight size={18} />
              </button>
            ) : (
              <div className="waiting">
                <span className="pulse" /> Waiting for the host to start…
              </div>
            )}
            <small className="minimum">
              At least 3 players needed to begin.
            </small>
          </div>
          <div className="lobby-art">
            <DecorBoard />
            <div className="art-note">THE ISLAND AWAITS</div>
          </div>
        </div>
      ) : (
        <>
          <div className="game-layout">
            <div className="table-column">
              <div className="board-top">
                <div>
                  <span className="live-dot" /> LIVE TABLE{" "}
                  <span className="divider">/</span> TURN{" "}
                  {g.turnNumber || "SETUP"}
                </div>
                <div>
                  {g.roll && (
                    <span className="last-roll">
                      LAST ROLL{" "}
                      <b>
                        {g.roll[0]} + {g.roll[1]} = {g.roll[0] + g.roll[1]}
                      </b>
                    </span>
                  )}
                </div>
              </div>
              <Board
                g={g}
                tool={tool}
                legal={legal}
                onClick={boardClick}
                me={you}
              />
              <div className="board-hint">
                {devRoad && roadFirst !== null && (
                  <button
                    className="one-road"
                    onClick={() => {
                      action({
                        type: "playDev",
                        card: "roadBuilding",
                        edge1: roadFirst,
                        edge2: -1,
                      });
                      setRoadFirst(null);
                      setDevRoad(false);
                      setTool(null);
                    }}
                  >
                    Place this one road
                  </button>
                )}
                {tool === "settlement"
                  ? "Select a glowing corner to place your settlement."
                  : tool === "city"
                    ? "Select one of your settlements to upgrade."
                    : tool === "road"
                      ? "Select a glowing edge to build a road."
                      : tool === "robber"
                        ? "Select a different hex for the robber."
                        : g.phase === "setup-settlement"
                          ? "Opening placement: settlements must be two corners apart."
                          : g.phase === "discard"
                            ? "Players with more than seven cards discard half."
                            : "Select an action below when it is your turn."}
              </div>
              <div className="hand">
                <div className="hand-heading">
                  <div>
                    <span className="eyebrow">YOUR HAND</span>
                    <h3>{me.name}'s resources</h3>
                  </div>
                  <span>
                    {RESOURCES.reduce((a, r) => a + me.resources[r], 0)} cards
                  </span>
                </div>
                <div className="resource-row">
                  {RESOURCES.map((r) => (
                    <div className={"resource-card " + r} key={r}>
                      <span className="resource-symbol">{icons[r]}</span>
                      <div>
                        <b>{me.resources[r]}</b>
                        <small>{labels[r]}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dev-hand">
                  Development cards: {me.dev.length + me.newDev.length}{" "}
                  {me.newDev.length > 0 && (
                    <span>· {me.newDev.length} available next turn</span>
                  )}
                </div>
              </div>
            </div>
            <aside className="sidebar">
              <div className="panel turn-panel">
                <div className="panel-top">
                  <span className="eyebrow">ON THE TABLE</span>
                  <span className="phase-pill">
                    {g.paired ? "paired action" : g.phase.replace("-", " ")}
                  </span>
                </div>
                <div className="turn-hero">
                  <span
                    className="turn-avatar"
                    style={{ background: active?.color }}
                  >
                    {active?.name[0]?.toUpperCase()}
                  </span>
                  <div>
                    <small>NOW PLAYING</small>
                    <h2>{active?.name}</h2>
                  </div>
                </div>
                {g.status === "finished" ? (
                  <div className="status-copy">
                    The island has a new champion.
                  </div>
                ) : g.phase === "discard" && g.discardIds.includes(you) ? (
                  <Discard me={me} action={action} />
                ) : mine && g.phase === "roll" ? (
                  <div className="pre-roll-actions">
                    <button
                      className="button primary wide"
                      onClick={() => action({ type: "roll" })}
                    >
                      <Dice5 size={19} /> Roll the dice
                    </button>
                    {me.dev.some((card) => card !== "victory") &&
                      !me.playedDev && (
                        <button
                          className="pre-roll-knight"
                          onClick={() => setPanel("development")}
                        >
                          <Scroll size={17} /> Play a card before rolling
                        </button>
                      )}
                  </div>
                ) : mine && g.phase === "steal" ? (
                  <div className="victims">
                    <p>Choose a player to steal from:</p>
                    {g.robberVictims.map((id) => {
                      const p = g.players.find((x) => x.id === id)!;
                      return (
                        <button
                          key={id}
                          onClick={() => action({ type: "steal", victim: id })}
                        >
                          {p.name} <ArrowRight size={15} />
                        </button>
                      );
                    })}
                  </div>
                ) : mine && g.phase === "main" ? (
                  <div className="actions">
                    <button
                      onClick={() => {
                        setTool("road");
                        setPanel(null);
                      }}
                      className={tool === "road" ? "selected" : ""}
                    >
                      <Route size={19} />
                      <span>
                        Build road <small>1 lumber · 1 brick</small>
                      </span>
                      <b>→</b>
                    </button>
                    <button
                      onClick={() => {
                        setTool("settlement");
                        setPanel(null);
                      }}
                      className={tool === "settlement" ? "selected" : ""}
                    >
                      <Home size={19} />
                      <span>
                        Settlement <small>Lumber · brick · wool · grain</small>
                      </span>
                      <b>→</b>
                    </button>
                    <button
                      onClick={() => {
                        setTool("city");
                        setPanel(null);
                      }}
                      className={tool === "city" ? "selected" : ""}
                    >
                      <Landmark size={19} />
                      <span>
                        Upgrade city <small>2 grain · 3 ore</small>
                      </span>
                      <b>→</b>
                    </button>
                    <button
                      onClick={() => {
                        setPanel("trade");
                        setTool(null);
                      }}
                      className={panel === "trade" ? "selected" : ""}
                    >
                      <HandCoins size={19} />
                      <span>
                        Trade <small>Players or the bank</small>
                      </span>
                      <b>→</b>
                    </button>
                    <button
                      onClick={() => {
                        setPanel("development");
                        setTool(null);
                      }}
                      className={panel === "development" ? "selected" : ""}
                    >
                      <Scroll size={19} />
                      <span>
                        Development <small>Buy or play a card</small>
                      </span>
                      <b>→</b>
                    </button>
                    <button
                      className="end-turn"
                      onClick={() => {
                        setPanel(null);
                        setTool(null);
                        action({ type: "end" });
                      }}
                    >
                      End turn <ArrowRight size={17} />
                    </button>
                  </div>
                ) : (
                  <div className="status-copy">
                    {mine
                      ? myTurnText
                      : "Watch the board. Your turn is coming."}
                  </div>
                )}
              </div>
              <div className="panel players-panel">
                <div className="panel-top">
                  <span className="eyebrow">PLAYERS</span>
                  <span>
                    {g.players.length}/{g.maxPlayers}
                  </span>
                </div>
                {g.players.map((p, i) => (
                  <div
                    className={
                      "player-line " + (p.id === active?.id ? "current" : "")
                    }
                    key={p.id}
                  >
                    <span
                      className="player-avatar"
                      style={{ background: p.color }}
                    >
                      {p.name[0].toUpperCase()}
                    </span>
                    <span className="player-name">
                      {p.name}
                      {p.id === you && <small> YOU</small>}
                    </span>
                    <span className="player-cards">
                      {p.id === you
                        ? RESOURCES.reduce((a, r) => a + p.resources[r], 0)
                        : p.cardCount}{" "}
                      cards
                    </span>
                    <b>
                      {p.id === you ? p.points : p.points - p.hiddenPoints} VP
                    </b>
                    {p.id === g.largestArmy && (
                      <Shield size={15} className="award" />
                    )}
                    {p.id === g.longestRoad && (
                      <Route size={15} className="award" />
                    )}
                  </div>
                ))}
              </div>
              <div className="panel journal">
                <div className="eyebrow">TABLE TALK</div>
                {g.log.slice(0, 7).map((item, i) => (
                  <p key={i}>
                    <span>✦</span>
                    {item}
                  </p>
                ))}
              </div>
            </aside>
          </div>
          {panel &&
            (g.phase === "main" ||
              (g.phase === "roll" && panel === "development")) &&
            mine && (
              <div className="drawer-back" onClick={() => setPanel(null)}>
                <div className="drawer" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="drawer-close"
                    onClick={() => setPanel(null)}
                  >
                    <X size={19} />
                  </button>
                  {panel === "trade" ? (
                    <>
                      <div className="eyebrow">MAKE A DEAL</div>
                      <h2>Trade at the table.</h2>
                      <div className="drawer-section">
                        <h3>With the bank</h3>
                        <p>
                          Your ports set the exchange rate. Without a port,
                          trade four of one resource for one.
                        </p>
                        <div className="inline-trade">
                          <select
                            value={r1}
                            onChange={(e) => setR1(e.target.value as Resource)}
                          >
                            {RESOURCES.map((r) => (
                              <option key={r} value={r}>
                                {rate(r)} {labels[r]}
                              </option>
                            ))}
                          </select>
                          <span>→</span>
                          <select
                            value={r2}
                            onChange={(e) => setR2(e.target.value as Resource)}
                          >
                            {RESOURCES.map((r) => (
                              <option key={r} value={r}>
                                1 {labels[r]}
                              </option>
                            ))}
                          </select>
                          <button
                            className="button primary"
                            onClick={() =>
                              action({ type: "bankTrade", from: r1, to: r2 })
                            }
                          >
                            Trade
                          </button>
                        </div>
                      </div>
                      {!g.paired && (
                        <div className="drawer-section">
                          <h3>With a player</h3>
                          <p>
                            Choose what you give and what you want. Any player
                            can accept a table offer.
                          </p>
                          <select
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                          >
                            <option value="">Offer to everyone</option>
                            {g.players
                              .filter((p) => p.id !== you)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                          <BagPicker
                            title="You give"
                            bag={give}
                            setBag={setGive}
                          />
                          <BagPicker
                            title="You want"
                            bag={want}
                            setBag={setWant}
                          />
                          <button
                            className="button primary wide"
                            onClick={() => {
                              action({
                                type: "offer",
                                give,
                                want,
                                to: target || undefined,
                              });
                              setGive(emptyBag());
                              setWant(emptyBag());
                            }}
                          >
                            Propose trade
                          </button>
                        </div>
                      )}
                      {g.offers.length > 0 && (
                        <div className="drawer-section">
                          <h3>Open offers</h3>
                          {g.offers.map((o) => (
                            <div className="offer" key={o.id}>
                              <p>
                                {g.players.find((p) => p.id === o.from)?.name}{" "}
                                gives {bagText(o.give)} for {bagText(o.want)}
                              </p>
                              {o.from === you ? (
                                <button
                                  onClick={() =>
                                    action({
                                      type: "cancelOffer",
                                      offerId: o.id,
                                    })
                                  }
                                >
                                  Cancel
                                </button>
                              ) : (
                                (!o.to || o.to === you) && (
                                  <button
                                    onClick={() =>
                                      action({ type: "accept", offerId: o.id })
                                    }
                                  >
                                    Accept
                                  </button>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="eyebrow">A LITTLE ADVANTAGE</div>
                      <h2>Development cards.</h2>
                      <p>
                        Play one card you held before this turn. You can play it
                        before rolling or during your action phase.
                      </p>
                      {g.phase === "main" && (
                        <button
                          className="button primary wide"
                          onClick={() => action({ type: "buyDev" })}
                        >
                          Buy a card · 1 wool, 1 grain, 1 ore{" "}
                          <ArrowRight size={17} />
                        </button>
                      )}
                      <div className="drawer-section">
                        <h3>Your playable cards</h3>
                        {me.dev.filter((c) => c !== "victory").length === 0 ? (
                          <p>
                            No action cards ready. New cards can be played next
                            turn.
                          </p>
                        ) : (
                          me.dev
                            .filter((c) => c !== "victory")
                            .map((card, i) => (
                              <div className="dev-option" key={i}>
                                <strong>
                                  {card === "roadBuilding"
                                    ? "Road Building"
                                    : card === "yearOfPlenty"
                                      ? "Year of Plenty"
                                      : card === "monopoly"
                                        ? "Monopoly"
                                        : "Knight"}
                                </strong>
                                {card === "knight" ? (
                                  <button
                                    onClick={() => {
                                      action({ type: "playDev", card });
                                      setPanel(null);
                                    }}
                                  >
                                    Play
                                  </button>
                                ) : card === "monopoly" ? (
                                  <div>
                                    <select
                                      value={devChoice}
                                      onChange={(e) =>
                                        setDevChoice(e.target.value as Resource)
                                      }
                                    >
                                      {RESOURCES.map((r) => (
                                        <option key={r} value={r}>
                                          {labels[r]}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() =>
                                        action({
                                          type: "playDev",
                                          card,
                                          resource: devChoice,
                                        })
                                      }
                                    >
                                      Play
                                    </button>
                                  </div>
                                ) : card === "yearOfPlenty" ? (
                                  <div>
                                    <select
                                      value={r1}
                                      onChange={(e) =>
                                        setR1(e.target.value as Resource)
                                      }
                                    >
                                      {RESOURCES.map((r) => (
                                        <option key={r} value={r}>
                                          {labels[r]}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={r2}
                                      onChange={(e) =>
                                        setR2(e.target.value as Resource)
                                      }
                                    >
                                      {RESOURCES.map((r) => (
                                        <option key={r} value={r}>
                                          {labels[r]}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() =>
                                        action({
                                          type: "playDev",
                                          card,
                                          r1,
                                          r2,
                                        })
                                      }
                                    >
                                      Play
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setDevRoad(true);
                                      setTool("road");
                                      setPanel(null);
                                    }}
                                  >
                                    Choose roads
                                  </button>
                                )}
                              </div>
                            ))
                        )}
                        {me.dev.filter((c) => c === "victory").length > 0 && (
                          <p className="private-points">
                            You hold{" "}
                            {me.dev.filter((c) => c === "victory").length}{" "}
                            hidden victory point card(s).
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
}
function bagText(b: ResourceBag) {
  return (
    RESOURCES.filter((r) => b[r])
      .map((r) => `${b[r]} ${labels[r]}`)
      .join(", ") || "nothing"
  );
}
function BagPicker({
  title,
  bag,
  setBag,
}: {
  title: string;
  bag: ResourceBag;
  setBag: (b: ResourceBag) => void;
}) {
  return (
    <div className="bag-picker">
      <label>{title}</label>
      <div>
        {RESOURCES.map((r) => (
          <span key={r}>
            {labels[r]}
            <input
              type="number"
              min="0"
              max="20"
              value={bag[r]}
              onChange={(e) =>
                setBag({
                  ...bag,
                  [r]: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </span>
        ))}
      </div>
    </div>
  );
}
function Discard({
  me,
  action,
}: {
  me: Game["players"][number];
  action: (a: Action) => void;
}) {
  const [bag, setBag] = useState<ResourceBag>(emptyBag());
  const need = Math.floor(
    RESOURCES.reduce((n, r) => n + me.resources[r], 0) / 2,
  );
  return (
    <div className="discard">
      <h3>The robber strikes.</h3>
      <p>Discard {need} resource cards.</p>
      <BagPicker title="Cards to discard" bag={bag} setBag={setBag} />
      <button
        className="button primary wide"
        onClick={() => action({ type: "discard", bag })}
      >
        Discard {need} cards
      </button>
    </div>
  );
}
function Board({
  g,
  tool,
  legal,
  onClick,
  me,
}: {
  g: Game;
  tool: string | null;
  legal: number[];
  onClick: (type: "hex" | "edge" | "vertex", n: number) => void;
  me: string;
}) {
  const scale = 72;
  const coords = g.hexes.map(view);
  const allX = coords.map((p) => p.x),
    allY = coords.map((p) => p.y);
  const minX = Math.min(...allX) - 100,
    maxX = Math.max(...allX) + 100,
    minY = Math.min(...allY) - 100,
    maxY = Math.max(...allY) + 100;
  return (
    <div className="board-wrap">
      <svg
        className="board"
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        role="img"
        aria-label="Interactive island board"
      >
        <defs>
          {Object.entries(terrainColors).map(([t, c]) => (
            <linearGradient
              key={t}
              id={"terrain-" + t}
              x1="0"
              y1="0"
              x2=".85"
              y2="1"
            >
              <stop stopColor={c[0]} />
              <stop offset="1" stopColor={c[1]} />
            </linearGradient>
          ))}
          <pattern
            id="sea"
            width="38"
            height="38"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 20 Q10 13 20 20 T40 20"
              fill="none"
              stroke="#6693a0"
              strokeOpacity=".12"
              strokeWidth="2"
            />
          </pattern>
          <filter id="shadow">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="3"
              floodColor="#0d3036"
              floodOpacity=".3"
            />
          </filter>
        </defs>
        <rect
          x={minX}
          y={minY}
          width={maxX - minX}
          height={maxY - minY}
          fill="#2d6872"
        />
        <rect
          x={minX}
          y={minY}
          width={maxX - minX}
          height={maxY - minY}
          fill="url(#sea)"
        />
        {g.hexes.map((h, i) => {
          const { x, y } = coords[i],
            color = terrainColors[h.terrain];
          return (
            <g
              key={i}
              onClick={() => onClick("hex", i)}
              className={
                tool === "robber" && g.robber !== i ? "clickable-hex" : ""
              }
            >
              <polygon
                points={hexPoints(x, y, scale - 2)}
                fill={`url(#terrain-${h.terrain})`}
                stroke="#e4d0a6"
                strokeWidth="4"
                filter="url(#shadow)"
              />
              <polygon
                points={hexPoints(x, y, scale - 10)}
                fill="none"
                stroke={color[0]}
                strokeOpacity=".55"
                strokeWidth="1"
              />
              <text
                x={x}
                y={y + 14}
                textAnchor="middle"
                fill="#fff"
                fontSize="46"
                opacity=".22"
              >
                {h.terrain === "desert" ? "☀" : icons[h.terrain]}
              </text>
              <text
                x={x}
                y={y - 29}
                textAnchor="middle"
                fill="#fff8e7"
                fontSize="9"
                fontWeight="700"
                letterSpacing="2"
              >
                {h.terrain.toUpperCase()}
              </text>
              {h.number && (
                <>
                  <circle
                    cx={x}
                    cy={y + 9}
                    r="21"
                    fill="#f5e8c9"
                    stroke="#bfa77f"
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={y + 16}
                    textAnchor="middle"
                    fill={[6, 8].includes(h.number) ? "#ad4c3c" : "#544d3d"}
                    fontSize="22"
                    fontWeight="700"
                  >
                    {h.number}
                  </text>
                  <g fill="#a45443">
                    {Array.from(
                      { length: 6 - Math.abs(7 - (h.number || 7)) },
                      (_, j) => (
                        <circle
                          key={j}
                          cx={
                            x -
                            (5 - Math.abs(7 - (h.number || 7))) * 2.4 +
                            j * 4.8
                          }
                          cy={y + 24}
                          r="1"
                        />
                      ),
                    )}
                  </g>
                </>
              )}
              {g.robber === i && (
                <g>
                  <circle
                    cx={x + 34}
                    cy={y - 18}
                    r="14"
                    fill="#293e44"
                    stroke="#f4e8cc"
                    strokeWidth="2"
                  />
                  <text
                    x={x + 34}
                    y={y - 13}
                    textAnchor="middle"
                    fill="white"
                    fontSize="13"
                  >
                    ♟
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {g.edges.map((e, i) => {
          const a = g.vertices[e.a],
            b = g.vertices[e.b],
            owner = g.players.find((p) => p.id === e.owner),
            target = tool === "road" && legal.includes(i);
          return (
            <g
              key={i}
              onClick={() => onClick("edge", i)}
              className={target ? "board-target" : ""}
            >
              <line
                x1={a.x * scale}
                y1={a.y * scale}
                x2={b.x * scale}
                y2={b.y * scale}
                stroke="transparent"
                strokeWidth="20"
              />
              {owner && (
                <line
                  x1={a.x * scale}
                  y1={a.y * scale}
                  x2={b.x * scale}
                  y2={b.y * scale}
                  stroke={owner.color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  className="built-road"
                />
              )}
              {target && (
                <line
                  x1={a.x * scale}
                  y1={a.y * scale}
                  x2={b.x * scale}
                  y2={b.y * scale}
                  stroke="#f6e5a1"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="10 6"
                  className="target-road"
                />
              )}
            </g>
          );
        })}
        {g.vertices.map((v, i) => {
          const owner = g.players.find(
              (p) => p.settlements.includes(i) || p.cities.includes(i),
            ),
            city = owner?.cities.includes(i),
            target =
              (tool === "settlement" || tool === "city") && legal.includes(i);
          return (
            <g
              key={i}
              onClick={() => onClick("vertex", i)}
              className={target ? "board-target" : ""}
            >
              {v.port && (
                <>
                  <circle
                    cx={v.x * scale}
                    cy={v.y * scale}
                    r="16"
                    fill="#234e57"
                    stroke="#e5cc93"
                    strokeWidth="2"
                  />
                  <text
                    x={v.x * scale}
                    y={v.y * scale + 4}
                    textAnchor="middle"
                    fill="#f6e9c9"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {v.port === "any" ? "3:1" : "2:1"}
                  </text>
                </>
              )}
              {owner && (
                <g>
                  <circle
                    cx={v.x * scale}
                    cy={v.y * scale}
                    r={city ? 15 : 12}
                    fill={owner.color}
                    stroke="#fff7df"
                    strokeWidth="3"
                    filter="url(#shadow)"
                  />
                  <text
                    x={v.x * scale}
                    y={v.y * scale + 5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={city ? 16 : 14}
                    fontWeight="bold"
                  >
                    {city ? "◆" : "⌂"}
                  </text>
                </g>
              )}
              {target && (
                <circle
                  cx={v.x * scale}
                  cy={v.y * scale}
                  r="11"
                  fill="#fff5c8"
                  stroke="#dcac65"
                  strokeWidth="3"
                  className="target-vertex"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
function Rules({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState("overview");
  const sections = [
    ["overview", "The aim"],
    ["setup", "Set up"],
    ["turn", "Your turn"],
    ["building", "Building"],
    ["trade", "Trading"],
    ["robber", "The robber"],
    ["cards", "Development"],
    ["awards", "Awards & winning"],
    ["extended", "5–8 players"],
  ];
  return (
    <div className="rules-back" onClick={onClose}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-top">
          <div>
            <span className="eyebrow">FIELD GUIDE</span>
            <h2>How to play.</h2>
          </div>
          <button onClick={onClose}>
            <X size={23} />
          </button>
        </div>
        <div className="rules-body">
          <nav>
            {sections.map(([id, label]) => (
              <button
                key={id}
                className={section === id ? "active" : ""}
                onClick={() => setSection(id)}
              >
                {label}
                <ChevronRight size={15} />
              </button>
            ))}
          </nav>
          <article>
            {section === "overview" && (
              <>
                <h3>Build a life on the island.</h3>
                <p>
                  Be the first player to reach{" "}
                  <strong>10 victory points</strong> on your turn. You earn
                  points by building settlements and cities, holding the Longest
                  Road or Largest Army award, and drawing victory point
                  development cards.
                </p>
                <p>
                  The island produces lumber, brick, wool, grain, and ore. Your
                  buildings collect resources when adjacent number tokens are
                  rolled. Use those resources to trade, expand, and win.
                </p>
                <div className="rule-callout">
                  A settlement earns 1 point. A city earns 2. Each award is
                  worth 2.
                </div>
              </>
            )}
            {section === "setup" && (
              <>
                <h3>Find your footing.</h3>
                <p>
                  Players place one settlement and one adjoining road in order,
                  then place a second settlement and road in reverse order. The
                  second settlement immediately collects one resource from each
                  adjacent producing hex.
                </p>
                <p>
                  Settlements must be at least two intersections apart. During
                  opening placement, a settlement does not need a road
                  connection.
                </p>
              </>
            )}
            {section === "turn" && (
              <>
                <h3>Roll, trade, build.</h3>
                <p>
                  At the start of your turn, roll two dice. Every hex with the
                  rolled number produces its resource for each adjacent
                  settlement, or two for each city. A hex blocked by the robber
                  produces nothing.
                </p>
                <p>
                  Then trade and build as many times as your resources allow.
                  You may play one development card acquired on an earlier turn,
                  before rolling or during your action phase. End your turn to
                  pass play clockwise.
                </p>
              </>
            )}
            {section === "building" && (
              <>
                <h3>Make your mark.</h3>
                <div className="cost-list">
                  {Object.entries(COSTS).map(([key, bag]) => (
                    <div key={key}>
                      <strong>
                        {key === "development" ? "Development card" : key}
                      </strong>
                      <span>{bagText(bag)}</span>
                    </div>
                  ))}
                </div>
                <p>
                  Roads connect to your own roads or buildings. A new settlement
                  must connect to your road and be at least two intersections
                  from any other settlement or city. Cities replace your
                  settlements and double production.
                </p>
                <p>Each player has 15 roads, 5 settlements, and 4 cities.</p>
              </>
            )}
            {section === "trade" && (
              <>
                <h3>Good deals travel far.</h3>
                <p>
                  On your turn, offer resources to other players. The player
                  accepting must have the requested cards, and both sides
                  exchange at once.
                </p>
                <p>
                  You can also trade with the bank. The normal rate is four of
                  one resource for one of another. A 3:1 harbor lets you trade
                  any resource at 3:1; a resource harbor lets you trade that
                  resource at 2:1. Own a building at the harbor to use it.
                </p>
              </>
            )}
            {section === "robber" && (
              <>
                <h3>When a seven appears.</h3>
                <p>
                  Everyone holding more than seven resource cards discards half,
                  rounded down. After all discards, the player who rolled moves
                  the robber to a different hex and steals one random card from
                  an opponent with a building beside it.
                </p>
                <p>
                  A Knight development card also moves the robber and counts
                  toward Largest Army.
                </p>
              </>
            )}
            {section === "cards" && (
              <>
                <h3>Keep something up your sleeve.</h3>
                <p>
                  Pay one wool, one grain, and one ore to buy a development
                  card. You cannot play an action card on the turn you bought
                  it, and you can play only one development card per turn.
                </p>
                <ul>
                  <li>
                    <strong>Knight</strong> moves the robber and may steal.
                  </li>
                  <li>
                    <strong>Road Building</strong> places up to two free roads.
                  </li>
                  <li>
                    <strong>Year of Plenty</strong> takes two resources from the
                    bank.
                  </li>
                  <li>
                    <strong>Monopoly</strong> takes all of one resource from
                    other players.
                  </li>
                  <li>
                    <strong>Victory point</strong> stays secret until the game
                    ends.
                  </li>
                </ul>
              </>
            )}
            {section === "awards" && (
              <>
                <h3>A little glory helps.</h3>
                <p>
                  The first player to play three Knights takes Largest Army,
                  worth 2 points. Another player takes it only by playing more
                  Knights.
                </p>
                <p>
                  The first player to build a continuous road of at least five
                  segments takes Longest Road, worth 2 points. Opponents'
                  buildings break a route; branches count only along one path.
                  Another player must build a longer route to take it.
                </p>
                <p>Reach 10 points during your turn to win.</p>
              </>
            )}
            {section === "extended" && (
              <>
                <h3>More friends, more island.</h3>
                <p>
                  Games with five or more players use a larger island and a
                  24-card supply of each resource. Seven and eight seats are a
                  house extension, since the published Catan game ends at six
                  players.
                </p>
                <p>
                  For five or more players, each turn has a production and
                  action phase for the active player, then a paired action phase
                  for the player two seats to their left. The paired player may
                  build, buy or play development cards, and trade with the bank,
                  but may not trade with players. Afterward, the next clockwise
                  player rolls. The win target stays at 10 points.
                </p>
                <a
                  href="https://www.catan.com/understand-catan/game-rules"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official Catan rulebooks <ExternalLink size={15} />
                </a>
              </>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={client}>
    <App />
  </ConvexProvider>,
);
