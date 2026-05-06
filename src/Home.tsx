import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import "./App.css";

type Position = "ATA" | "MC" | "LD" | "LE" | "ZAG" | "GOL";
type PlayerStatus = "DISPONIVEL" | "COMPRADO";
type NoticeType = "success" | "error" | "info";

type Player = {
  id: number;
  nome: string;
  valor: number;
  rating: number;
  posicao: Position;
  status: PlayerStatus;
  clube_id: number | null;
  liga?: string;
};

type ApiPlayer = Partial<Player> & {
  name?: string;
  value?: number;
  preco?: number;
  available?: boolean;
  league?: string;
};

type ClubPlayer = {
  id: number;
  player_id: number;
  purchase_price: number;
  joined_at: string;
};

type Club = {
  id: number;
  name: string;
  image_url?: string | null;
  league: string;
  budget: number;
  player_count: number;
  player_ids: number[];
  players?: ClubPlayer[];
};

type ApiClub = Partial<Club> & {
  nome?: string;
};

type Game = {
  id: string;
  times: Record<string, number>;
};

type Notice = {
  type: NoticeType;
  text: string;
};

type ClubForm = {
  name: string;
  league: string;
  budget: string;
  image_url: string;
};

type MatchTeam = {
  id: number;
  name: string;
  imageUrl?: string | null;
  players: Player[];
  rating: number;
  attack: number;
  midfield: number;
  defense: number;
  keeper: number;
};

type MatchEventKind = "whistle" | "chance" | "save" | "goal" | "drama";
type MatchSide = "home" | "away";

type MatchEvent = {
  id: string;
  minute: number;
  kind: MatchEventKind;
  side?: MatchSide;
  player?: Player;
  assister?: Player;
  probability?: number;
  title: string;
  detail: string;
};

type MatchSimulation = {
  id: string;
  home: MatchTeam;
  away: MatchTeam;
  homeGoals: number;
  awayGoals: number;
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeXg: number;
  awayXg: number;
  stoppageMinutes: number;
  finalMinute: number;
  events: MatchEvent[];
};

type MatchModalState = {
  simulation: MatchSimulation;
  progress: number;
  status: "running" | "saving" | "done" | "error";
  error?: string;
};

const POSITIONS: Position[] = ["GOL", "LE", "ZAG", "LD", "MC", "ATA"];
const PLAYER_STATUS_FILTERS = ["TODOS", "DISPONIVEL", "COMPRADO"] as const;
// const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const FORMATION_SLOTS = [
  { id: "pe", label: "ATA", line: "Ataque", number: 11, positions: ["ATA"], x: 21, y: 17 },
  { id: "ata", label: "ATA", line: "Ataque", number: 9, positions: ["ATA"], x: 50, y: 14 },
  { id: "pd", label: "ATA", line: "Ataque", number: 7, positions: ["ATA"], x: 79, y: 17 },
  { id: "mc1", label: "MC", line: "Meio", number: 8, positions: ["MC"], x: 25, y: 40 },
  { id: "mc2", label: "MC", line: "Meio", number: 10, positions: ["MC"], x: 50, y: 44 },
  { id: "mc3", label: "MC", line: "Meio", number: 20, positions: ["MC"], x: 75, y: 40 },
  { id: "le", label: "LE", line: "Defesa", number: 6, positions: ["LE"], x: 15, y: 66 },
  { id: "zag1", label: "ZAG", line: "Defesa", number: 4, positions: ["ZAG"], x: 38, y: 68 },
  { id: "zag2", label: "ZAG", line: "Defesa", number: 3, positions: ["ZAG"], x: 62, y: 68 },
  { id: "ld", label: "LD", line: "Defesa", number: 2, positions: ["LD"], x: 85, y: 66 },
  { id: "gol", label: "GOL", line: "Gol", number: 1, positions: ["GOL"], x: 50, y: 89 },
] as const;

type FormationSlot = (typeof FORMATION_SLOTS)[number];
type SlotId = FormationSlot["id"];
type LineupState = Record<SlotId, number | null>;

const DEFAULT_LEAGUES = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Brasileirao Serie A",
  "Primeira Liga",
];

function createEmptyLineup(): LineupState {
  return FORMATION_SLOTS.reduce((lineup, slot) => {
    lineup[slot.id] = null;
    return lineup;
  }, {} as LineupState);
}

function apiUrl(path: string) {
  // return `${API_BASE_URL}${path}`;
  return path; // Assuming a proxy is set up for development, we can use relative paths to avoid CORS issues and simplify deployment.
}

function normalizePlayer(raw: ApiPlayer): Player {
  const rawPosition = String(raw.posicao ?? "").toUpperCase();
  const normalizedPosition = rawPosition === "PE" || rawPosition === "PD" ? "ATA" : rawPosition;
  const posicao = POSITIONS.includes(normalizedPosition as Position)
    ? (normalizedPosition as Position)
    : "ATA";
  const rawStatus =
    raw.status ?? (raw.available === false ? "COMPRADO" : ("DISPONIVEL" as PlayerStatus));

  return {
    id: Number(raw.id ?? 0),
    nome: String(raw.nome ?? raw.name ?? `Jogador ${raw.id ?? ""}`).trim(),
    valor: Number(raw.valor ?? raw.preco ?? raw.value ?? 0),
    rating: Number(raw.rating ?? 0),
    posicao,
    status: rawStatus === "COMPRADO" ? "COMPRADO" : "DISPONIVEL",
    clube_id: raw.clube_id ?? null,
    liga: raw.liga ?? raw.league,
  };
}

function normalizeClub(raw: ApiClub): Club {
  const players = raw.players ?? [];
  const playerIds = raw.player_ids ?? players.map((player) => player.player_id);

  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? raw.nome ?? `Clube ${raw.id ?? ""}`).trim(),
    image_url: raw.image_url ?? null,
    league: String(raw.league ?? ""),
    budget: Number(raw.budget ?? 0),
    player_count: Number(raw.player_count ?? playerIds.length),
    player_ids: playerIds.map(Number),
    players,
  };
}

