import type { CreatureId, Group } from "./types.js";
export const RULES_VERSION = "0.2.0-alpha.1";
export const GROUPS: Record<
  Group,
  { name: string; color: string; emblem: string }
> = {
  trade: { name: "Торгівля", color: "#dca963", emblem: "coin" },
  industry: { name: "Виробництво", color: "#c77d66", emblem: "anvil" },
  media: { name: "Медіа", color: "#85a5a4", emblem: "eye" },
  logistics: { name: "Логістика", color: "#9eab72", emblem: "route" },
};
export const CREATURES: {
  id: CreatureId;
  role: string;
  color: string;
  subtitle: string;
  ability: string;
  artifact: string;
  lore: string;
}[] = [
  {
    id: "MANIPUL",
    role: "Інтриги",
    color: "#bca0c4",
    subtitle: "Нитки, що рухають владою",
    ability:
      "За 2 впливу забирає до 2 впливу в суперника та повертає собі 1. Один раз за день, весь хід.",
    artifact: "Stringae Tenebrarum · Нитки Маніпуляцій",
    lore: "Під мармуровими сходами живе той, хто чує кожну обіцянку. Він ніколи не сидить на троні — лише тримає його нитки.",
  },
  {
    id: "TRADOR",
    role: "Вплив і торгівля",
    color: "#e0ad63",
    subtitle: "Ціна є у всього",
    ability: "За 2 впливу отримує 60 монет. Один раз за день, весь хід.",
    artifact: "Obolus Vortici · Монета Переваги",
    lore: "Остання монета старої імперії обертається в його долоні. Торгуючи майбутнім, TRADOR завжди залишає собі решту.",
  },
  {
    id: "PACTA",
    role: "Угоди",
    color: "#9bb784",
    subtitle: "Слово важче за золото",
    ability:
      "За 2 впливу створює захист від наступної атаки. Один раз за день, весь хід.",
    artifact: "Silentium Pacta · Кодекс Замовчування",
    lore: "Коли перший договір розпався на попіл, PACTA зібрав його літери. Його печатка нагадує, що домовленість має дві сторони.",
  },
  {
    id: "RHETOR",
    role: "Мова",
    color: "#cf8878",
    subtitle: "Одна фраза змінює залу",
    ability:
      "За 2 впливу добирає 2 карти та отримує 1 вплив. Один раз за день, весь хід.",
    artifact: "Gladius Echo · ЕхоКлинок",
    lore: "Під куполом досі лунає перша промова RHETOR. Її останнє слово ніхто не пам’ятає — кожен чує власне.",
  },
  {
    id: "OBFUSCO",
    role: "Хаос і приховування",
    color: "#8fa8c0",
    subtitle: "Тінь знає коротший шлях",
    ability:
      "За 2 впливу переходить на будь-яке місце маршруту та добирає карту. Купівля цього ходу недоступна. Один раз за день.",
    artifact: "Nullis Crysallis · Кокон Пустоти",
    lore: "Там, де закінчується карта, починається OBFUSCO. Його сліди ведуть до дверей, яких учора ще не існувало.",
  },
];
export const ASSETS: {
  id: string;
  name: string;
  group: Group;
  tile: number;
  price: number;
  income: number;
  points: number;
  description: string;
}[] = [
  {
    id: "market",
    name: "Ринок «Золота монета»",
    group: "trade",
    tile: 0,
    price: 80,
    income: 15,
    points: 1,
    description:
      "Крамниці під бронзовими навісами. Кожен договір починається з ціни.",
  },
  {
    id: "studio",
    name: "Студія «Канал Чесно»",
    group: "media",
    tile: 1,
    price: 100,
    income: 20,
    points: 2,
    description: "Один ефір може змінити думку цілого міста.",
  },
  {
    id: "forge",
    name: "Майстерня «Молот»",
    group: "industry",
    tile: 3,
    price: 110,
    income: 20,
    points: 2,
    description: "Тут відливають інструменти й символи влади.",
  },
  {
    id: "depot",
    name: "Поштове депо",
    group: "logistics",
    tile: 5,
    price: 90,
    income: 15,
    points: 1,
    description: "Тихі кур’єри доставляють товари й важливі звістки.",
  },
  {
    id: "exchange",
    name: "Біржа «Конгломерат»",
    group: "trade",
    tile: 6,
    price: 150,
    income: 30,
    points: 3,
    description: "Під високим годинником торгують навіть очікуваннями.",
  },
  {
    id: "press",
    name: "Друкарня «Правда»",
    group: "media",
    tile: 8,
    price: 120,
    income: 25,
    points: 2,
    description: "Пергамент, чорнило та тисяча голосів.",
  },
  {
    id: "factory",
    name: "Фабрика «Нова ера»",
    group: "industry",
    tile: 10,
    price: 160,
    income: 30,
    points: 3,
    description: "Димарі працюють, доки країна домовляється про майбутнє.",
  },
  {
    id: "harbor",
    name: "Порт «Сірий причал»",
    group: "logistics",
    tile: 11,
    price: 140,
    income: 25,
    points: 3,
    description: "Звідси вирушають каравани за обрій карти.",
  },
  {
    id: "guild",
    name: "Купецька гільдія",
    group: "trade",
    tile: 13,
    price: 120,
    income: 25,
    points: 2,
    description: "Три печатки перетворюють потиск руки на торговельний шлях.",
  },
  {
    id: "archive",
    name: "Архів «Люкс»",
    group: "media",
    tile: 15,
    price: 80,
    income: 15,
    points: 1,
    description: "Архів пам’ятає те, що промовці воліли б забути.",
  },
  {
    id: "works",
    name: "Кам’яний комбінат",
    group: "industry",
    tile: 16,
    price: 130,
    income: 25,
    points: 2,
    description: "Мармур для парламенту та каміння для нових кварталів.",
  },
  {
    id: "caravan",
    name: "Караванний двір",
    group: "logistics",
    tile: 18,
    price: 100,
    income: 20,
    points: 2,
    description: "Країну об’єднують шляхи, склади й терплячі мандрівники.",
  },
];
export const TILE_NAMES = Array.from(
  { length: 20 },
  (_, i) =>
    ASSETS.find((a) => a.tile === i)?.name ??
    (
      {
        2: "Площа шепотів",
        4: "Сад Прагматів",
        7: "Міст обіцянок",
        9: "Вежа мовчання",
        12: "Сходи Сенату",
        14: "Квартал печаток",
        17: "Стежка тіней",
        19: "Брама країни",
      } as Record<number, string>
    )[i],
);
export interface Card {
  id: string;
  name: string;
  type: "action" | "counter";
  effect: string;
  text: string;
  attack?: boolean;
  counters?: string[];
}
export const CARDS: Card[] = [
  {
    id: "grant",
    name: "Грант гільдії",
    type: "action",
    effect: "grant",
    text: "Отримайте 50 монет.",
  },
  {
    id: "lobby",
    name: "Закулісна підтримка",
    type: "action",
    effect: "lobby",
    text: "Отримайте 2 впливу, максимум 6.",
  },
  {
    id: "cleanup",
    name: "Відкрите пояснення",
    type: "action",
    effect: "cleanup",
    text: "Приберіть 1 власний скандал.",
  },
  {
    id: "rumor",
    name: "Гучний компромат",
    type: "action",
    effect: "rumor",
    attack: true,
    text: "Суперник отримує 1 скандал, максимум 3. Можлива контрдія.",
  },
  {
    id: "investigation",
    name: "Журналістське розслідування",
    type: "action",
    effect: "investigation",
    attack: true,
    text: "Суперник втрачає до 50 монет і отримує 1 скандал. Потрібна власна медіа-нерухомість. Можлива контрдія.",
  },
  {
    id: "sabotage",
    name: "Зупинка поставок",
    type: "action",
    effect: "sabotage",
    attack: true,
    text: "Один актив суперника не приносить дохід наступного дня. Можлива контрдія.",
  },
  {
    id: "dividend",
    name: "Позачергові дивіденди",
    type: "action",
    effect: "dividend",
    text: "Отримайте 15 монет за кожен власний актив.",
  },
  {
    id: "speculation",
    name: "Вдала угода",
    type: "action",
    effect: "speculation",
    text: "Отримайте 20 монет та ще 20 за кожен торговий актив.",
  },
  {
    id: "renovate",
    name: "Реновація кварталу",
    type: "action",
    effect: "renovate",
    text: "Покращіть один власний актив без оплати. Максимум 2 покращення.",
  },
  {
    id: "archive",
    name: "Таємний архів",
    type: "action",
    effect: "archive",
    text: "Доберіть 2 карти. Межа руки — 6.",
  },
  {
    id: "petition",
    name: "Термінова петиція",
    type: "action",
    effect: "petition",
    text: "Поверніться до парламенту та отримайте 1 вплив.",
  },
  {
    id: "pressure",
    name: "Політичний тиск",
    type: "action",
    effect: "pressure",
    attack: true,
    text: "Суперник втрачає до 2 впливу. Можлива контрдія.",
  },
  {
    id: "shield",
    name: "Право на відповідь",
    type: "counter",
    effect: "block",
    counters: ["all"],
    text: "Скасуйте одну спрямовану на вас карткову атаку.",
  },
  {
    id: "rebuttal",
    name: "Викриття маніпуляції",
    type: "counter",
    effect: "rebuttal",
    counters: ["all"],
    text: "Скасуйте атаку; її автор отримує 1 скандал.",
  },
  {
    id: "insurance",
    name: "Страховий фонд",
    type: "counter",
    effect: "block",
    counters: ["sabotage"],
    text: "Скасуйте зупинку поставок.",
  },
  {
    id: "alibi",
    name: "Незаперечне алібі",
    type: "counter",
    effect: "block",
    counters: ["rumor", "investigation"],
    text: "Скасуйте компромат або розслідування.",
  },
  {
    id: "injunction",
    name: "Судова заборона",
    type: "counter",
    effect: "block",
    counters: ["investigation", "sabotage"],
    text: "Скасуйте розслідування або зупинку поставок.",
  },
  {
    id: "silence",
    name: "Регламент мовчання",
    type: "counter",
    effect: "block",
    counters: ["pressure"],
    text: "Скасуйте політичний тиск.",
  },
  {
    id: "mediation",
    name: "Посередництво",
    type: "counter",
    effect: "mediation",
    counters: ["all"],
    text: "Скасуйте атаку та отримайте 20 монет.",
  },
  {
    id: "veil",
    name: "Завіса тіней",
    type: "counter",
    effect: "veil",
    counters: ["all"],
    text: "Витратьте 1 вплив і скасуйте атаку.",
  },
];
export const LAWS: {
  id: string;
  name: string;
  text: string;
  group?: Group;
  effect: string;
}[] = [
  {
    id: "trade_relief",
    name: "Вільна торгівля",
    group: "trade",
    effect: "group",
    text: "Торгові активи отримують +10 монет доходу протягом наступних 2 днів.",
  },
  {
    id: "industrial_relief",
    name: "Виробничий стимул",
    group: "industry",
    effect: "group",
    text: "Виробничі активи отримують +10 монет доходу протягом наступних 2 днів.",
  },
  {
    id: "media_relief",
    name: "Свобода слова",
    group: "media",
    effect: "group",
    text: "Медіа-активи отримують +10 монет доходу протягом наступних 2 днів.",
  },
  {
    id: "logistics_relief",
    name: "Відкриті шляхи",
    group: "logistics",
    effect: "group",
    text: "Логістичні активи отримують +10 монет доходу протягом наступних 2 днів.",
  },
  {
    id: "integrity",
    name: "Кодекс доброчесності",
    effect: "integrity",
    text: "Наступні 2 дні на початку дня кожен сплачує до 15 монет за кожен свій скандал.",
  },
  {
    id: "solidarity",
    name: "Фонд рівноваги",
    effect: "solidarity",
    text: "Наступні 2 дні гравці з 0–1 активом отримують 30 монет на початку дня.",
  },
];
export const EVENTS = [
  {
    id: "festival",
    name: "Свято країни",
    text: "Кожен отримує 20 монет.",
    effect: "festival",
  },
  {
    id: "rumble",
    name: "Шепіт у кулуарах",
    text: "Кожен отримує 1 вплив, максимум 6.",
    effect: "rumble",
  },
  {
    id: "calm",
    name: "Тихий день",
    text: "Наслідки дня визначають лише ваші рішення.",
    effect: "calm",
  },
  {
    id: "reconciliation",
    name: "День примирення",
    text: "Кожен прибирає 1 скандал.",
    effect: "reconciliation",
  },
];
export const GOALS = [
  {
    id: "estate",
    name: "Власник кварталу",
    text: "Завершіть партію з 3 або більше активами.",
  },
  {
    id: "trade",
    name: "Купець",
    text: "Завершіть партію з 2 торговими активами.",
  },
  {
    id: "industry",
    name: "Майстер",
    text: "Завершіть партію з 2 виробничими активами.",
  },
  {
    id: "media",
    name: "Голос країни",
    text: "Завершіть партію з 2 медіа-активами.",
  },
  {
    id: "logistics",
    name: "Володар шляхів",
    text: "Завершіть партію з 2 логістичними активами.",
  },
  { id: "laws", name: "Законодавець", text: "Проведіть 2 власні закони." },
  { id: "rich", name: "Скарбник", text: "Завершіть партію з 700 монетами." },
  {
    id: "clean",
    name: "Чиста репутація",
    text: "Прийміть власний закон і завершiть без скандалів.",
  },
  {
    id: "attendance",
    name: "Вірний Сенату",
    text: "Будьте присутні на 4 парламентських сесіях.",
  },
  {
    id: "whisper",
    name: "Пробудження NUMBRA",
    text: "Використайте Whisper 3 рази.",
  },
];
export const INSTITUTIONS = [
  { name: "Сенат Прагматів", text: "Розрахунок, стабільність і технократія." },
  { name: "Орден Молота Слова", text: "Присяга, порядок і відповідальність." },
  { name: "Золотий Конгломерат", text: "Торгівля, капітал і ціни." },
  { name: "Колектив Правди", text: "Архів, докази та викриття." },
  {
    name: "Сірі Адміністратори",
    text: "Система, логістика й прихований контроль.",
  },
];
export function creature(id: string) {
  return CREATURES.find((c) => c.id === id)!;
}
export function card(id: string) {
  return CARDS.find((c) => c.id === id);
}
export function law(id: string) {
  return LAWS.find((c) => c.id === id);
}
