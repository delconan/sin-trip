"use client";
/* eslint-disable @next/next/no-img-element */

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  BusFront,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Footprints as Walking,
  GripVertical,
  Hotel,
  Info,
  MapPin,
  Menu,
  Plane,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Share2,
  Sparkles,
  Ticket,
  TrainFront,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { airport, hotel, tripDays } from "@/data/seed";
import { EditableDayTitle } from "@/components/editable-day-title";
import { RouteComparisonDialog } from "@/components/route-comparison-dialog";
import {
  detectScheduleWarnings,
  estimateRoutes,
  getEndTime,
  recommendRoute,
  sortDayItems,
} from "@/lib/planner";
import { createInitialState, tripReducer } from "@/lib/trip-state";
import { useTripSync } from "@/lib/sync-client";
import type { ActivityCard, ActivityCategory, RouteMode, ScheduledItem } from "@/types/trip";

const storageKey = "singapore-family-trip-v1";

const filters: { key: "all" | ActivityCategory; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "attraction", label: "景点" },
  { key: "food", label: "美食" },
  { key: "shopping", label: "购物" },
  { key: "rest", label: "休息" },
];

const categoryLabel: Record<ActivityCategory, string> = {
  attraction: "玩",
  food: "吃",
  shopping: "逛",
  rest: "歇",
  transport: "行",
};

const routeIcon: Record<RouteMode, typeof Walking> = {
  walk: Walking,
  transit: TrainFront,
  taxi: BusFront,
};

function money(card: ActivityCard) {
  const price = card.price;
  if (!price) return "价格待定";
  if (price.kind === "free") return "免费";
  if (price.familyTotal !== undefined) return `家庭 S$${price.familyTotal}`;
  if (price.adult !== undefined) return `${price.kind === "from" ? "S$" : "约 S$"}${price.adult}${price.kind === "from" ? " 起" : "/人"}`;
  return price.note ?? "价格需复核";
}