function extractApiError(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string") {
      return record.error;
    }
    if (typeof record.detail === "string") {
      return record.detail;
    }
  }

  return fallback;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), { ...options, headers });
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(extractApiError(payload, response.statusText));
  }

  return payload as T;
}

function formatValue(value: number) {
  if (value >= 1000) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return `${value.toLocaleString("pt-BR")} mi`;
}

function averageRating(players: Player[]) {
  if (players.length === 0) {
    return 0;
  }

  const total = players.reduce((sum, player) => sum + player.rating, 0);
  return Math.round(total / players.length);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function poissonSample(lambda: number) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let goals = 0;

  do {
    goals++;
    product *= Math.random();
  } while (product > limit);

  return goals - 1;
}

function positionGoalWeight(position: Position) {
  const weights: Record<Position, number> = {
    ATA: 7,
    MC: 3.9,
    LD: 1.8,
    LE: 1.8,
    ZAG: 1.3,
    GOL: 0.04,
  };

  return weights[position];
}

function weightedChoice<T>(items: T[], weight: (item: T) => number) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);

  if (total <= 0) {
    return items[randomInt(0, Math.max(0, items.length - 1))];
  }

  let cursor = Math.random() * total;

  for (const item of items) {
    cursor -= Math.max(0, weight(item));
    if (cursor <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function playerWeight(player: Player) {
  return positionGoalWeight(player.posicao) * Math.max(8, player.rating - 52);
}

function averagePositionRating(players: Player[], positions: Position[], fallback: number) {
  const selected = players.filter((player) => positions.includes(player.posicao));
  return selected.length > 0 ? averageRating(selected) : fallback;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function syntheticPlayer(clubName: string, slot: FormationSlot, index: number, baseRating: number): Player {
  const position = slot.label as Position;
  const rating = Math.round(clampNumber(baseRating + randomFloat(-5, 5), 62, 88));

  return {
    id: -1000 - index,
    nome: `${clubName} ${slot.label} ${index + 1}`,
    valor: rating,
    rating,
    posicao: position,
    status: "COMPRADO",
    clube_id: null,
  };
}

function buildFormationSquad(roster: Player[], clubName: string, baseRating: number) {
  const usedIds = new Set<number>();

  return FORMATION_SLOTS.map((slot, index) => {
    const picked = roster
      .filter((player) => (slot.positions as readonly Position[]).includes(player.posicao))
      .filter((player) => !usedIds.has(player.id))
      .sort((a, b) => b.rating - a.rating || a.nome.localeCompare(b.nome))[0];

    if (picked) {
      usedIds.add(picked.id);
      return picked;
    }

    return syntheticPlayer(clubName, slot, index, baseRating);
  });
}

function buildMatchTeam(club: Club, squad: Player[], fallbackRating: number): MatchTeam {
  const rating = averageRating(squad) || fallbackRating;

  return {
    id: club.id,
    name: club.name,
    imageUrl: club.image_url,
    players: squad,
    rating,
    attack: averagePositionRating(squad, ["ATA"], rating),
    midfield: averagePositionRating(squad, ["MC"], rating),
    defense: averagePositionRating(squad, ["LD", "LE", "ZAG"], rating),
    keeper: averagePositionRating(squad, ["GOL"], rating),
  };
}

function teamExpectedGoals(team: MatchTeam, opponent: MatchTeam) {
  const ratingEdge = team.rating - opponent.rating;
  const attackEdge = team.attack - opponent.defense;
  const midfieldEdge = team.midfield - opponent.midfield;
  const keeperWall = opponent.keeper - 78;
  const chaos = randomFloat(-0.36, 0.42);

  return clampNumber(
    1.12 + ratingEdge * 0.01 + attackEdge * 0.024 + midfieldEdge * 0.01 - keeperWall * 0.008 + chaos,
    0.28,
    3.15,
  );
}

function softenScore(homeGoals: number, awayGoals: number) {
  let home = Math.min(5, homeGoals);
  let away = Math.min(5, awayGoals);

  while (home + away > 7) {
    if (home > away || (home === away && Math.random() > 0.5)) {
      home--;
    } else {
      away--;
    }
  }

  return { home, away };
}

function goalProbability(team: MatchTeam, opponent: MatchTeam, player: Player) {
  const raw =
    9 +
    positionGoalWeight(player.posicao) * 1.7 +
    (player.rating - 74) * 0.55 +
    (team.attack - opponent.defense) * 0.35 +
    randomFloat(0, 8);

  return Math.round(clampNumber(raw, 5, 48));
}

function pickScorer(team: MatchTeam) {
  const outfield = team.players.filter((player) => player.posicao !== "GOL");
  return weightedChoice(outfield.length > 0 ? outfield : team.players, playerWeight);
}

function pickAssister(team: MatchTeam, scorer: Player) {
  const options = team.players.filter((player) => player.id !== scorer.id && player.posicao !== "GOL");

  if (options.length === 0 || Math.random() < 0.24) {
    return undefined;
  }

  return weightedChoice(options, (player) => {
    const positionBoost = player.posicao === "MC" ? 5 : positionGoalWeight(player.posicao);
    return positionBoost * Math.max(8, player.rating - 55);
  });
}

function minuteLabel(minute: number) {
  return minute > 90 ? `90+${minute - 90}'` : `${minute}'`;
}

function uniqueMinute(usedMinutes: Set<number>, finalMinute: number) {
  let minute = randomInt(3, finalMinute);
  let attempts = 0;

  while (usedMinutes.has(minute) && attempts < 30) {
    minute = clampNumber(minute + randomInt(1, 4), 3, finalMinute);
    attempts++;
  }

  usedMinutes.add(minute);
  return minute;
}

function createGoalEvent(
  side: MatchSide,
  team: MatchTeam,
  opponent: MatchTeam,
  minute: number,
  index: number,
): MatchEvent {
  const scorer = pickScorer(team);
  const assister = pickAssister(team, scorer);
  const probability = goalProbability(team, opponent, scorer);

  return {
    id: `${side}-goal-${minute}-${index}`,
    minute,
    kind: "goal",
    side,
    player: scorer,
    assister,
    probability,
    title: `GOL - ${scorer.nome}`,
    detail: `${scorer.posicao} OVR ${scorer.rating} | chance ${probability}%${
      assister ? ` | passe de ${assister.nome}` : ""
    }`,
  };
}

function createChanceEvent(side: MatchSide, team: MatchTeam, opponent: MatchTeam, minute: number, index: number) {
  const player = pickScorer(team);
  const probability = goalProbability(team, opponent, player);
  const saved = Math.random() < 0.42;

  return {
    id: `${side}-chance-${minute}-${index}`,
    minute,
    kind: saved ? "save" : "chance",
    side,
    player,
    probability,
    title: saved ? `Defesa grande em chute de ${player.nome}` : `${player.nome} quase marcou`,
    detail: `${player.posicao} OVR ${player.rating} | chance ${probability}%`,
  } satisfies MatchEvent;
}

function createDramaEvent(home: MatchTeam, away: MatchTeam, minute: number, index: number): MatchEvent {
  const homePressure = home.midfield + randomFloat(-7, 7);
  const side: MatchSide = homePressure >= away.midfield ? "home" : "away";
  const team = side === "home" ? home : away;
  const player = weightedChoice(team.players, (candidate) =>
    candidate.posicao === "MC" ? candidate.rating * 4 : candidate.rating,
  );

  return {
    id: `drama-${minute}-${index}`,
    minute,
    kind: "drama",
    side,
    player,
    title: `${team.name} aperta o ritmo`,
    detail: `${player.nome} controla o lance pelo meio com OVR ${player.rating}`,
  };
}

function createMatchEvents(home: MatchTeam, away: MatchTeam, homeGoals: number, awayGoals: number, finalMinute: number) {
  const usedMinutes = new Set<number>();
  const events: MatchEvent[] = [
    {
      id: "kickoff",
      minute: 1,
      kind: "whistle",
      title: "Bola rolando",
      detail: "Os dois escudos entram no choque.",
    },
    {
      id: "halftime",
      minute: 45,
      kind: "whistle",
      title: "Intervalo",
      detail: "Ajustes, agua e mais dez segundos de caos organizado.",
    },
  ];

  for (let index = 0; index < homeGoals; index++) {
    events.push(createGoalEvent("home", home, away, uniqueMinute(usedMinutes, finalMinute), index));
  }

  for (let index = 0; index < awayGoals; index++) {
    events.push(createGoalEvent("away", away, home, uniqueMinute(usedMinutes, finalMinute), index));
  }

  const extraEvents = randomInt(7, 11);
  const homeThreat = Math.max(1, home.attack + home.midfield * 0.4);
  const awayThreat = Math.max(1, away.attack + away.midfield * 0.4);

  for (let index = 0; index < extraEvents; index++) {
    const minute = uniqueMinute(usedMinutes, finalMinute);
    const homeEvent = Math.random() < homeThreat / (homeThreat + awayThreat);
    const side: MatchSide = homeEvent ? "home" : "away";
    const team = homeEvent ? home : away;
    const opponent = homeEvent ? away : home;

    events.push(
      Math.random() < 0.72
        ? createChanceEvent(side, team, opponent, minute, index)
        : createDramaEvent(home, away, minute, index),
    );
  }

  return events.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
}

function scoreAtMinute(simulation: MatchSimulation, minute: number) {
  return simulation.events.reduce(
    (score, event) => {
      if (event.kind === "goal" && event.minute <= minute) {
        if (event.side === "home") {
          score.home++;
        } else if (event.side === "away") {
          score.away++;
        }
      }

      return score;
    },
    { home: 0, away: 0 },
  );
}

function currentMatchMinute(simulation: MatchSimulation, progress: number) {
  return Math.max(1, Math.round(simulation.finalMinute * progress));
}

function isShotEvent(event: MatchEvent) {
  return event.kind === "goal" || event.kind === "chance" || event.kind === "save";
}

function simulateMatch(home: MatchTeam, away: MatchTeam): MatchSimulation {
  const homeExpected = teamExpectedGoals(home, away);
  const awayExpected = teamExpectedGoals(away, home);
  const rawHomeGoals = poissonSample(homeExpected);
  const rawAwayGoals = poissonSample(awayExpected);
  const score = softenScore(rawHomeGoals, rawAwayGoals);
  const stoppageMinutes = randomInt(1, 7);
  const finalMinute = 90 + stoppageMinutes;
  const homePossession = Math.round(
    clampNumber(50 + (home.midfield - away.midfield) * 0.7 + randomFloat(-8, 8), 34, 66),
  );
  const homeShots = Math.max(score.home + 3, Math.round(homeExpected * 4 + randomInt(2, 7)));
  const awayShots = Math.max(score.away + 3, Math.round(awayExpected * 4 + randomInt(2, 7)));
  const homeXg = Number((homeExpected + score.home * 0.14 + randomFloat(-0.18, 0.22)).toFixed(2));
  const awayXg = Number((awayExpected + score.away * 0.14 + randomFloat(-0.18, 0.22)).toFixed(2));

  return {
    id: `match-${Date.now()}-${randomInt(1000, 9999)}`,
    home,
    away,
    homeGoals: score.home,
    awayGoals: score.away,
    homePossession,
    homeShots,
    awayShots,
    homeXg,
    awayXg,
    stoppageMinutes,
    finalMinute,
    events: createMatchEvents(home, away, score.home, score.away, finalMinute),
  };
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [leagues, setLeagues] = useState<string[]>(DEFAULT_LEAGUES);
  const [selectedClubId, setSelectedClubId] = useState<number | "">("");
  const [opponentClubId, setOpponentClubId] = useState<number | "">("");
  const [lineup, setLineup] = useState<LineupState>(createEmptyLineup);
  const [clubForm, setClubForm] = useState<ClubForm>({
    name: "",
    league: DEFAULT_LEAGUES[0],
    budget: "10000000",
    image_url: "",
  });
  const [editingClubId, setEditingClubId] = useState<number | null>(null);
  const [marketQuery, setMarketQuery] = useState("");
  const [marketPosition, setMarketPosition] = useState<Position | "TODAS">("TODAS");
  const [marketStatus, setMarketStatus] =
    useState<(typeof PLAYER_STATUS_FILTERS)[number]>("TODOS");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [matchModal, setMatchModal] = useState<MatchModalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedMatchIdsRef = useRef(new Set<string>());
  const clubLineupsRef = useRef<Record<number, LineupState>>({});

  const loadDashboard = useCallback(async (quiet = false) => {
    const [playersResult, clubsResult, leaguesResult, gamesResult] = await Promise.allSettled([
      apiFetch<ApiPlayer[]>("/jogador/jogadores"),
      apiFetch<ApiClub[]>("/clube/get"),
      apiFetch<{ leagues: string[] }>("/clube/leagues"),
      apiFetch<Game[]>("/jogos/"),
    ]);

    const failures: string[] = [];

    if (playersResult.status === "fulfilled") {
      setPlayers(playersResult.value.map(normalizePlayer).filter((player) => player.id > 0));
    } else {
      failures.push("jogadores");
    }

    if (clubsResult.status === "fulfilled") {
      const normalizedClubs = clubsResult.value.map(normalizeClub).filter((club) => club.id > 0);
      setClubs(normalizedClubs);

      setSelectedClubId((currentClubId) => {
        if (
          currentClubId !== "" &&
          !normalizedClubs.some((club) => club.id === currentClubId)
        ) {
          setOpponentClubId("");
          setLineup(createEmptyLineup());
          return "";
        }

        return currentClubId;
      });
    } else {
      failures.push("clubes");
    }

    if (leaguesResult.status === "fulfilled" && leaguesResult.value.leagues.length > 0) {
      setLeagues(leaguesResult.value.leagues);
    } else if (leaguesResult.status === "rejected") {
      failures.push("ligas");
    }

    if (gamesResult.status === "fulfilled") {
      setGames(gamesResult.value);
    } else {
      failures.push("jogos");
    }

    if (failures.length > 0 && !quiet) {
      setNotice({
        type: "error",
        text: `Nao consegui carregar: ${failures.join(", ")}. Confere se a API da AWS esta acessivel.`,
      });
    }

    if (!quiet) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  useEffect(() => {
    if (typeof selectedClubId === "number") {
      clubLineupsRef.current[selectedClubId] = lineup;
    }
  }, [lineup, selectedClubId]);

  function selectClub(clubId: number | "") {
    setSelectedClubId(clubId);
    setLineup(
      typeof clubId === "number"
        ? (clubLineupsRef.current[clubId] ?? createEmptyLineup())
        : createEmptyLineup(),
    );
  }

  async function refreshDashboard() {
    setLoading(true);
    await loadDashboard();
  }

  const finishMatch = useCallback(
    async (simulation: MatchSimulation) => {
      if (savedMatchIdsRef.current.has(simulation.id)) {
        return;
      }

      savedMatchIdsRef.current.add(simulation.id);

      try {
        const savedGame = await apiFetch<Game>("/jogos/play", {
          method: "POST",
          body: JSON.stringify({
            time_a: String(simulation.home.id),
            pontos_a: simulation.homeGoals,
            time_b: String(simulation.away.id),
            pontos_b: simulation.awayGoals,
          }),
        });

        setGames((prev: Game[]) => [...prev, savedGame]);
        setMatchModal((current) =>
          current?.simulation.id === simulation.id
            ? { ...current, progress: 1, status: "done" }
            : current,
        );
        setNotice({
          type: "success",
          text: `${simulation.home.name} ${simulation.homeGoals} x ${simulation.awayGoals} ${simulation.away.name}`,
        });
        await loadDashboard(true);
      } catch (error) {
        setMatchModal((current) =>
          current?.simulation.id === simulation.id
            ? {
                ...current,
                progress: 1,
                status: "error",
                error: error instanceof Error ? error.message : "Falha ao registrar jogo.",
              }
            : current,
        );
      } finally {
        setSaving(false);
      }
    },
    [loadDashboard],
  );

  const runningSimulation = matchModal?.status === "running" ? matchModal.simulation : null;

  useEffect(() => {
    if (!runningSimulation) {
      return;
    }

    const durationMs = 10_000;
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setMatchModal((current) => {
        if (!current || current.simulation.id !== runningSimulation.id) {
          return current;
        }

        return {
          ...current,
          progress: clampNumber((Date.now() - startedAt) / durationMs, 0, 1),
        };
      });
    }, 120);

    const timeoutId = window.setTimeout(() => {
      setMatchModal((current) =>
        current?.simulation.id === runningSimulation.id
          ? { ...current, progress: 1, status: "saving" }
          : current,
      );
      void finishMatch(runningSimulation);
    }, durationMs);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [finishMatch, runningSimulation]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) ?? null,
    [clubs, selectedClubId],
  );

  const opponentClub = useMemo(
    () => clubs.find((club) => club.id === opponentClubId) ?? null,
    [clubs, opponentClubId],
  );

  const selectedClubPlayerIds = useMemo(() => {
    const ids = new Set<number>();

    selectedClub?.player_ids.forEach((id) => ids.add(id));
    selectedClub?.players?.forEach((player) => ids.add(player.player_id));

    return ids;
  }, [selectedClub]);

  const selectedClubPlayers = useMemo(() => {
    if (!selectedClub) {
      return players;
    }

    return players.filter(
      (player) => selectedClubPlayerIds.has(player.id) || player.clube_id === selectedClub.id,
    );
  }, [players, selectedClub, selectedClubPlayerIds]);

  const selectedLineupIds = useMemo(() => {
    return new Set(
      Object.values(lineup).filter((playerId): playerId is number => playerId !== null),
    );
  }, [lineup]);

  const lineupPlayers = useMemo(() => {
    return Object.values(lineup)
      .map((playerId) => players.find((player) => player.id === playerId))
      .filter((player): player is Player => Boolean(player));
  }, [lineup, players]);

  const opponentPlayers = useMemo(() => {
    if (!opponentClub) {
      return [];
    }

    const opponentIds = new Set(opponentClub.player_ids);
    opponentClub.players?.forEach((player) => opponentIds.add(player.player_id));

    return players.filter(
      (player) => opponentIds.has(player.id) || player.clube_id === opponentClub.id,
    );
  }, [opponentClub, players]);

  const teamRating = averageRating(lineupPlayers);
  const opponentRating = opponentPlayers.length > 0 ? averageRating(opponentPlayers) : 78;
  const selectedSquadCost = lineupPlayers.reduce((sum, player) => sum + player.valor, 0);
  const lineupComplete = FORMATION_SLOTS.every((slot) => lineup[slot.id] !== null);
  const activeMinute = matchModal
    ? currentMatchMinute(matchModal.simulation, matchModal.progress)
    : 1;
  const activeScore = matchModal
    ? scoreAtMinute(matchModal.simulation, activeMinute)
    : { home: 0, away: 0 };
  const visibleMatchEvents = matchModal
    ? matchModal.simulation.events.filter((event) => event.minute <= activeMinute)
    : [];
  const liveMatchStats = matchModal
    ? (() => {
        const simulation = matchModal.simulation;
        const settled = matchModal.status === "done" || matchModal.status === "error";
        const progress = settled ? 1 : matchModal.progress;
        const statProgress = clampNumber(progress + 0.03, 0, 1);
        const visibleHomeShots = visibleMatchEvents.filter(
          (event) => event.side === "home" && isShotEvent(event),
        ).length;
        const visibleAwayShots = visibleMatchEvents.filter(
          (event) => event.side === "away" && isShotEvent(event),
        ).length;
        const homeShots = settled
          ? simulation.homeShots
          : Math.max(activeScore.home, visibleHomeShots, Math.floor(simulation.homeShots * statProgress));
        const awayShots = settled
          ? simulation.awayShots
          : Math.max(activeScore.away, visibleAwayShots, Math.floor(simulation.awayShots * statProgress));
        const homePossession = settled
          ? simulation.homePossession
          : Math.round(
              clampNumber(
                50 + (simulation.homePossession - 50) * clampNumber(progress * 1.35, 0, 1),
                34,
                66,
              ),
            );

        return {
          stoppage: activeMinute >= 90 || settled ? `+${simulation.stoppageMinutes}` : "A definir",
          homePossession,
          awayPossession: 100 - homePossession,
          homeShots,
          awayShots,
          homeXg: (settled
            ? simulation.homeXg
            : Math.max(activeScore.home * 0.18, simulation.homeXg * statProgress)
          ).toFixed(2),
          awayXg: (settled
            ? simulation.awayXg
            : Math.max(activeScore.away * 0.18, simulation.awayXg * statProgress)
          ).toFixed(2),
        };
      })()
    : null;

  const filteredMarketPlayers = useMemo(() => {
    const query = marketQuery.trim().toLowerCase();

    return players
      .filter((player) => {
        const matchesQuery =
          query.length === 0 ||
          player.nome.toLowerCase().includes(query) ||
          player.posicao.toLowerCase().includes(query);
        const matchesPosition =
          marketPosition === "TODAS" ? true : player.posicao === marketPosition;
        const matchesStatus = marketStatus === "TODOS" ? true : player.status === marketStatus;

        return matchesQuery && matchesPosition && matchesStatus;
      })
      .sort((a, b) => b.rating - a.rating || a.nome.localeCompare(b.nome));
  }, [marketPosition, marketQuery, marketStatus, players]);

  function playerById(playerId: number | null) {
    if (playerId === null) {
      return null;
    }

    return players.find((player) => player.id === playerId) ?? null;
  }

  function playersForSlot(slot: FormationSlot) {
    return selectedClubPlayers
      .filter((player) => (slot.positions as readonly Position[]).includes(player.posicao))
      .filter((player) => player.id === lineup[slot.id] || !selectedLineupIds.has(player.id))
      .sort((a, b) => b.rating - a.rating || a.nome.localeCompare(b.nome));
  }

  function resetClubForm() {
    setEditingClubId(null);
    setClubForm({
      name: "",
      league: leagues[0] ?? DEFAULT_LEAGUES[0],
      budget: "10000000",
      image_url: "",
    });
  }

  function startEditingClub(club: Club) {
    setEditingClubId(club.id);
    setClubForm({
      name: club.name,
      league: club.league,
      budget: String(Math.round(club.budget)),
      image_url: club.image_url ?? "",
    });
  }

  async function saveClub() {
    const name = clubForm.name.trim();
    const budget = Number(clubForm.budget);

    if (!name || !clubForm.league || Number.isNaN(budget) || budget < 0) {
      setNotice({ type: "error", text: "Preencha nome, liga e orcamento valido." });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        league: clubForm.league,
        budget,
        ...(clubForm.image_url.trim() ? { image_url: clubForm.image_url.trim() } : {}),
      };

      if (editingClubId === null) {
        const created = normalizeClub(
          await apiFetch<ApiClub>("/clube/create", {
            method: "POST",
            body: JSON.stringify(payload),
          }),
        );
        setSelectedClubId(created.id);
        setNotice({ type: "success", text: `${created.name} criado.` });
      } else {
        await apiFetch<ApiClub>(`/clube/update/${editingClubId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice({ type: "success", text: "Clube atualizado." });
      }

      resetClubForm();
      await loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteClub(clubId: number) {
    setSaving(true);

    try {
      const club = clubs.find((c) => c.id === clubId);
      const clubPlayerIds = new Set<number>();
      club?.player_ids.forEach((id) => clubPlayerIds.add(id));
      club?.players?.forEach((p) => clubPlayerIds.add(p.player_id));

      const clubPlayers = players.filter(
        (p) => clubPlayerIds.has(p.id) || p.clube_id === clubId,
      );

      await Promise.all(
        clubPlayers.map((player) =>
          apiFetch("/clube/sell", {
            method: "POST",
            body: JSON.stringify({ club_id: clubId, player_id: player.id }),
          }),
        ),
      );

      await apiFetch(`/clube/delete/${clubId}`, { method: "DELETE" });

      if (selectedClubId === clubId) {
        setOpponentClubId("");
        selectClub("");
      }
      delete clubLineupsRef.current[clubId];

      setNotice({ type: "success", text: "Clube removido." });
      await loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Falha ao remover." });
    } finally {
      setSaving(false);
    }
  }

  async function buyPlayer(player: Player) {
    if (typeof selectedClubId !== "number") {
      setNotice({ type: "error", text: "Selecione um clube antes de comprar." });
      return;
    }

    setSaving(true);

    try {
      await apiFetch("/clube/buy", {
        method: "POST",
        body: JSON.stringify({ club_id: selectedClubId, player_id: player.id }),
      });
      setNotice({ type: "success", text: `${player.nome} comprado.` });
      await loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Falha na compra." });
    } finally {
      setSaving(false);
    }
  }

  async function sellPlayer(player: Player) {
    if (typeof selectedClubId !== "number") {
      setNotice({ type: "error", text: "Selecione um clube antes de vender." });
      return;
    }

    setSaving(true);

    try {
      await apiFetch("/clube/sell", {
        method: "POST",
        body: JSON.stringify({ club_id: selectedClubId, player_id: player.id }),
      });
      setLineup((current) => {
        const next = { ...current };
        FORMATION_SLOTS.forEach((slot) => {
          if (next[slot.id] === player.id) {
            next[slot.id] = null;
          }
        });
        return next;
      });
      setNotice({ type: "success", text: `${player.nome} vendido.` });
      await loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Falha na venda." });
    } finally {
      setSaving(false);
    }
  }

  function autoFillLineup() {
    if (selectedClubPlayers.length === 0) {
      setNotice({ type: "error", text: "Seu elenco ainda esta vazio." });
      return;
    }

    const usedIds = new Set<number>();
    const nextLineup = createEmptyLineup();

    FORMATION_SLOTS.forEach((slot) => {
      const player = selectedClubPlayers
        .filter((candidate) => (slot.positions as readonly Position[]).includes(candidate.posicao))
        .filter((candidate) => !usedIds.has(candidate.id))
        .sort((a, b) => b.rating - a.rating || a.nome.localeCompare(b.nome))[0];

      if (player) {
        nextLineup[slot.id] = player.id;
        usedIds.add(player.id);
      }
    });

    setLineup(nextLineup);
    setNotice({ type: "info", text: "Escalacao preenchida com os melhores disponiveis." });
  }

  function playMatch() {
    if (typeof selectedClubId !== "number" || typeof opponentClubId !== "number") {
      setNotice({ type: "error", text: "Selecione seu clube e o adversario." });
      return;
    }

    if (selectedClubId === opponentClubId) {
      setNotice({ type: "error", text: "Os dois times devem ser diferentes." });
      return;
    }

    if (!lineupComplete) {
      setNotice({ type: "error", text: "Complete os 11 jogadores da formacao 4-3-3." });
      return;
    }

    if (!selectedClub || !opponentClub) {
      setNotice({ type: "error", text: "Selecione clubes validos para jogar." });
      return;
    }

    setSaving(true);
    setNotice(null);

    const opponentSquad = buildFormationSquad(opponentPlayers, opponentClub.name, opponentRating || 78);
    const home = buildMatchTeam(selectedClub, lineupPlayers, teamRating || 78);
    const away = buildMatchTeam(opponentClub, opponentSquad, opponentRating || 78);
    const simulation = simulateMatch(home, away);

    setMatchModal({ simulation, progress: 0, status: "running" });
  }

  function clubName(clubId: string) {
    return clubs.find((club) => String(club.id) === clubId)?.name ?? `Clube ${clubId}`;
  }

  function playerBelongsToSelectedClub(player: Player) {
    return (
      typeof selectedClubId === "number" &&
      (selectedClubPlayerIds.has(player.id) || player.clube_id === selectedClubId)
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fut Manager</p>
          <h1>FUT MANAGER</h1>
        </div>
        <div className="topbar-stats" aria-label="Resumo dos servicos">
          <Chip label={`${players.length} jogadores`} color="success" variant="outlined" />
          <Chip label={`${clubs.length} clubes`} color="warning" variant="outlined" />
          <Chip label={`${games.length} jogos`} color="primary" variant="outlined" />
        </div>
      </header>

      {notice && (
        <div className={`notice notice-${notice.type}`} role="status">
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">
            x
          </button>
        </div>
      )}

      <section className="manager-grid" aria-busy={loading || saving}>
        <aside className="panel club-panel">
          <div className="panel-heading">
            <p className="eyebrow">Clube</p>
            <h2>{editingClubId === null ? "Criar clube" : "Editar clube"}</h2>
          </div>

          <form
            className="club-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveClub();
            }}
          >
            <label>
              Nome
              <input
                value={clubForm.name}
                onChange={(event) => setClubForm({ ...clubForm, name: event.target.value })}
                placeholder="FC Projeto"
              />
            </label>

            <label>
              Liga
              <select
                value={clubForm.league}
                onChange={(event) => setClubForm({ ...clubForm, league: event.target.value })}
              >
                {leagues.map((league) => (
                  <option key={league} value={league}>
                    {league}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Orcamento
              <input
                type="number"
                min="0"
                value={clubForm.budget}
                onChange={(event) => setClubForm({ ...clubForm, budget: event.target.value })}
              />
            </label>

            <label>
              Escudo URL
              <input
                value={clubForm.image_url}
                onChange={(event) => setClubForm({ ...clubForm, image_url: event.target.value })}
                placeholder="https://..."
              />
            </label>

            <div className="form-actions">
              <Button variant="contained" type="submit" disabled={saving}>
                {editingClubId === null ? "Criar" : "Salvar"}
              </Button>
              {editingClubId !== null && (
                <Button variant="outlined" type="button" onClick={resetClubForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>

          <div className="section-divider" />

          <label className="select-label">
            Seu clube
            <select
              value={selectedClubId}
              onChange={(event) => {
                const value = event.target.value ? Number(event.target.value) : "";
                selectClub(value);
                setOpponentClubId("");
              }}
            >
              <option value="">Selecione</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>

          <div className="club-list">
            {clubs.map((club) => (
              <article
                className={`club-row ${club.id === selectedClubId ? "club-row-active" : ""}`}
                key={club.id}
              >
                <button
                  className="club-main"
                  type="button"
                  onClick={() => selectClub(club.id)}
                >
                  <span className="club-badge">
                    {club.image_url ? <img src={club.image_url} alt="" /> : club.name.slice(0, 2)}
                  </span>
                  <span>
                    <strong>{club.name}</strong>
                    <small>
                      {club.league} | {club.player_count} jogadores
                    </small>
                  </span>
                </button>
                <div className="club-row-actions">
                  <button type="button" onClick={() => startEditingClub(club)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => void deleteClub(club.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="pitch-panel">
          <div className="scoreboard">
            <div>
              <span>Time</span>
              <strong>{selectedClub?.name ?? "Seu XI"}</strong>
            </div>
            <div className="scoreboard-center">
              <strong>{teamRating || "--"}</strong>
              <span>overall</span>
            </div>
            <div>
              <span>Formacao</span>
              <strong>4-3-3 + GOL</strong>
            </div>
          </div>

          <div className="pitch-scroll">
            <div className="pitch" aria-label="Campo com formacao 4-3-3">
              <div className="pitch-line center-circle" />
              <div className="pitch-line box box-top" />
              <div className="pitch-line box box-bottom" />
              <div className="half-line" />

              {FORMATION_SLOTS.map((slot) => {
                const selectedPlayer = playerById(lineup[slot.id]);

                return (
                  <div
                    className="slot"
                    key={slot.id}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  >
                    <div className="shirt" aria-hidden="true">
                      <span>{selectedPlayer?.rating ?? slot.number}</span>
                    </div>
                    <div className="slot-meta">
                      <span>{slot.line}</span>
                      <strong>{slot.label}</strong>
                    </div>
                    <Autocomplete
                      className="slot-select"
                      size="small"
                      options={playersForSlot(slot)}
                      value={selectedPlayer}
                      onChange={(_, player) =>
                        setLineup((current) => ({
                          ...current,
                          [slot.id]: player?.id ?? null,
                        }))
                      }
                      getOptionLabel={(player) =>
                        `${player.nome} | ${player.posicao} | ${player.rating}`
                      }
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      noOptionsText="Sem jogador"
                      renderInput={(params) => (
                        <TextField {...params} label={slot.label} placeholder="Buscar" />
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pitch-actions">
            <Button variant="contained" onClick={autoFillLineup} disabled={saving}>
              Auto escalar
            </Button>
            <Button variant="outlined" onClick={() => setLineup(createEmptyLineup())}>
              Limpar
            </Button>
          </div>
        </section>

        <aside className="panel play-panel">
          <div className="panel-heading">
            <p className="eyebrow">Partida</p>
            <h2>Jogar</h2>
          </div>

          <div className="match-summary">
            <div>
              <span>Elenco</span>
              <strong>{selectedClubPlayers.length}</strong>
            </div>
            <div>
              <span>Escalados</span>
              <strong>{lineupPlayers.length}/11</strong>
            </div>
            <div>
              <span>Valor XI</span>
              <strong>{formatValue(selectedSquadCost)}</strong>
            </div>
          </div>

          <label className="select-label">
            Adversario
            <select
              value={opponentClubId}
              onChange={(event) =>
                setOpponentClubId(event.target.value ? Number(event.target.value) : "")
              }
            >
              <option value="">Selecione</option>
              {clubs
                .filter((club) => club.id !== selectedClubId)
                .map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
            </select>
          </label>

          <div className="rating-vs">
            <div>
              <span>{selectedClub?.name ?? "Seu time"}</span>
              <strong>{teamRating || "--"}</strong>
            </div>
            <span>x</span>
            <div>
              <span>{opponentClub?.name ?? "Adversario"}</span>
              <strong>{opponentClubId === "" ? "--" : opponentRating}</strong>
            </div>
          </div>

          <Button
            className="play-button"
            variant="contained"
            onClick={() => void playMatch()}
            disabled={saving || !lineupComplete || opponentClubId === ""}
          >
            Jogar partida
          </Button>

          <div className="section-divider" />

          <div className="panel-heading compact-heading">
            <p className="eyebrow">Historico</p>
            <h2>Jogos</h2>
          </div>

          <div className="game-list">
            {games.slice(-8).reverse().map((game) => {
              const [homeId, awayId] = Object.keys(game.times);

              return (
                <article className="game-row" key={game.id}>
                  <strong>
                    {clubName(homeId)} {game.times[homeId]} x {game.times[awayId]}{" "}
                    {clubName(awayId)}
                  </strong>
                  <small>{game.id}</small>
                </article>
              );
            })}
          </div>
        </aside>
      </section>

      {matchModal && (
        <div className="match-modal-backdrop" role="dialog" aria-modal="true">
          <section className={`match-modal match-modal-${matchModal.status}`}>
            <header className="match-modal-header">
              <div>
                <p className="eyebrow">Ao vivo</p>
                <h2>
                  {matchModal.simulation.home.name} x {matchModal.simulation.away.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMatchModal(null)}
                disabled={matchModal.status === "running" || matchModal.status === "saving"}
              >
                Fechar
              </button>
            </header>

            <div className="match-arena">
              <div className="match-team">
                <div className="match-orb match-orb-home">
                  {matchModal.simulation.home.imageUrl ? (
                    <img src={matchModal.simulation.home.imageUrl} alt="" />
                  ) : (
                    initials(matchModal.simulation.home.name)
                  )}
                </div>
                <strong>{matchModal.simulation.home.name}</strong>
                <span>OVR {matchModal.simulation.home.rating}</span>
              </div>

              <div className="match-center">
                <div className="live-minute">
                  {matchModal.status === "done" || matchModal.status === "error"
                    ? "FT"
                    : minuteLabel(activeMinute)}
                </div>
                <div className="live-score">
                  <strong>{activeScore.home}</strong>
                  <span>x</span>
                  <strong>{activeScore.away}</strong>
                </div>
                <div className="battle-track">
                  <span className="battle-dot battle-dot-one" />
                  <span className="battle-dot battle-dot-two" />
                  <span className="battle-flash" />
                </div>
              </div>

              <div className="match-team">
                <div className="match-orb match-orb-away">
                  {matchModal.simulation.away.imageUrl ? (
                    <img src={matchModal.simulation.away.imageUrl} alt="" />
                  ) : (
                    initials(matchModal.simulation.away.name)
                  )}
                </div>
                <strong>{matchModal.simulation.away.name}</strong>
                <span>OVR {matchModal.simulation.away.rating}</span>
              </div>
            </div>

            <div className="match-progress">
              <span style={{ width: `${matchModal.progress * 100}%` }} />
            </div>

            <div className="match-meta-grid">
              <div>
                <span>Acrescimos</span>
                <strong>{liveMatchStats?.stoppage}</strong>
              </div>
              <div>
                <span>Posse</span>
                <strong>
                  {liveMatchStats?.homePossession}% - {liveMatchStats?.awayPossession}%
                </strong>
              </div>
              <div>
                <span>Finalizacoes</span>
                <strong>
                  {liveMatchStats?.homeShots} - {liveMatchStats?.awayShots}
                </strong>
              </div>
              <div>
                <span>xG</span>
                <strong>
                  {liveMatchStats?.homeXg} - {liveMatchStats?.awayXg}
                </strong>
              </div>
            </div>

            <div className="event-feed">
              {visibleMatchEvents.map((event) => (
                <article className={`event-card event-${event.kind}`} key={event.id}>
                  <span>{minuteLabel(event.minute)}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{event.detail}</small>
                  </div>
                </article>
              ))}
            </div>

            {matchModal.status === "saving" && (
              <div className="match-status">Registrando resultado na AWS...</div>
            )}
            {matchModal.status === "error" && (
              <div className="match-status match-status-error">
                {matchModal.error ?? "Nao consegui registrar a partida."}
              </div>
            )}
          </section>
        </div>
      )}

      <section className="market-section">
        <div className="panel-heading market-heading">
          <div>
            <p className="eyebrow">Mercado</p>
            <h2>Jogadores da API</h2>
          </div>
          <Button
            className="market-action market-action-refresh"
            variant="outlined"
            onClick={() => void refreshDashboard()}
          >
            Atualizar
          </Button>
        </div>

        <div className="market-filters">
          <label>
            Busca
            <input
              value={marketQuery}
              onChange={(event) => setMarketQuery(event.target.value)}
              placeholder="Nome ou posicao"
            />
          </label>
          <label>
            Posicao
            <select
              value={marketPosition}
              onChange={(event) => setMarketPosition(event.target.value as Position | "TODAS")}
            >
              <option value="TODAS">Todas</option>
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={marketStatus}
              onChange={(event) =>
                setMarketStatus(event.target.value as (typeof PLAYER_STATUS_FILTERS)[number])
              }
            >
              {PLAYER_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="market-table-wrap">
          <table className="market-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Posicao</th>
                <th>Rating</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {filteredMarketPlayers.slice(0, 120).map((player) => {
                const belongsToSelectedClub = playerBelongsToSelectedClub(player);
                const canBuy =
                  typeof selectedClubId === "number" &&
                  player.status === "DISPONIVEL" &&
                  !belongsToSelectedClub;

                return (
                  <tr key={player.id}>
                    <td>
                      <strong>{player.nome}</strong>
                      <small>{player.liga ?? "Liga nao informada"}</small>
                    </td>
                    <td>{player.posicao}</td>
                    <td>{player.rating}</td>
                    <td>{formatValue(player.valor)}</td>
                    <td>
                      <span className={`status-pill status-${player.status.toLowerCase()}`}>
                        {belongsToSelectedClub ? "NO CLUBE" : player.status}
                      </span>
                    </td>
                    <td>
                      {belongsToSelectedClub ? (
                        <Button
                          className="market-action market-action-sell"
                          size="small"
                          variant="outlined"
                          onClick={() => void sellPlayer(player)}
                          disabled={saving}
                        >
                          Vender
                        </Button>
                      ) : (
                        <Button
                          className="market-action market-action-buy"
                          size="small"
                          variant="contained"
                          onClick={() => void buyPlayer(player)}
                          disabled={saving || !canBuy}
                        >
                          Comprar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
