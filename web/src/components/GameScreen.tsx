import { useEffect, useState } from "react";
import type { GameView, Command } from "../../../shared/types.js";
import type { RoomCommand, RoomView } from "../../../server/rooms.js";
import {
  ASSETS,
  CARDS,
  CREATURES,
  EVENTS,
  GOALS,
  GROUPS,
  LAWS,
  TILE_NAMES,
  card,
  creature,
  law,
} from "../../../shared/content.js";
import {
  incomeFor,
  stepsTo,
  travelDestination,
} from "../../../shared/engine.js";
import { Board } from "./Board";
import { Portrait } from "./Portrait";
import { Field } from "./Field";
const PHASE_NAMES: Record<string, string> = {
  turn: "Економічний хід",
  reaction: "Право на відповідь",
  proposal: "Подання законів",
  debate: "Переговори",
  vote: "Голосування",
  finished: "Партію завершено",
};
export function GameScreen({
  view: v,
  room,
  send,
  busy,
  connected,
  clockOffset,
  sendChat,
}: {
  view: GameView;
  room: RoomView | null;
  send: (c: RoomCommand) => void;
  busy: boolean;
  connected: boolean;
  clockOffset: number;
  sendChat: (text: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number | null>(0),
    [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [tab, setTab] = useState<
    "turn" | "laws" | "trade" | "chat" | "journal"
  >("turn");
  const [target, setTarget] = useState(
    v.players.find((p) => p.id !== v.self.id)!.id,
  );
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (selectedCard && !v.self.hand.includes(selectedCard))
      setSelectedCard(null);
  }, [v.self.hand, selectedCard]);
  const me = v.players.find((p) => p.id === v.self.id)!;
  const current = v.players[v.turnIndex],
    myTurn = v.phase === "turn" && current.id === me.id;
  const locked = busy || !connected,
    active = locked || !myTurn;
  const asset = ASSETS.find((a) => a.tile === selected),
    owned = ASSETS.filter((a) => v.assets[a.id].owner === me.id);
  const canReach = selected !== null ? stepsTo(me.position, selected) : 0;
  const canBuy =
    !!asset &&
    !v.assets[asset.id].owner &&
    canReach >= 1 &&
    canReach <= 3 &&
    me.coins >= asset.price;
  const seconds = v.deadline
    ? Math.max(0, Math.ceil((v.deadline - (tick + clockOffset)) / 1000))
    : null;
  const c = selectedCard ? card(selectedCard) : undefined;
  const eligibleAssets =
    c?.id === "sabotage"
      ? ASSETS.filter((a) => v.assets[a.id].owner === target)
      : c?.id === "renovate"
        ? owned.filter((a) => v.assets[a.id].level < 2)
        : [];
  const chosenAsset = eligibleAssets.find((a) => a.tile === selected);
  const needsAsset = c?.id === "sabotage" || c?.id === "renovate";
  const cardDisabled =
    active ||
    !c ||
    c.type !== "action" ||
    (c.id === "investigation" && !owned.some((a) => a.group === "media")) ||
    (needsAsset && !chosenAsset);
  function playSelected() {
    if (c)
      send({
        type: "card",
        cardId: c.id,
        targetId: target,
        assetId: needsAsset ? chosenAsset?.id : undefined,
      });
  }
  function exportReport() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            rulesVersion: v.rulesVersion,
            completedAt: new Date().toISOString(),
            players: v.players,
            scores: v.scores,
            winners: v.winners,
            history: v.lawHistory,
            log: v.log,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "VADA-match-report.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const attended = v.attendance.includes(me.id),
    prop = v.proposals[v.voteIndex];
  return (
    <div className="game">
      <header className="game-heading">
        <div>
          <p className="eyebrow">
            {room ? "Кімната " + room.code : "Тренувальна партія"}
          </p>
          <h1>{PHASE_NAMES[v.phase]}</h1>
        </div>
        <div className="game-clock">
          <strong>
            День {v.day}
            <span> / {v.maxDays}</span>
          </strong>
          <small>{v.totalTurns % 10} / 10 спільних ходів</small>
          {seconds !== null && <span className="timer">{seconds} с</span>}
        </div>
      </header>
      <div className="players-strip">
        {v.players.map((p) => (
          <div
            key={p.id}
            className={
              "player-strip " +
              (v.phase === "turn" && p.id === current.id ? "current" : "")
            }
            style={
              {
                "--player-color": creature(p.creature).color,
              } as React.CSSProperties
            }
          >
            <Portrait id={p.creature} />
            <div>
              <strong>
                {p.name}
                {p.id === me.id ? " · ви" : ""}
              </strong>
              <small>
                {p.position === null
                  ? "У парламенті"
                  : "Місце " + (p.position + 1)}
                {p.bot ? " · бот" : ""}
              </small>
              <div className="mini-stats">
                <span title="Капітал">{p.coins} ◈</span>
                <span title="Вплив">{p.influence} впл.</span>
                <span title="Скандали">{p.scandals} ск.</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="game-workspace">
        <div className="game-table-column">
          <Board view={v} selection={selected} onSelect={setSelected} />
          <div className="day-note">
            <span className="seal">V</span>
            <div>
              <strong>{EVENTS.find((e) => e.id === v.eventId)?.name}</strong>
              <small>{EVENTS.find((e) => e.id === v.eventId)?.text}</small>
            </div>
            <span className="day-turn">
              {myTurn
                ? "Ваш хід"
                : v.phase === "turn"
                  ? "Хід: " + current.name
                  : "Парламентська сесія"}
            </span>
          </div>
          <section className="hand-section">
            <div className="section-heading">
              <h2>
                Ваша рука <span>{v.self.hand.length} / 6</span>
              </h2>
              <small>Прихована від суперників</small>
            </div>
            <div className="hand">
              {v.self.hand.length ? (
                v.self.hand.map((id, i) => {
                  const def = card(id)!;
                  const reaction =
                    v.phase === "reaction" && v.reaction?.target === me.id;
                  return (
                    <button
                      key={id + "-" + i}
                      className={
                        "hand-card " +
                        (selectedCard === id ? "chosen" : "") +
                        " " +
                        def.type
                      }
                      onClick={() => {
                        setSelectedCard(id);
                        setTab("turn");
                      }}
                      aria-pressed={selectedCard === id}
                    >
                      <span className="card-kind">
                        {def.type === "action" ? "Дія" : "Контрдія"}
                      </span>
                      <span className="card-symbol">
                        {def.type === "counter" ? "◇" : def.attack ? "✧" : "◈"}
                      </span>
                      <strong>{def.name}</strong>
                      <small>{def.text}</small>
                      {reaction && def.type === "counter" && (
                        <span className="card-flag">Можлива відповідь</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="empty">
                  У руці немає карт. На своєму ході доберіть дві.
                </p>
              )}
            </div>
          </section>
          <details className="accessible-map">
            <summary>Місця карти · доступний список</summary>
            <div className="map-buttons">
              {TILE_NAMES.map((name, i) => (
                <button
                  key={i}
                  className={selected === i ? "selected" : ""}
                  onClick={() => setSelected(i)}
                  aria-pressed={selected === i}
                >
                  {i + 1}. {name}
                </button>
              ))}
              <button onClick={() => setSelected(null)}>
                Центр · парламент
              </button>
            </div>
          </details>
        </div>
        <aside className="game-panel">
          <div className="panel-tabs" aria-label="Панель партії">
            {(
              [
                ["turn", "Дії"],
                ["laws", "Закони"],
                ["trade", "Угоди"],
                ["chat", "Чат"],
                ["journal", "Журнал"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "turn" && (
            <div className="panel-body">
              {v.phase === "finished" ? (
                <section>
                  <p className="eyebrow">Фінальний підрахунок</p>
                  <h2>
                    {v.winners.includes(me.id)
                      ? "Ви серед переможців"
                      : "Країна обрала нових володарів"}
                  </h2>
                  {v.scores.map((s, i) => (
                    <div className="score-row" key={s.playerId}>
                      <span>{i + 1}</span>
                      <div>
                        <strong>
                          {v.players.find((p) => p.id === s.playerId)!.name}
                        </strong>
                        <small>
                          Активи {s.assetPoints} · капітал {s.coinPoints} ·
                          закони {s.lawPoints} · цілі {s.goalPoints} · скандали
                          −{s.scandalPenalty}
                        </small>
                      </div>
                      <b>{s.total}</b>
                    </div>
                  ))}
                  <button className="primary full" onClick={exportReport}>
                    Завантажити розбір
                  </button>
                </section>
              ) : v.phase === "reaction" ? (
                <section>
                  <p className="eyebrow">Атака</p>
                  <h2>{card(v.reaction!.cardId)!.name}</h2>
                  <p>{card(v.reaction!.cardId)!.text}</p>
                  {v.reaction!.target === me.id ? (
                    <>
                      <p>Оберіть контрдію або прийміть наслідки.</p>
                      {v.self.hand
                        .filter((id) => card(id)?.type === "counter")
                        .map((id, i) => {
                          const def = card(id)!;
                          const valid =
                            (def.counters!.includes("all") ||
                              def.counters!.includes(v.reaction!.cardId)) &&
                            (id !== "veil" || me.influence >= 1);
                          return (
                            <button
                              className="outline full"
                              key={id + i}
                              disabled={locked || !valid}
                              onClick={() =>
                                send({ type: "react", cardId: id })
                              }
                            >
                              {def.name}
                            </button>
                          );
                        })}
                      <button
                        className="quiet full"
                        disabled={locked}
                        onClick={() => send({ type: "react" })}
                      >
                        Прийняти наслідки
                      </button>
                    </>
                  ) : (
                    <p className="notice">
                      {v.players.find((p) => p.id === v.reaction!.target)!.name}{" "}
                      обирає відповідь.
                    </p>
                  )}
                </section>
              ) : ["proposal", "debate", "vote"].includes(v.phase) ? (
                <section className="session-panel">
                  <p className="eyebrow">Сесія {v.day}</p>
                  <h2>Голос має той, хто у залі</h2>
                  <p className={attended ? "notice" : "notice warning"}>
                    {attended
                      ? "Ваша NUMBRA присутня. Ви можете голосувати."
                      : "Ви залишились на карті. У цій сесії голосувати не можна."}
                  </p>
                  <div className="attendance">
                    {v.players.map((p) => (
                      <span
                        key={p.id}
                        className={
                          v.attendance.includes(p.id) ? "present" : "absent"
                        }
                      >
                        {p.creature} ·{" "}
                        {v.attendance.includes(p.id)
                          ? "присутній"
                          : "відсутній"}
                      </span>
                    ))}
                  </div>
                  {v.phase === "proposal" && (
                    <>
                      <p>До 2 законів на сесію. Подання коштує 1 впливу.</p>
                      {LAWS.map((l) => (
                        <button
                          className="law-choice"
                          key={l.id}
                          disabled={
                            locked ||
                            !attended ||
                            me.influence < 1 ||
                            v.proposals.length >= 2 ||
                            v.ready.includes(me.id) ||
                            v.proposals.some((p) => p.lawId === l.id)
                          }
                          onClick={() => send({ type: "propose", lawId: l.id })}
                        >
                          <strong>{l.name}</strong>
                          <small>{l.text}</small>
                        </button>
                      ))}
                    </>
                  )}
                  {v.proposals.map((p) => (
                    <div className="proposed-law" key={p.id}>
                      <strong>{law(p.lawId)!.name}</strong>
                      <small>
                        Автор: {v.players.find((x) => x.id === p.author)!.name}
                      </small>
                    </div>
                  ))}
                  {v.phase === "debate" && (
                    <p>
                      Обговоріть закон у чаті й запропонуйте обмін. Обіцянка
                      майбутнього голосу не виконується автоматично.
                    </p>
                  )}
                  {(v.phase === "proposal" || v.phase === "debate") && (
                    <button
                      className="primary full"
                      disabled={locked || v.ready.includes(me.id)}
                      onClick={() => send({ type: "ready" })}
                    >
                      {v.ready.includes(me.id)
                        ? "Очікуємо решту учасників"
                        : "Я готовий · " +
                          v.ready.length +
                          "/" +
                          v.players.length}
                    </button>
                  )}
                  {v.phase === "vote" && prop && (
                    <div className="vote-panel">
                      <p className="eyebrow">
                        Закон {v.voteIndex + 1} / {v.proposals.length}
                      </p>
                      <h3>{law(prop.lawId)!.name}</h3>
                      <p>{law(prop.lawId)!.text}</p>
                      <small>
                        Потрібно {Math.floor(v.players.length / 2) + 1} голосів
                        «за» з усього складу.
                      </small>
                      {attended && !prop.ownVote ? (
                        <div className="vote-buttons">
                          <button
                            className="primary"
                            disabled={locked}
                            onClick={() => send({ type: "vote", vote: "yes" })}
                          >
                            За
                          </button>
                          <button
                            className="outline"
                            disabled={locked}
                            onClick={() => send({ type: "vote", vote: "no" })}
                          >
                            Проти
                          </button>
                          <button
                            className="quiet"
                            disabled={locked}
                            onClick={() =>
                              send({ type: "vote", vote: "abstain" })
                            }
                          >
                            Утриматись
                          </button>
                        </div>
                      ) : (
                        <p className="notice">
                          {prop.ownVote
                            ? "Ваш голос підтверджено."
                            : "Спостерігаємо за голосуванням."}{" "}
                          Подано {prop.votesCast} / {v.attendance.length}{" "}
                          голосів.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              ) : (
                <>
                  <div className="turn-banner">
                    <span className="eyebrow">
                      {myTurn ? "Ваш хід" : "Очікуємо хід"}
                    </span>
                    <h2>{myTurn ? "Зробіть один вибір" : current.name}</h2>
                    <small>
                      Одна дія завершує хід. Після 10 спільних ходів почнеться
                      сесія.
                    </small>
                  </div>
                  {c && (
                    <section className="selected-card">
                      <button
                        className="text-button"
                        onClick={() => setSelectedCard(null)}
                      >
                        ← До карти
                      </button>
                      <span className="eyebrow">
                        {c.type === "action" ? "Обрана дія" : "Обрана контрдія"}
                      </span>
                      <h3>{c.name}</h3>
                      <p>{c.text}</p>
                      {c.attack && (
                        <Field id="attack-target" label="Спрямувати на">
                          <select
                            id="attack-target"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                          >
                            {v.players
                              .filter((p) => p.id !== me.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                      )}
                      {needsAsset && (
                        <Field
                          id="card-asset"
                          label={
                            c.id === "renovate"
                              ? "Актив для покращення"
                              : "Актив суперника"
                          }
                        >
                          <select
                            id="card-asset"
                            value={chosenAsset?.id ?? ""}
                            onChange={(e) =>
                              setSelected(
                                ASSETS.find((a) => a.id === e.target.value)
                                  ?.tile ?? null,
                              )
                            }
                          >
                            <option value="">Оберіть актив</option>
                            {eligibleAssets.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      {needsAsset && !eligibleAssets.length && (
                        <small className="warning-text">
                          Немає доступних активів для цієї карти.
                        </small>
                      )}
                      {c.type === "counter" ? (
                        <p className="notice">
                          Цю карту можна використати лише у відповідь на
                          спрямовану на вас атаку.
                        </p>
                      ) : (
                        <button
                          className="primary full"
                          disabled={cardDisabled}
                          onClick={playSelected}
                        >
                          Розіграти карту
                        </button>
                      )}
                      {c.id === "investigation" &&
                        !owned.some((a) => a.group === "media") && (
                          <small className="warning-text">
                            Спершу придбайте медіа-актив.
                          </small>
                        )}
                    </section>
                  )}
                  {!c && (
                    <section className="asset-detail">
                      <p className="eyebrow">
                        {selected === null
                          ? "Центр країни"
                          : asset
                            ? GROUPS[asset.group].name
                            : "Місце " + (selected! + 1)}
                      </p>
                      <h3>
                        {selected === null
                          ? "Парламент"
                          : TILE_NAMES[selected!]}
                      </h3>
                      <p>
                        {asset?.description ??
                          (selected === null
                            ? "Поверніться сюди до десятого спільного ходу, щоб мати голос у сесії."
                            : "Вільне місце на маршруті країни.")}
                      </p>
                      {asset && (
                        <>
                          <div className="asset-stats">
                            <span>
                              <b>{asset.price}</b> ціна
                            </span>
                            <span>
                              <b>{incomeFor(v, asset.id)}</b> дохід/день
                            </span>
                            <span>
                              <b>{asset.points + v.assets[asset.id].level}</b>{" "}
                              очки
                            </span>
                          </div>
                          <small>
                            {v.assets[asset.id].owner
                              ? "Власник: " +
                                v.players.find(
                                  (p) => p.id === v.assets[asset.id].owner,
                                )!.name
                              : "Доступний для купівлі"}
                          </small>
                          <button
                            className="primary full"
                            disabled={active || !canBuy}
                            onClick={() =>
                              send({
                                type: "travel",
                                steps: canReach,
                                buy: true,
                              })
                            }
                          >
                            Перейти й купити · {asset.price} ◈
                          </button>
                          {!v.assets[asset.id].owner && !canBuy && (
                            <small>
                              {me.coins < asset.price
                                ? "Потрібно більше монет."
                                : canReach === 0
                                  ? "Спершу завершіть коло або скористайтесь іншою дією."
                                  : "Купівля доступна, коли актив у межах 1–3 місць попереду."}
                            </small>
                          )}
                        </>
                      )}
                    </section>
                  )}
                  <section className="move-actions">
                    <h3>Рух країною</h3>
                    <div className="step-buttons">
                      {[1, 2, 3].map((steps) => (
                        <button
                          className="outline"
                          key={steps}
                          disabled={active}
                          onClick={() =>
                            send({ type: "travel", steps, buy: false })
                          }
                          title={
                            TILE_NAMES[travelDestination(me.position, steps)]
                          }
                        >
                          {steps} {steps === 1 ? "місце" : "місця"}
                        </button>
                      ))}
                    </div>
                    <button
                      className="outline full"
                      disabled={active || me.position === null}
                      onClick={() => send({ type: "return" })}
                    >
                      {me.position === null
                        ? "Ви вже у парламенті"
                        : "Повернутись до парламенту"}
                    </button>
                    <div className="economy-buttons">
                      <button
                        className="quiet"
                        disabled={active}
                        onClick={() => send({ type: "pass" })}
                      >
                        Зібрати підтримку<span>+20 ◈ · +1 вплив</span>
                      </button>
                      <button
                        className="quiet"
                        disabled={active || v.self.hand.length >= 6}
                        onClick={() => send({ type: "draw" })}
                      >
                        Добрати карти<span>2 карти · до 6</span>
                      </button>
                    </div>
                    <button
                      className="quiet full"
                      disabled={
                        active ||
                        !ASSETS.some(
                          (a) =>
                            a.tile === me.position &&
                            v.assets[a.id].owner === me.id &&
                            v.assets[a.id].level < 2,
                        ) ||
                        me.coins < 60
                      }
                      onClick={() => send({ type: "upgrade" })}
                    >
                      Покращити актив · 60 ◈
                    </button>
                  </section>
                  <section className="whisper">
                    <p className="eyebrow">{me.creature} · Whisper</p>
                    <p>{creature(me.creature).ability}</p>
                    {me.creature === "MANIPUL" && (
                      <Field id="whisper-target" label="Суперник">
                        <select
                          id="whisper-target"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          {v.players
                            .filter((p) => p.id !== me.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                    )}
                    {me.creature === "OBFUSCO" && (
                      <small>
                        Перехід:{" "}
                        {selected === null
                          ? "оберіть місце на карті"
                          : TILE_NAMES[selected]}
                      </small>
                    )}
                    <button
                      className="outline full"
                      disabled={
                        active ||
                        me.influence < 2 ||
                        me.whisperDay === v.day ||
                        (me.creature === "OBFUSCO" && selected === null)
                      }
                      onClick={() =>
                        send({
                          type: "whisper",
                          targetId: target,
                          position: selected ?? 0,
                        })
                      }
                    >
                      {me.whisperDay === v.day
                        ? "Whisper використано сьогодні"
                        : "Пробудити Whisper · 2 впливу"}
                    </button>
                  </section>
                </>
              )}
              <section className="goals">
                <h3>Ваші особисті цілі</h3>
                {v.self.goals.map((id) => (
                  <div key={id}>
                    <strong>{GOALS.find((g) => g.id === id)!.name}</strong>
                    <small>{GOALS.find((g) => g.id === id)!.text}</small>
                  </div>
                ))}
                <small>Кожна виконана ціль дає 3 очки у фіналі.</small>
              </section>
            </div>
          )}
          {tab === "laws" && (
            <div className="panel-body">
              <h2>Чинні закони</h2>
              {v.laws.filter((l) => l.fromDay <= v.day && l.untilDay >= v.day)
                .length ? (
                v.laws
                  .filter((l) => l.fromDay <= v.day && l.untilDay >= v.day)
                  .map((l) => (
                    <article className="law-record" key={l.lawId}>
                      <strong>{law(l.lawId)!.name}</strong>
                      <p>{law(l.lawId)!.text}</p>
                      <small>Діє до дня {l.untilDay}</small>
                    </article>
                  ))
              ) : (
                <p className="empty">
                  Країна працює за базовими правилами. Подайте закон на
                  наступній сесії.
                </p>
              )}
              <h3>Результати сесій</h3>
              {v.lawHistory.length ? (
                v.lawHistory.map((l, i) => (
                  <article className="law-record" key={i}>
                    <strong>{law(l.lawId)!.name}</strong>
                    <small>
                      {l.passed ? "Прийнято" : "Не прийнято"} · за {l.yes} ·
                      проти {l.no} · утримались {l.abstain} · відсутні{" "}
                      {l.absent}
                    </small>
                  </article>
                ))
              ) : (
                <p className="empty">Перша сесія ще попереду.</p>
              )}
            </div>
          )}
          {tab === "trade" && (
            <Trade
              view={v}
              disabled={locked || v.phase === "finished"}
              send={send}
            />
          )}
          {tab === "chat" && (
            <Chat room={room} sendChat={sendChat} disabled={locked} />
          )}
          {tab === "journal" && (
            <div className="panel-body">
              <h2>Хроніка країни</h2>
              <ol className="journal">
                {[...v.log].reverse().map((entry) => (
                  <li key={entry.id}>
                    <span>День {entry.day}</span>
                    {entry.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
function Trade({
  view: v,
  disabled,
  send,
}: {
  view: GameView;
  disabled: boolean;
  send: (c: Command) => void;
}) {
  const me = v.self.id,
    [to, setTo] = useState(v.players.find((p) => p.id !== me)!.id),
    [give, setGive] = useState("0"),
    [take, setTake] = useState("0");
  const [giveAsset, setGiveAsset] = useState(""),
    [takeAsset, setTakeAsset] = useState("");
  function offer(e: React.FormEvent) {
    e.preventDefault();
    send({
      type: "offer",
      to,
      giveCoins: Number(give),
      takeCoins: Number(take),
      giveAsset: giveAsset || undefined,
      takeAsset: takeAsset || undefined,
      offerId: crypto.randomUUID(),
    });
  }
  return (
    <div className="panel-body">
      <h2>Домовленості</h2>
      <p>
        Обмін виконається разом після згоди адресата. Політичні обіцянки
        залишаються домовленістю між вами.
      </p>
      <form noValidate onSubmit={offer}>
        <Field id="trade-to" label="Кому">
          <select
            id="trade-to"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setTakeAsset("");
            }}
          >
            {v.players
              .filter((p) => p.id !== me)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="trade-coins">
          <Field id="trade-give" label="Віддаю монет">
            <input
              id="trade-give"
              type="number"
              min="0"
              step="1"
              value={give}
              onChange={(e) => setGive(e.target.value)}
            />
          </Field>
          <Field id="trade-take" label="Отримую монет">
            <input
              id="trade-take"
              type="number"
              min="0"
              step="1"
              value={take}
              onChange={(e) => setTake(e.target.value)}
            />
          </Field>
        </div>
        <Field id="trade-give-asset" label="Віддаю актив">
          <select
            id="trade-give-asset"
            value={giveAsset}
            onChange={(e) => setGiveAsset(e.target.value)}
          >
            <option value="">Без активу</option>
            {ASSETS.filter((a) => v.assets[a.id].owner === me).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="trade-take-asset" label="Отримую актив">
          <select
            id="trade-take-asset"
            value={takeAsset}
            onChange={(e) => setTakeAsset(e.target.value)}
          >
            <option value="">Без активу</option>
            {ASSETS.filter((a) => v.assets[a.id].owner === to).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="primary full" disabled={disabled} type="submit">
          Запропонувати обмін
        </button>
      </form>
      <h3>Пропозиції</h3>
      {v.offers.length ? (
        v.offers.map((o) => (
          <article key={o.id} className="offer">
            <strong>
              {v.players.find((p) => p.id === o.from)!.name} →{" "}
              {v.players.find((p) => p.id === o.to)!.name}
            </strong>
            <p>
              Віддає {o.giveCoins} ◈
              {o.giveAsset
                ? " + " + ASSETS.find((a) => a.id === o.giveAsset)!.name
                : ""}
              <br />
              Отримує {o.takeCoins} ◈
              {o.takeAsset
                ? " + " + ASSETS.find((a) => a.id === o.takeAsset)!.name
                : ""}
            </p>
            <div className="button-row">
              {o.to === me && (
                <button
                  className="primary"
                  disabled={disabled}
                  onClick={() => send({ type: "acceptOffer", offerId: o.id })}
                >
                  Прийняти
                </button>
              )}
              <button
                className="quiet"
                disabled={disabled}
                onClick={() => send({ type: "cancelOffer", offerId: o.id })}
              >
                {o.to === me ? "Відхилити" : "Скасувати"}
              </button>
            </div>
          </article>
        ))
      ) : (
        <p className="empty">Запропонуйте перший обмін.</p>
      )}
      <small>
        Боти цієї альфи не ведуть переговори й не приймають обміни. Для
        перевірки угод запросіть друга.
      </small>
    </div>
  );
}
export function Chat({
  room,
  sendChat,
  disabled,
}: {
  room: RoomView | null;
  sendChat: (text: string) => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || pending) return;
    setPending(true);
    setError("");
    try {
      await sendChat(text);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Повідомлення не надіслано.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="panel-body">
      <h2>Зала переговорів</h2>
      {room ? (
        <>
          <div className="chat-history" aria-live="polite">
            {room.chat.length ? (
              room.chat.map((m) => (
                <article key={m.id}>
                  <strong>
                    {room.seats.find((p) => p.id === m.playerId)?.name ??
                      "Учасник"}
                  </strong>
                  <p>{m.text}</p>
                </article>
              ))
            ) : (
              <p className="empty">
                Привітайте учасників і домовтесь про першу сесію.
              </p>
            )}
          </div>
          <form noValidate onSubmit={send}>
            <Field id="chat-message" label="Ваше повідомлення">
              <textarea
                className="resize-none"
                id="chat-message"
                rows={3}
                maxLength={500}
                value={text}
                style={{ resize: "none" }}
                onChange={(e) => setText(e.target.value)}
                aria-describedby={error ? "chat-error" : undefined}
              />
            </Field>
            <p id="chat-error" role="status" className="error-text">
              {error}
            </p>
            <button
              className="primary full"
              disabled={disabled || pending || !text.trim()}
              aria-busy={pending}
              type="submit"
            >
              {pending ? "Надсилаємо…" : "Надіслати"}
            </button>
          </form>
        </>
      ) : (
        <p className="empty">Текстовий чат відкриється у партії з друзями.</p>
      )}
    </div>
  );
}