function CandidateCard({ card, onSelect, onSchedule }: { card: ActivityCard; onSelect: () => void; onSchedule: (date: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `card:${card.id}` });
  return (
    <article
      ref={setNodeRef}
      className={`candidate-card accent-${card.accent ?? "leaf"} ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className="card-image" role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }} aria-label={`查看 ${card.title} 详情`}>
        {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" /> : <div className="image-fallback"><Sparkles /></div>}
        <span className="category-stamp">{categoryLabel[card.category]}</span>
        <span className="drag-handle" {...listeners} {...attributes} aria-label={`拖拽 ${card.title}`}><GripVertical size={16} /></span>
      </div>
      <button className="candidate-copy" onClick={onSelect}>
        <span className="candidate-title">{card.title}</span>
        <span className="candidate-meta"><Clock3 size={13} /> {card.durationMinutes} 分钟 · {money(card)}</span>
      </button>
      <div className="quick-add" aria-label={`把 ${card.title} 加入行程`}>
        <span>加入</span>
        {tripDays.map((day) => <button key={day.date} onClick={() => onSchedule(day.date)} aria-label={`加入${day.short}`}>{day.date.slice(-2).replace(/^0/, "")}</button>)}
      </div>
    </article>
  );
}

function ScheduledCard({
  item,
  card,
  previousEnd,
  transferMinutes,
  onTime,
  onRemove,
  onSelect,
}: {
  item: ScheduledItem;
  card: ActivityCard;
  previousEnd?: string;
  transferMinutes?: number;
  onTime: (time: string) => void;
  onRemove: () => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `item:${item.id}` });
  const warnings = detectScheduleWarnings({ item, card, previousEndTime: previousEnd, transferMinutes });
  const end = getEndTime(item.startTime, card.durationMinutes);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`scheduled-card accent-${card.accent ?? "leaf"} ${isDragging ? "is-dragging" : ""}`}
    >
      <div className="scheduled-time">
        <input aria-label={`${card.title} 开始时间`} type="time" step="900" value={item.startTime} onChange={(event) => onTime(event.target.value)} />
        <span>— {end}</span>
      </div>
      <button className="scheduled-body" onClick={onSelect}>
        <span className="tiny-stamp">{categoryLabel[card.category]}</span>
        <span><strong>{card.title}</strong><small><MapPin size={12} /> {card.subtitle ?? card.address.split(",")[0]}</small></span>
      </button>
      {warnings.length > 0 && <div className="warnings">{warnings.map((warning) => <span key={warning}>! {warning}</span>)}</div>}
      <button className="item-grip" {...listeners} {...attributes} aria-label={`移动 ${card.title}`}><GripVertical size={17} /></button>
      <button className="item-delete" onClick={onRemove} aria-label={`移除 ${card.title}`}><X size={14} /></button>
    </article>
  );
}

function RouteRibbon({ from, to, date, departureTime, hasLuggage = false }: { from: Pick<ActivityCard, "title" | "latitude" | "longitude">; to: Pick<ActivityCard, "title" | "latitude" | "longitude">; date: string; departureTime: string; hasLuggage?: boolean }) {
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const fallbackRoutes = useMemo(() => estimateRoutes(from, to, departureTime, hasLuggage), [from, to, departureTime, hasLuggage]);
  const query = useQuery({
    queryKey: ["route", from.latitude, from.longitude, to.latitude, to.longitude, date, departureTime, hasLuggage],
    queryFn: async () => {
      const response = await fetch("/api/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: from, end: to, date, time: departureTime, hasLuggage }) });
      if (!response.ok) throw new Error("路线查询失败");
      return response.json() as Promise<{ routes: ReturnType<typeof estimateRoutes>; source: "onemap" | "estimate" }>;
    },
    enabled: process.env.NODE_ENV !== "test",
    staleTime: 6 * 60 * 60 * 1000,
  });
  const mergedRoutes = fallbackRoutes.map((fallback) => query.data?.routes.find((route) => route.mode === fallback.mode) ?? fallback);
  const recommendation = recommendRoute(mergedRoutes, { departureTime, hasLuggage });
  const routes = mergedRoutes.map((option) => ({ ...option, recommended: option.mode === recommendation?.mode }));
  const route = routes.find((option) => option.recommended) ?? routes[0];
  const Icon = routeIcon[route.mode];
  return (
    <>
      <button className="route-ribbon" onClick={() => setComparisonOpen(true)} aria-label={`查看 ${from.title} 到 ${to.title} 的交通方案`} title="点击比较步行、公交和打车">
        <span className="route-dash" />
        <Icon size={14} />
        <span>{route.mode === "taxi" ? "打车" : route.mode === "transit" ? "公交/MRT" : "步行"} {route.durationMinutes} 分钟</span>
        <ArrowRight size={12} />
      </button>
      {comparisonOpen && <RouteComparisonDialog fromTitle={from.title} toTitle={to.title} departureTime={departureTime} routes={routes} onClose={() => setComparisonOpen(false)} />}
    </>
  );
}

function DayColumn({ date, title, items, cards, dispatch, onSelect }: { date: (typeof tripDays)[number]; title: string; items: ScheduledItem[]; cards: ActivityCard[]; dispatch: React.Dispatch<Parameters<typeof tripReducer>[1]>; onSelect: (card: ActivityCard) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date.date}` });
  const sorted = sortDayItems(items);
  const cardFor = (item: ScheduledItem) => cards.find((card) => card.id === item.cardId)!;
  const firstCard = sorted[0] ? cardFor(sorted[0]) : undefined;
  const lastCard = sorted.at(-1) ? cardFor(sorted.at(-1)!) : undefined;
  return (
    <section ref={setNodeRef} data-testid="day-column" className={`day-column ${isOver ? "is-over" : ""}`}>
      <header className="day-header">
        <div className="date-stamp"><strong>{date.short}</strong><span>{date.weekday}</span></div>
        <div><small>DAY {tripDays.findIndex((day) => day.date === date.date) + 1}</small><EditableDayTitle dateLabel={date.short} title={title} onSave={(nextTitle) => dispatch({ type: "set-day-title", date: date.date, title: nextTitle })} /></div>
      </header>
      <div className="day-route-start"><Hotel size={14} /> {date.date === "2026-07-07" ? "樟宜机场" : hotel.title}</div>
      {firstCard && firstCard.id !== "arrival" && <RouteRibbon from={date.date === "2026-07-07" ? airport : hotel} to={firstCard} date={date.date} departureTime={sorted[0].startTime} hasLuggage={date.date === "2026-07-07"} />}
      <SortableContext items={sorted.map((item) => `item:${item.id}`)} strategy={verticalListSortingStrategy}>
        <div className="day-items">
          {sorted.map((item, index) => {
            const card = cardFor(item);
            const previous = index > 0 ? cardFor(sorted[index - 1]) : undefined;
            const previousEnd = previous ? getEndTime(sorted[index - 1].startTime, previous.durationMinutes) : undefined;
            const transfer = previous ? estimateRoutes(previous, card, previousEnd ?? item.startTime).find((route) => route.recommended)?.durationMinutes : undefined;
            return (
              <div key={item.id}>
                {previous && <RouteRibbon from={previous} to={card} date={date.date} departureTime={previousEnd!} hasLuggage={card.category === "transport"} />}
                <ScheduledCard
                  item={item}
                  card={card}
                  previousEnd={previousEnd}
                  transferMinutes={transfer}
                  onTime={(startTime) => dispatch({ type: "set-time", itemId: item.id, startTime })}
                  onRemove={() => dispatch({ type: "remove-item", itemId: item.id })}
                  onSelect={() => onSelect(card)}
                />
              </div>
            );
          })}
        </div>
      </SortableContext>
      {sorted.length === 0 && <div className="empty-day"><Plus />把卡片拖到这里</div>}
      {lastCard && date.date !== "2026-07-10" && <RouteRibbon from={lastCard} to={hotel} date={date.date} departureTime={getEndTime(sorted.at(-1)!.startTime, lastCard.durationMinutes)} />}
      <div className="day-route-end">{date.date === "2026-07-10" ? <><Plane size={14} /> 16:00 起飞</> : <><Hotel size={14} /> 返回酒店</>}</div>
    </section>
  );
}

