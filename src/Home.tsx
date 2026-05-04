import { useCallback, useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import "./App.css";

type Position = "ATA" | "PD" | "PE" | "MC" | "LD" | "LE" | "ZAG" | "GOL";
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

const POSITIONS: Position[] = ["GOL", "LE", "ZAG", "LD", "MC", "PE", "ATA", "PD"];
const PLAYER_STATUS_FILTERS = ["TODOS", "DISPONIVEL", "COMPRADO"] as const;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const FORMATION_SLOTS = [
  { id: "pe", label: "PE", line: "Ataque", number: 11, positions: ["PE", "ATA"], x: 21, y: 11 },
  { id: "ata", label: "ATA", line: "Ataque", number: 9, positions: ["ATA"], x: 50, y: 8 },
  { id: "pd", label: "PD", line: "Ataque", number: 7, positions: ["PD", "ATA"], x: 79, y: 11 },
  { id: "mc1", label: "MC", line: "Meio", number: 8, positions: ["MC"], x: 25, y: 34 },
  { id: "mc2", label: "MC", line: "Meio", number: 10, positions: ["MC"], x: 50, y: 38 },
  { id: "mc3", label: "MC", line: "Meio", number: 20, positions: ["MC"], x: 75, y: 34 },
  { id: "le", label: "LE", line: "Defesa", number: 6, positions: ["LE"], x: 15, y: 60 },
  { id: "zag1", label: "ZAG", line: "Defesa", number: 4, positions: ["ZAG"], x: 38, y: 62 },
  { id: "zag2", label: "ZAG", line: "Defesa", number: 3, positions: ["ZAG"], x: 62, y: 62 },
  { id: "ld", label: "LD", line: "Defesa", number: 2, positions: ["LD"], x: 85, y: 60 },
  { id: "gol", label: "GOL", line: "Gol", number: 1, positions: ["GOL"], x: 50, y: 84 },
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
  return `${API_BASE_URL}${path}`;
}

function normalizePlayer(raw: ApiPlayer): Player {
  const rawPosition = raw.posicao;
  const posicao = POSITIONS.includes(rawPosition as Position) ? (rawPosition as Position) : "ATA";
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

function clampScore(score: number) {
  return Math.max(0, Math.min(6, score));
}

function simulateScore(teamRating: number, opponentRating: number) {
  const teamEdge = (teamRating - opponentRating) / 18;
  const opponentEdge = (opponentRating - teamRating) / 18;
  const teamGoals = clampScore(Math.round(1.2 + teamEdge + Math.random() * 2.4));
  const opponentGoals = clampScore(Math.round(1.1 + opponentEdge + Math.random() * 2.2));

  return { teamGoals, opponentGoals };
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDashboard = useCallback(async (quiet = false) => {
    const [playersResult, clubsResult, leaguesResult, gamesResult] = await Promise.allSettled([
      apiFetch<ApiPlayer[]>("/jogador/jogadores"),
      apiFetch<ApiClub[]>("/clube/get"),
      apiFetch<{ leagues: string[] }>("/clube/leagues"),
      apiFetch<Game[]>("/jogos"),
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
        text: `Nao consegui carregar: ${failures.join(", ")}. Confere se o gateway esta rodando.`,
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

  async function refreshDashboard() {
    setLoading(true);
    await loadDashboard();
  }

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
      await apiFetch(`/clube/delete/${clubId}`, { method: "DELETE" });

      if (selectedClubId === clubId) {
        setSelectedClubId("");
        setOpponentClubId("");
        setLineup(createEmptyLineup());
      }

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

  async function playMatch() {
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

    setSaving(true);

    try {
      const score = simulateScore(teamRating, opponentRating);
      await apiFetch<Game>("/jogos/play", {
        method: "POST",
        body: JSON.stringify({
          time_a: String(selectedClubId),
          pontos_a: score.teamGoals,
          time_b: String(opponentClubId),
          pontos_b: score.opponentGoals,
        }),
      });

      setNotice({
        type: "success",
        text: `${selectedClub?.name ?? "Seu time"} ${score.teamGoals} x ${
          score.opponentGoals
        } ${opponentClub?.name ?? "Adversario"}`,
      });
      await loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Falha ao jogar." });
    } finally {
      setSaving(false);
    }
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
          <h1>Monte seu 4-3-3</h1>
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
                setSelectedClubId(value);
                setOpponentClubId("");
                setLineup(createEmptyLineup());
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
                  onClick={() => setSelectedClubId(club.id)}
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
              <strong>{selectedClubPlayers.length}/11</strong>
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

      <section className="market-section">
        <div className="panel-heading market-heading">
          <div>
            <p className="eyebrow">Mercado</p>
            <h2>Jogadores da API</h2>
          </div>
          <Button variant="outlined" onClick={() => void refreshDashboard()}>
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
                          size="small"
                          variant="outlined"
                          onClick={() => void sellPlayer(player)}
                          disabled={saving}
                        >
                          Vender
                        </Button>
                      ) : (
                        <Button
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
