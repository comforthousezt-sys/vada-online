import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import { Portrait } from "./components/Portrait";
import { Field } from "./components/Field";
import { Modal } from "./components/Modal";
import { GameScreen, Chat } from "./components/GameScreen";
import { useGame, getApiBase } from "./useGame";
import {
  ASSETS,
  CARDS,
  CREATURES,
  GOALS,
  GROUPS,
  INSTITUTIONS,
  LAWS,
} from "../../shared/content.js";
import type { CreatureId } from "../../shared/types.js";
const TUTORIAL = [
  {
    title: "Країна на вашому столі",
    text: "Ви — тіньовий володар NUMBRA. Купуйте активи, розігруйте карти, укладайте угоди та змінюйте економіку законами. Партія триває 6 ігрових днів.",
  },
  {
    title: "Один хід — один вибір",
    text: "Пройдіть 1–3 місця за годинниковою стрілкою. Якщо в кінці руху є вільний актив, можна перейти й одразу купити його. Або витратьте хід на карту, Whisper чи підтримку.",
  },
  {
    title: "Поверніться до десятого ходу",
    text: "10 спільних ходів усіх учасників завершують день. Повернення до парламенту займає весь хід. NUMBRA на карті пропускає голосування, але може домовлятись.",
  },
  {
    title: "Домовленості мають наслідки",
    text: "До 2 законів на сесію. Для прийняття потрібна більшість усіх учасників: 3 з 4. Приховані карти допомагають атакувати й захищатися. Капітал, активи, закони та особисті цілі дають фінальні очки.",
  },
];
export default function App() {
  const game = useGame(),
    [screen, setScreen] = useState<
      "home" | "play" | "numbra" | "manuscript" | "cards" | "roadmap"
    >("home");
  const [setup, setSetup] = useState<"local" | "online" | null>(null),
    [selected, setSelected] = useState<CreatureId>("MANIPUL");
  const [name, setName] = useState(""),
    [code, setCode] = useState(
      () => new URL(location.href).searchParams.get("room") ?? "",
    );
  const [count, setCount] = useState(4),
    [join, setJoin] = useState(
      () => !!new URL(location.href).searchParams.get("room"),
    );
  const [modal, setModal] = useState<"rules" | "tutorial" | "replace" | null>(
      null,
    ),
    [tutorial, setTutorial] = useState(0),
    [copied, setCopied] = useState(false);
  const choose = CREATURES.find((c) => c.id === selected)!;
  useEffect(() => {
    const names = {
      home: "Початок",
      play: "Партія",
      numbra: "Світ NUMBRA",
      manuscript: "Manuscript",
      cards: "Картки й закони",
      roadmap: "Розвиток",
    };
    document.title = "VADA · " + names[screen];
  }, [screen]);
  function startLocal() {
    game.startPractice(selected, count);
    setSetup(null);
    setScreen("play");
    setModal(null);
  }
  function start() {
    if (game.hasSave) {
      setModal("replace");
      return;
    }
    startLocal();
  }
  function showPlay() {
    if (game.view || game.room) setScreen("play");
    else setSetup("local");
  }
  function invite() {
    if (!game.room) return;
    const link = new URL(location.href);
    link.searchParams.set("room", game.room.code);
    void navigator.clipboard
      .writeText(link.toString())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() =>
        game.setError(
          "Код кімнати: " + game.room!.code + ". Його можна скопіювати вручну.",
        ),
      );
  }
  async function enterOnline(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || name.trim().length > 30) {
      game.setError("Вкажіть ім’я з 2–30 символів.");
      document.getElementById("player-name")?.focus();
      return;
    }
    if (join && !/^[A-Fa-f0-9]{6}$/.test(code.trim())) {
      game.setError("Код кімнати складається з 6 символів.");
      document.getElementById("room-code")?.focus();
      return;
    }
    if (await game.createOrJoin(name, selected, join ? code : undefined)) {
      setSetup(null);
      setScreen("play");
    }
  }
  const nav = [
    ["home", "Початок", "⌂"],
    ["play", "Грати", "◇"],
    ["numbra", "Світ NUMBRA", "✧"],
    ["cards", "Картки й закони", "▤"],
    ["manuscript", "Manuscript", "◈"],
    ["roadmap", "Розвиток VADA", "↗"],
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setScreen("home")}
          aria-label="VADA — початок"
        >
          <span>VΛDΛ</span>
          <small>ШЕПІТ ВЛАДИ</small>
        </button>
        <div className="sidebar-rule">
          <span>DEZA GAMES</span>
        </div>
        <nav aria-label="Головне меню">
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={screen === id ? "active" : ""}
              onClick={() => (id === "play" ? showPlay() : setScreen(id))}
              aria-current={screen === id ? "page" : undefined}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="sidebar-help" onClick={() => setModal("rules")}>
            Правила країни <span>?</span>
          </button>
          <button
            className="sidebar-help"
            onClick={() => {
              setTutorial(0);
              setModal("tutorial");
            }}
          >
            Як грати <span>→</span>
          </button>
          <small>
            VADA Online · 0.2 alpha
            <br />
            Тестова редакція правил
          </small>
        </div>
      </aside>
      <main className="main-content">
        <div className="topbar">
          <span className="topbar-world">РЕНЕСАНС. ІНТРИГИ. NUMBRA.</span>
          <div>
            <span className="alpha-badge">Закрита альфа</span>
            <button
              className="quiet small"
              onClick={() => {
                setTutorial(0);
                setModal("tutorial");
              }}
            >
              Навчання
            </button>
          </div>
        </div>
        {screen === "home" && (
          <div className="home">
            <div className="home-intro">
              <p className="eyebrow">Економіка · Переговори · Парламент</p>
              <h1>
                Влада починається
                <br />з <em>домовленості.</em>
              </h1>
              <p>
                У країні VADA міфічні істоти керують активами,
                <br className="desktop-break" /> плетуть інтриги й збираються
                під одним куполом.
              </p>
            </div>
            <div className="hero-table">
              <Board />
              <div className="hero-annotation">
                <span className="tiny-rule"></span>
                <strong>Одна країна. П’ять тіньових володарів.</strong>
                <small>Мапа обертається — спробуйте.</small>
              </div>
            </div>
            <div className="home-actions">
              <div className="primary-actions">
                <button
                  className="primary hero-button"
                  onClick={() => setSetup("local")}
                >
                  Почати партію <span>→</span>
                </button>
                <button
                  className="outline hero-button"
                  onClick={() => {
                    setSetup("online");
                    setJoin(false);
                  }}
                >
                  Грати з друзями
                </button>
                {game.hasSave && (
                  <button
                    className="text-button"
                    onClick={() => {
                      game.continuePractice();
                      setScreen("play");
                    }}
                  >
                    Продовжити тренування →
                  </button>
                )}
                {game.hasSession && (
                  <button
                    className="text-button"
                    onClick={() => {
                      game.resumeOnline();
                      setScreen("play");
                    }}
                  >
                    Повернутись до кімнати →
                  </button>
                )}
              </div>
              <div className="home-facts">
                <div>
                  <b>3–5</b>
                  <small>учасників</small>
                </div>
                <div>
                  <b>6</b>
                  <small>ігрових днів</small>
                </div>
                <div>
                  <b>10</b>
                  <small>спільних ходів до сесії</small>
                </div>
              </div>
            </div>
            <section className="home-numbra">
              <div className="section-heading">
                <span className="eyebrow">Ваша NUMBRA — ваш стиль гри</span>
                <button
                  className="text-button"
                  onClick={() => setScreen("numbra")}
                >
                  Дослідити п’ятірку →
                </button>
              </div>
              <div>
                {CREATURES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setSetup("local");
                    }}
                  >
                    <Portrait id={c.id} />
                    <span>
                      <strong>{c.id}</strong>
                      <small>{c.role}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
        {screen === "play" &&
          (game.view ? (
            <GameScreen
              view={game.view}
              room={game.mode === "online" ? game.room : null}
              send={game.send}
              busy={game.busy}
              connected={game.mode === "local" || game.status === "online"}
              clockOffset={game.mode === "local" ? 0 : game.clockOffset}
              sendChat={game.sendChat}
            />
          ) : game.room ? (
            <div className="lobby">
              <p className="eyebrow">Приватна кімната</p>
              <h1>Зберіть свій парламент</h1>
              <div className="lobby-code">
                <span>{game.room.code}</span>
                <button className="outline" onClick={invite}>
                  {copied ? "Запрошення скопійовано" : "Скопіювати запрошення"}
                </button>
              </div>
              <p>
                Запросіть друзів за посиланням або додайте ботів. Потрібно 3–5
                учасників.
              </p>
              <div className="lobby-members">
                {game.room.seats.map((p) => (
                  <article key={p.id}>
                    <Portrait id={p.creature} large />
                    <h2>{p.name}</h2>
                    <small>
                      {p.bot
                        ? "Бот"
                        : p.id === game.room!.hostId
                          ? "Власник кімнати"
                          : "Учасник"}
                    </small>
                    {p.bot && game.room!.hostId === game.room!.selfId && (
                      <button
                        className="quiet small"
                        disabled={game.busy || game.status !== "online"}
                        onClick={() =>
                          game.send({ type: "removeBot", playerId: p.id })
                        }
                      >
                        Прибрати бота
                      </button>
                    )}
                  </article>
                ))}
              </div>
              {game.room.hostId === game.room.selfId ? (
                <div className="button-row">
                  <button
                    className="outline"
                    disabled={
                      game.busy ||
                      game.status !== "online" ||
                      game.room.seats.length >= 5
                    }
                    onClick={() => game.send({ type: "addBot" })}
                  >
                    Додати бота
                  </button>
                  <button
                    className="primary"
                    disabled={
                      game.busy ||
                      game.status !== "online" ||
                      game.room.seats.length < 3
                    }
                    onClick={() => game.send({ type: "start" })}
                  >
                    Почати партію
                  </button>
                </div>
              ) : (
                <p className="notice">
                  Власник кімнати розпочне партію, коли всі зберуться.
                </p>
              )}
              <Chat
                room={game.room}
                sendChat={game.sendChat}
                disabled={game.status !== "online"}
              />
            </div>
          ) : (
            <div className="connecting-state">
              <h1>
                {game.status === "connecting" || game.status === "reconnecting"
                  ? "Відкриваємо кімнату…"
                  : "Час обрати NUMBRA"}
              </h1>
              <p>
                {game.status === "connecting" || game.status === "reconnecting"
                  ? "Відновлюємо ваше місце й підтверджені ходи."
                  : "Почніть тренування або запросіть друзів."}
              </p>
              <div className="button-row">
                <button className="primary" onClick={() => setSetup("local")}>
                  Грати з ботами
                </button>
                <button className="outline" onClick={() => setSetup("online")}>
                  Кімната з друзями
                </button>
              </div>
            </div>
          ))}
        {screen === "numbra" && (
          <div className="codex">
            <p className="eyebrow">Бестіарій VADA · базова п’ятірка</p>
            <h1>П’ять голосів у тіні влади</h1>
            <p className="lead">
              NUMBRA діють за власними правилами. Інститути країни їм не
              належать.
            </p>
            <div className="creature-grid">
              {CREATURES.map((c) => (
                <article
                  key={c.id}
                  className="creature-entry"
                  style={{ "--creature-color": c.color } as React.CSSProperties}
                >
                  <div className="creature-illustration">
                    <Portrait id={c.id} large />
                    <span>{c.role}</span>
                  </div>
                  <div>
                    <p className="eyebrow">{c.subtitle}</p>
                    <h2>{c.id}</h2>
                    <p>{c.lore}</p>
                    <div className="ability-line">
                      <strong>Whisper</strong>
                      <p>{c.ability}</p>
                    </div>
                    <small>Артефакт у задумі: {c.artifact}</small>
                    <button
                      className="outline"
                      onClick={() => {
                        setSelected(c.id);
                        setSetup("local");
                      }}
                    >
                      Грати за {c.id}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <section className="institution-section">
              <h2>Інститути країни</h2>
              <div>
                {INSTITUTIONS.map((x, i) => (
                  <article key={x.name}>
                    <span className="seal">{["V", "Λ", "◈", "◇", "Σ"][i]}</span>
                    <h3>{x.name}</h3>
                    <p>{x.text}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
        {screen === "cards" && (
          <div className="codex">
            <p className="eyebrow">Відкрита бібліотека правил</p>
            <h1>Кожна карта має наслідок</h1>
            <p className="lead">
              12 дій, 8 контрдій і 6 законів. Ще 4 події країна застосовує на
              початку нового дня.
            </p>
            <div className="catalog-grid">
              {CARDS.map((c) => (
                <article key={c.id}>
                  <span className="eyebrow">
                    {c.type === "action" ? "Дія" : "Контрдія"}
                  </span>
                  <h2>{c.name}</h2>
                  <p>{c.text}</p>
                </article>
              ))}
            </div>
            <h2>Законодавство</h2>
            <div className="catalog-grid">
              {LAWS.map((l) => (
                <article key={l.id}>
                  <span className="eyebrow">Закон · 2 дні</span>
                  <h2>{l.name}</h2>
                  <p>{l.text}</p>
                </article>
              ))}
            </div>
            <h2>Дохідні активи</h2>
            <div className="asset-catalog">
              {ASSETS.map((a) => (
                <article
                  key={a.id}
                  style={{ borderLeftColor: GROUPS[a.group].color }}
                >
                  <span className="eyebrow">{GROUPS[a.group].name}</span>
                  <h3>{a.name}</h3>
                  <p>
                    {a.price} ◈ ціна · {a.income} ◈ дохід · {a.points} очки
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}
        {screen === "manuscript" && (
          <div className="manuscript">
            <p className="eyebrow">VADA Manuscript · новий пролог</p>
            <h1>
              До того,
              <br />
              як з’явився <em>перший закон.</em>
            </h1>
            <div className="manuscript-spread">
              <div className="manuscript-seal">
                VΛDΛ<span>MANUSCRIPT</span>
              </div>
              <article>
                <p className="dropcap">
                  Країна прокинулася від шепоту. На ринку ще не було монет, у
                  майстернях — молотів, а під великим куполом стояли п’ять
                  порожніх місць.
                </p>
                <p>
                  Першим прийшов той, хто знав ціну мовчання. Другим — той, хто
                  міг пообіцяти майбутнє. Третій приніс печатку. Четвертий
                  промовив слово, яке запам’ятали всі. П’ятого ніхто не бачив.
                </p>
                <p>
                  Вони не стали правителями. Вони залишили країні парламент,
                  шляхи та право домовлятися. Кожен закон відтоді мав автора.
                  Кожна обіцянка — свідка. І кожен світлий зал — свою тінь.
                </p>
                <blockquote>
                  Влада живе не на троні.
                  <br />
                  Вона живе між двома голосами.
                </blockquote>
                <small>
                  Авторський пролог для браузерної альфи. Повна сюжетна кампанія
                  ще попереду.
                </small>
              </article>
            </div>
            <div className="book-shelf">
              {[
                "NUMBRA RISES",
                "Pacta Infinitum",
                "The Keyless Door",
                "The Fifth Voice",
                "Manus Ultima",
              ].map((title, i) => (
                <article key={title}>
                  <span>КНИГА {i + 1}</span>
                  <strong>{title}</strong>
                  <small>У плані розвитку</small>
                </article>
              ))}
            </div>
          </div>
        )}
        {screen === "roadmap" && (
          <div className="codex">
            <p className="eyebrow">Дорожня карта · статус можливостей</p>
            <h1>Країна, яка буде зростати</h1>
            <div className="roadmap">
              {[
                {
                  version: "0.2 alpha",
                  title: "Повна партія та приватні кімнати",
                  text: "Готово у цій збірці: правила, боти, 3D-карта, 5 NUMBRA, карти, обмін, чат, сесії, фінал і сервер кімнат. Онлайн вимагає окремого розгортання.",
                  status: "Поточна збірка",
                },
                {
                  version: "0.3",
                  title: "Соціальна альфа",
                  text: "Тестування з людьми, покращення навчання, модерація чату, баланс Whisper та вимірювання темпу партії.",
                  status: "Наступний етап",
                },
                {
                  version: "0.4",
                  title: "Профіль і колекція",
                  text: "Облікові записи, історія матчів, досягнення, постійні образи NUMBRA, остаточні 3D-моделі та звуковий дизайн.",
                  status: "Заплановано",
                },
                {
                  version: "1.0",
                  title: "Контрольований публічний запуск",
                  text: "Тести навантаження, підтримка, косметичні набори й організовані публічні партії.",
                  status: "Заплановано",
                },
                {
                  version: "Після 1.0",
                  title: "Розширення всесвіту",
                  text: "Ігрові артефакти, Web-селекція гібридів, QR фізичних фігурок, Manuscript, Card Chaos, Legacy та Campaign.",
                  status: "Заплановано",
                },
              ].map((r) => (
                <article key={r.version}>
                  <div>
                    <span>{r.version}</span>
                    <small>{r.status}</small>
                  </div>
                  <section>
                    <h2>{r.title}</h2>
                    <p>{r.text}</p>
                  </section>
                </article>
              ))}
            </div>
            <p className="notice">
              Платні покупки не додають капітал, голоси чи силу Whisper у
              стандартній партії.
            </p>
          </div>
        )}
        <footer className="main-footer">
          <span>VΛDΛ · країна домовленостей</span>
          <span>Правила 0.2.0 alpha · українська версія</span>
        </footer>
      </main>
      <div
        className={"global-status " + (game.error ? "has-error" : "")}
        role="status"
        aria-live="polite"
      >
        {game.error ? (
          <>
            <span>{game.error}</span>
            <button
              onClick={() => game.setError("")}
              aria-label="Закрити повідомлення"
            >
              ×
            </button>
          </>
        ) : game.mode === "online" ? (
          game.status === "online" ? (
            "З’єднання підтверджено"
          ) : game.status === "offline" ? (
            "З’єднання відсутнє"
          ) : (
            "Відновлюємо зв’язок…"
          )
        ) : null}
      </div>
      {setup && (
        <Modal
          title={setup === "local" ? "Оберіть свою NUMBRA" : "Відкрити кімнату"}
          onClose={() => {
            setSetup(null);
            game.setError("");
          }}
        >
          <div className="setup-switch">
            <button
              aria-pressed={setup === "local"}
              onClick={() => setSetup("local")}
            >
              Партія з ботами
            </button>
            <button
              aria-pressed={setup === "online"}
              onClick={() => setSetup("online")}
            >
              Грати з друзями
            </button>
          </div>
          <div
            className="creature-choice"
            role="group"
            aria-label="Вибір NUMBRA"
          >
            {CREATURES.map((c) => (
              <button
                key={c.id}
                className={selected === c.id ? "selected" : ""}
                onClick={() => setSelected(c.id)}
                aria-pressed={selected === c.id}
              >
                <Portrait id={c.id} />
                <strong>{c.id}</strong>
              </button>
            ))}
          </div>
          <div className="chosen-creature">
            <span className="eyebrow">{choose.role}</span>
            <h3>{choose.subtitle}</h3>
            <p>{choose.ability}</p>
          </div>
          {setup === "local" ? (
            <>
              <Field id="player-count" label="Склад партії">
                <select
                  id="player-count"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  <option value="3">Ви та 2 боти</option>
                  <option value="4">Ви та 3 боти</option>
                  <option value="5">Ви та 4 боти</option>
                </select>
              </Field>
              <p className="notice">
                Тренування без обмеження часу. Прогрес зберігається у цьому
                браузері.
              </p>
              <button className="primary full" onClick={start}>
                Почати тренувальну партію
              </button>
            </>
          ) : getApiBase() ? (
            <form noValidate onSubmit={enterOnline}>
              <div className="setup-switch">
                <button
                  type="button"
                  aria-pressed={!join}
                  onClick={() => setJoin(false)}
                >
                  Створити кімнату
                </button>
                <button
                  type="button"
                  aria-pressed={join}
                  onClick={() => setJoin(true)}
                >
                  Увійти за кодом
                </button>
              </div>
              <Field id="player-name" label="Ваше ім’я">
                <input
                  id="player-name"
                  autoComplete="nickname"
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              {join && (
                <Field id="room-code" label="Код кімнати">
                  <input
                    id="room-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </Field>
              )}
              <p className="inline-error" role="status">
                {game.error}
              </p>
              <button
                className="primary full"
                type="submit"
                disabled={game.networkBusy}
                aria-busy={game.networkBusy}
              >
                {game.networkBusy
                  ? "Відкриваємо кімнату…"
                  : join
                    ? "Увійти до кімнати"
                    : "Створити кімнату"}
              </button>
              <small>Перший запуск кімнат іноді займає близько хвилини.</small>
            </form>
          ) : (
            <div className="notice">
              <strong>Онлайн поки недоступний</strong>
              <p>До відкриття кімнат можна зіграти повну партію з ботами.</p>
              <button
                className="outline full"
                onClick={() => setSetup("local")}
              >
                Перейти до тренування
              </button>
            </div>
          )}
        </Modal>
      )}
      {modal === "replace" && (
        <Modal
          title="Почати нову тренувальну партію?"
          onClose={() => setModal(null)}
        >
          <p>
            Попереднє тренувальне збереження буде замінено. Якщо хочете
            завершити стару партію, поверніться до неї.
          </p>
          <div className="button-row">
            <button
              className="outline"
              autoFocus
              onClick={() => setModal(null)}
            >
              Залишити збереження
            </button>
            <button className="primary" onClick={startLocal}>
              Почати нову партію
            </button>
          </div>
        </Modal>
      )}
      {modal === "tutorial" && (
        <Modal
          title={"Як грати · " + (tutorial + 1) + " / " + TUTORIAL.length}
          onClose={() => setModal(null)}
        >
          <div className="tutorial">
            <div className="tutorial-symbol">
              {["◈", "↗", "Λ", "◇"][tutorial]}
            </div>
            <h3>{TUTORIAL[tutorial].title}</h3>
            <p>{TUTORIAL[tutorial].text}</p>
            <div className="tutorial-dots">
              {TUTORIAL.map((_, i) => (
                <button
                  key={i}
                  aria-label={"Крок " + (i + 1)}
                  aria-pressed={i === tutorial}
                  onClick={() => setTutorial(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button
                className="outline"
                disabled={tutorial === 0}
                onClick={() => setTutorial(tutorial - 1)}
              >
                Назад
              </button>
              <button
                className="primary"
                onClick={() =>
                  tutorial < TUTORIAL.length - 1
                    ? setTutorial(tutorial + 1)
                    : setModal(null)
                }
              >
                {tutorial < TUTORIAL.length - 1 ? "Далі" : "Я готовий грати"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "rules" && (
        <Modal title="Правила країни VADA" onClose={() => setModal(null)}>
          <article className="rules">
            <h3>Мета</h3>
            <p>
              Після шостої сесії отримайте найбільше очок: очки активів і
              покращень + 1 за повні 200 монет + 2 за власний прийнятий закон +
              3 за виконану особисту ціль − скандали. За рівності порівнюємо
              власні закони, потім ділимо перемогу.
            </p>
            <h3>Хід та рух</h3>
            <p>
              Черга не обнуляється на початку дня. Одна дія — рух на 1–3 місця з
              можливою купівлею в кінці, повернення до парламенту, карта,
              Whisper, добір двох карт, покращення за 60 монет або підтримка
              (+20 монет та +1 вплив). Кожне покращення дає +5 щоденного доходу
              та +1 очко, максимум 2.
            </p>
            <h3>Парламент</h3>
            <p>
              Рівно 10 ходів усіх учасників разом → сесія. Присутність
              фіксується на початку. Подання закону коштує 1 впливу, максимум 2
              законопроєкти. Для прийняття потрібна більшість усього складу.
              Закон діє наступні 2 дні. Відсутність і утримання не є підтримкою.
            </p>
            <h3>Карти</h3>
            <p>
              Початкова рука: 2 дії та 2 контрдії. Колода має 40 карт — по 2
              копії кожної дії й контрдії. На початку нового дня добираєте 1
              карту. Межа руки — 6. У відповідь на атаку можна використати одну
              сумісну контрдію. Whisper — окрема здібність, контркартою не
              скасовується.
            </p>
            <h3>Доходи й угоди</h3>
            <p>
              Доходи нараховуються на початку днів 2–6. Після фіналу доходу вже
              немає. Підтверджений обмін повторно перевіряє гроші й власність
              обох сторін. До 3 власних пропозицій одночасно, неприйняті угоди
              закриваються після сесії.
            </p>
            <h3>Час і повернення</h3>
            <p>
              Тренування без таймерів. Онлайн: хід 30 с, реакція 20 с, подання
              30 с, переговори 120 с, голосування 30 с. Пропущений хід збирає
              підтримку; пропущений голос утримується. Оновлення вкладки
              повертає ваше місце в онлайн-кімнаті. Код кімнати не відновлює
              втрачене приватне місце.
            </p>
            <p className="notice">
              Це тестова редакція 0.2.0 alpha. Числа та здібності ще
              перевірятимуться у партіях із людьми.
            </p>
          </article>
        </Modal>
      )}
    </div>
  );
}