function CustomActivityDialog({ onClose, onSave }: { onClose: () => void; onSave: (card: ActivityCard) => void }) {
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string>();
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [places, setPlaces] = useState<Array<{ title: string; address: string; latitude: number; longitude: number }>>([]);
  useEffect(() => {
    if (address.trim().length < 3) return;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(address)}`);
        const payload = await response.json();
        if (response.ok) setPlaces(payload.results ?? []);
      } catch { setPlaces([]); }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [address]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const address = String(data.get("address") ?? "").trim();
    if (!title || !address) return setError("请填写活动名称和地点");
    const durationMinutes = Number(data.get("duration"));
    const adult = Number(data.get("adult")) || undefined;
    const child = Number(data.get("child")) || undefined;
    onSave({
      id: `custom-${Date.now()}`,
      title,
      subtitle: "自定义活动",
      category: String(data.get("category")) as ActivityCategory,
      description: String(data.get("notes") ?? "临时加入的旅行灵感。"),
      address,
      latitude: Number(data.get("latitude")) || hotel.latitude,
      longitude: Number(data.get("longitude")) || hotel.longitude,
      durationMinutes,
      price: adult || child ? { currency: "SGD", adult, child, familyTotal: adult && child ? adult * 2 + child * 2 : undefined, kind: "exact", source: "manual", checkedAt: new Date().toISOString().slice(0, 10) } : undefined,
      imageUrl,
      tags: ["自定义"],
      accent: "sun",
      custom: true,
    });
  };
  const readImage = (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) return setError("图片需为 JPG、PNG 或 WebP，且不超过 5MB");
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="custom-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-title" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="关闭"><X /></button>
        <p className="eyebrow">ADD A NEW PIN</p>
        <h2 id="custom-title">新建自定义活动</h2>
        <p className="dialog-lead">把临时灵感也做成能拖动、能算交通的旅行卡。</p>
        <div className="form-grid">
          <label className="span-2">活动名称<input name="title" placeholder="例如：国家美术馆儿童展" /></label>
          <label>类型<select name="category" defaultValue="attraction"><option value="attraction">景点</option><option value="food">美食</option><option value="shopping">购物</option><option value="rest">休息</option></select></label>
          <label>时长<select name="duration" defaultValue="60">{Array.from({ length: 48 }, (_, index) => (index + 1) * 15).map((value) => <option key={value} value={value}>{value} 分钟</option>)}</select></label>
          <label className="span-2 place-field">地点<input name="address" value={address} onChange={(event) => { setAddress(event.target.value); if (event.target.value.trim().length < 3) setPlaces([]); }} placeholder="输入新加坡地点或地址" />
            {places.length > 0 && <span className="place-results">{places.map((place) => <button type="button" key={`${place.latitude}-${place.longitude}`} aria-label={`选择 ${place.title}`} onClick={() => { setAddress(place.address); setLatitude(String(place.latitude)); setLongitude(String(place.longitude)); setPlaces([]); }}><strong>{place.title}</strong><small>{place.address}</small></button>)}</span>}
          </label>
          <label>纬度（可选）<input name="latitude" type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="1.2932" /></label>
          <label>经度（可选）<input name="longitude" type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="103.8522" /></label>
          <label>成人价 S$<input name="adult" type="number" min="0" step="0.1" /></label>
          <label>儿童价 S$<input name="child" type="number" min="0" step="0.1" /></label>
          <label className="span-2">备注<textarea name="notes" placeholder="预约方式、孩子注意事项、想吃什么……" /></label>
          <label className="image-upload span-2">{imageUrl ? <img src={imageUrl} alt="自定义活动预览" /> : <Sparkles />}<span>添加卡片图片（可选）</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => readImage(event.target.files?.[0])} /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="save-card" type="submit"><Plus size={17} />保存到卡片库</button>
      </form>
    </div>
  );
}

function DetailDrawer({ card, onClose, onDelete }: { card: ActivityCard; onClose: () => void; onDelete?: () => void }) {
  return (
    <aside className="detail-drawer" aria-label={`${card.title} 详情`}>
      <button className="drawer-close" onClick={onClose} aria-label="关闭详情"><X /></button>
      <div className="drawer-image">{card.imageUrl ? <img src={card.imageUrl} alt="" /> : <Sparkles />}<span className="category-stamp">{categoryLabel[card.category]}</span></div>
      <p className="eyebrow">TRAVEL NOTE</p>
      <h2>{card.title}</h2>
      <p className="drawer-subtitle">{card.subtitle}</p>
      <p className="drawer-description">{card.description}</p>
      <dl className="fact-list">
        <div><dt><Clock3 />建议时长</dt><dd>{card.durationMinutes} 分钟</dd></div>
        <div><dt><Ticket />家庭预算</dt><dd>{money(card)}</dd></div>
        <div><dt><MapPin />地点</dt><dd>{card.address}</dd></div>
      </dl>
      {card.constraints?.length && <div className="note-box"><Info size={16} /><div>{card.constraints.map((item) => <p key={item}>{item}</p>)}</div></div>}
      <div className="tag-row">{card.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      {card.price && <p className="source-note">价格核对：{card.price.checkedAt} · {card.price.source === "klook" ? "Klook 优先" : card.price.source === "official" ? "官网" : "手动"}{card.price.note ? ` · ${card.price.note}` : ""}</p>}
      <div className="drawer-actions">
        {(card.bookingUrl || card.price?.sourceUrl) && <a href={card.bookingUrl ?? card.price?.sourceUrl} target="_blank" rel="noreferrer">查看票价 <ExternalLink size={14} /></a>}
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`} target="_blank" rel="noreferrer">打开地图 <MapPin size={14} /></a>
      </div>
      {onDelete && <button className="delete-custom" onClick={onDelete}><Trash2 size={15} />删除自定义卡</button>}
      {card.imageCredit && <p className="image-credit">图片：{card.imageCredit}</p>}
    </aside>
  );
}

