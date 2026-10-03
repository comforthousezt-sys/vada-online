export type CreatureId = "MANIPUL" | "TRADOR" | "PACTA" | "RHETOR" | "OBFUSCO";
export type Group = "trade" | "industry" | "media" | "logistics";
export type Phase =
  "turn" | "reaction" | "proposal" | "debate" | "vote" | "finished";
export type Vote = "yes" | "no" | "abstain";
export interface Seat {
  id: string;
  name: string;
  creature: CreatureId;
  bot: boolean;
}
export interface Player extends Seat {
  coins: number;
  influence: number;
  scandals: number;
  position: number | null;
  hand: string[];
  goals: string[];
  whisperDay: number;
  whisperCount: number;
  lawsPassed: number;
  attendanceCount: number;
  ward: boolean;
}
export interface AssetState {
  owner: string | null;
  level: number;
  suppressedDay: number;
}
export interface Proposal {
  id: string;
  lawId: string;
  author: string;
  votes: Record<string, Vote>;
}
export interface ActiveLaw {
  lawId: string;
  author: string;
  fromDay: number;
  untilDay: number;
}
export interface Reaction {
  source: string;
  target: string;
  cardId: string;
  assetId?: string;
}
export interface Offer {
  id: string;
  from: string;
  to: string;
  giveCoins: number;
  takeCoins: number;
  giveAsset?: string;
  takeAsset?: string;
}
export interface LogEntry {
  id: number;
  day: number;
  text: string;
}
export interface LawResult {
  lawId: string;
  author: string;
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  passed: boolean;
}
export interface Score {
  playerId: string;
  total: number;
  assetPoints: number;
  coinPoints: number;
  lawPoints: number;
  goalPoints: number;
  scandalPenalty: number;
  goals: { id: string; completed: boolean }[];
}
export interface Timers {
  turn: number;
  reaction: number;
  proposal: number;
  debate: number;
  vote: number;
}
export interface GameState {
  rulesVersion: string;
  version: number;
  rng: number;
  day: number;
  maxDays: number;
  totalTurns: number;
  turnIndex: number;
  phase: Phase;
  deadline: number;
  players: Player[];
  assets: Record<string, AssetState>;
  deck: string[];
  discard: string[];
  proposals: Proposal[];
  voteIndex: number;
  attendance: string[];
  ready: string[];
  laws: ActiveLaw[];
  lawHistory: LawResult[];
  reaction: Reaction | null;
  offers: Offer[];
  log: LogEntry[];
  scores: Score[];
  winners: string[];
  eventId: string;
  timers: Timers;
}
export type Command =
  | { type: "travel"; steps: number; buy: boolean }
  | { type: "return" | "pass" | "draw" | "upgrade" }
  | { type: "card"; cardId: string; targetId?: string; assetId?: string }
  | { type: "whisper"; targetId?: string; position?: number }
  | { type: "react"; cardId?: string }
  | { type: "propose"; lawId: string }
  | { type: "ready" }
  | { type: "vote"; vote: Vote }
  | {
      type: "offer";
      to: string;
      giveCoins: number;
      takeCoins: number;
      giveAsset?: string;
      takeAsset?: string;
      offerId: string;
    }
  | { type: "acceptOffer" | "cancelOffer"; offerId: string };
export interface PublicPlayer extends Seat {
  coins: number;
  influence: number;
  scandals: number;
  position: number | null;
  handCount: number;
  lawsPassed: number;
  attendanceCount: number;
  ward: boolean;
  whisperDay: number;
  whisperCount: number;
}
export interface GameView {
  rulesVersion: string;
  version: number;
  day: number;
  maxDays: number;
  totalTurns: number;
  turnIndex: number;
  phase: Phase;
  deadline: number;
  players: PublicPlayer[];
  assets: Record<string, AssetState>;
  proposals: {
    id: string;
    lawId: string;
    author: string;
    votesCast: number;
    ownVote?: Vote;
  }[];
  voteIndex: number;
  attendance: string[];
  ready: string[];
  laws: ActiveLaw[];
  lawHistory: LawResult[];
  reaction: Reaction | null;
  offers: Offer[];
  log: LogEntry[];
  scores: Score[];
  winners: string[];
  eventId: string;
  self: { id: string; hand: string[]; goals: string[] };
}