export function PlannerApp() {
  const [state, dispatch] = useReducer(tripReducer, undefined, createInitialState);
  const sync = useTripSync(state, dispatch);
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ActivityCard>();
  const [customOpen, setCustomOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"library" | "plan">("plan");
  const loadedRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try { dispatch({ type: "hydrate", state: JSON.parse(stored) }); } catch { localStorage.removeItem(storageKey); }
    }
    queueMicrotask(() => { loadedRef.current = true; });
  }, []);

  useEffect(() => {
    if (loadedRef.current) localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const libraryCards = useMemo(() => {
    const scheduledCardIds = new Set(state.scheduledItems.map((item) => item.cardId));
    return state.cards.filter((card) => {
      if (scheduledCardIds.has(card.id) && !card.custom) return false;
      if (filter !== "all" && card.category !== filter) return false;
      const haystack = `${card.title} ${card.subtitle ?? ""} ${card.tags.join(" ")}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [state.cards, state.scheduledItems, filter, query]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const targetItemId = overId.startsWith("item:") ? overId.slice(5) : undefined;
    const targetItem = targetItemId ? state.scheduledItems.find((item) => item.id === targetItemId) : undefined;
    const date = overId.startsWith("day:") ? overId.slice(4) : targetItem?.date;
    if (!date) return;
    if (activeId.startsWith("card:")) dispatch({ type: "schedule", cardId: activeId.slice(5), date });
    if (activeId.startsWith("item:")) dispatch({ type: "move", itemId: activeId.slice(5), date, position: targetItem?.position ?? state.scheduledItems.filter((item) => item.date === date).length });
  };

  const reset = () => {
    if (window.confirm("恢复亲子舒适版底稿？你的本地调整和自定义卡会被清除。")) dispatch({ type: "reset" });
  };

  const share = async () => {
    await navigator.clipboard?.writeText(sync.shareUrl ?? window.location.href);
    window.alert(sync.shareUrl ? "私密编辑链接已复制。拿到链接的人可以查看和修改这份行程。" : "当前链接已复制。本地演示数据保存在本机；配置 Supabase 后会自动启用跨设备同步。");
  };

  const resetCloudAccess = async () => {
    if (!window.confirm("生成新链接并让其他设备退出这份行程？")) return;
    const token = await sync.resetAccess();
    if (token) window.alert("新私密链接已生成，旧链接和其他设备已失效。");
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <main className="planner-shell">
        <div className="paper-grain" />
        <header className="hero">
          <div className="brand-mark"><span>SG</span><small>07—10<br />JUL 2026</small></div>
          <div className="hero-copy">
            <p className="eyebrow">A TROPICAL FIELD NOTE · 2 ADULTS + 2 LITTLE EXPLORERS</p>
            <h1>四个人的小小新加坡</h1>
            <p>把想去的地方拖进日期，让路线在卡片之间自然长出来。</p>
          </div>
          <div className="hero-meta">
            <div><Hotel /><span><strong>Swissôtel</strong><small>The Stamford</small></span></div>
            <div><Plane /><span><strong>7月7日 15:00</strong><small>抵达 SIN · 7月10日 16:00 离境</small></span></div>
          </div>
          <div className="top-actions">
            <span className={`sync-badge sync-${sync.status}`}><span />{sync.status === "local" ? "本地演示" : sync.status === "connecting" ? "连接共享行程" : sync.status === "saving" ? "保存中" : sync.status === "synced" ? "已同步" : "同步需重试"}</span>
            <button onClick={share}><Share2 size={16} />分享</button>
            {sync.tripId && <button onClick={resetCloudAccess}><ShieldCheck size={16} />重置访问</button>}
            <button onClick={reset}><RotateCcw size={16} />恢复底稿</button>
          </div>
        </header>

        <div className="mobile-tabs">
          <button className={mobileTab === "library" ? "active" : ""} onClick={() => setMobileTab("library")}><Menu />卡片库</button>
          <button className={mobileTab === "plan" ? "active" : ""} onClick={() => setMobileTab("plan")}><CalendarDays />每日行程</button>
        </div>

        <div className="planner-grid">
          <aside className={`library-panel ${mobileTab === "library" ? "mobile-active" : ""}`}>
            <div className="panel-heading"><div><p className="eyebrow">PIN BOARD</p><h2>还想去哪里？</h2></div><span>{libraryCards.length} 张卡</span></div>
            <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜景点、美食或地区" /></label>
            <div className="filter-row">{filters.map((item) => <button key={item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div>
            <button className="create-card" onClick={() => setCustomOpen(true)} aria-label="新建自定义活动"><Plus />新建自定义活动<span>名称 · 地点 · 时长 · 图片</span></button>
            <div className="candidate-list">
              {libraryCards.map((card) => <CandidateCard key={card.id} card={card} onSelect={() => setSelected(card)} onSchedule={(date) => dispatch({ type: "schedule", cardId: card.id, date })} />)}
              {libraryCards.length === 0 && <div className="empty-library"><Check />这些卡都已经上路了</div>}
            </div>
          </aside>

          <section className={`board-panel ${mobileTab === "plan" ? "mobile-active" : ""}`}>
            <div className="board-topline">
              <div><span className="route-legend"><Walking /> 步行</span><span className="route-legend"><TrainFront /> MRT / 公交</span><span className="route-legend"><BusFront /> 打车</span></div>
              <p><Info />点击交通线比较步行、公交与打车；OneMap 未连接时使用本地估时</p>
            </div>
            <div className="days-board">
              {tripDays.map((day) => <DayColumn key={day.date} date={day} title={state.dayTitles[day.date] ?? day.title} items={state.scheduledItems.filter((item) => item.date === day.date)} cards={state.cards} dispatch={dispatch} onSelect={setSelected} />)}
            </div>
          </section>
        </div>

        <footer className="planner-footer"><span>狮城小队 · REV {state.revision}</span><p>票价核对于 2026-06-27，订票前请再次确认。</p><span>ASIA / SINGAPORE</span></footer>
      </main>
      {customOpen && <CustomActivityDialog onClose={() => setCustomOpen(false)} onSave={(card) => { dispatch({ type: "add-card", card }); setCustomOpen(false); setSelected(card); }} />}
      {selected && <DetailDrawer card={selected} onClose={() => setSelected(undefined)} onDelete={selected.custom ? () => { dispatch({ type: "delete-card", cardId: selected.id }); setSelected(undefined); } : undefined} />}
    </DndContext>
  );
}
