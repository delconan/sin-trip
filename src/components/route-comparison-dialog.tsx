"use client";

import { BusFront, Check, ExternalLink, Footprints, TrainFront, X } from "lucide-react";
import { useEffect } from "react";
import { estimateFamilyRouteFare } from "@/lib/planner";
import type { RouteMode, RouteOption } from "@/types/trip";

const labels: Record<RouteMode, string> = { walk: "步行", transit: "公交 / MRT", taxi: "打车" };
const icons = { walk: Footprints, transit: TrainFront, taxi: BusFront };

export function RouteComparisonDialog({
  fromTitle,
  toTitle,
  departureTime,
  routes,
  onClose,
}: {
  fromTitle: string;
  toTitle: string;
  departureTime: string;
  routes: RouteOption[];
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop route-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="route-comparison" role="dialog" aria-modal="true" aria-labelledby="route-comparison-title">
        <button className="modal-close" aria-label="关闭交通方案对比" onClick={onClose}><X size={17} /></button>
        <p className="eyebrow">MOVE LIKE A LOCAL · FAMILY OF FOUR</p>
        <h2 id="route-comparison-title">交通方案对比</h2>
        <p className="route-journey"><strong>{fromTitle}</strong><span>→</span><strong>{toTitle}</strong><small>{departureTime} 出发</small></p>
        <div className="route-options">
          {routes.map((route) => {
            const Icon = icons[route.mode];
            const fare = estimateFamilyRouteFare(route, departureTime);
            return (
              <article className={`route-option ${route.recommended ? "recommended" : ""}`} key={route.mode}>
                {route.recommended && <span className="route-pick"><Check size={11} /> 推荐</span>}
                <div className="route-option-icon"><Icon size={21} /></div>
                <h3>{labels[route.mode]}</h3>
                <div className="route-numbers">
                  <strong>{route.durationMinutes}<small>分钟</small></strong>
                  <span>{(route.distanceMeters / 1000).toFixed(1)} km</span>
                </div>
                <p className="route-price"><small>2 大 2 小预估</small><strong>{fare.label}</strong></p>
                <p className="route-fare-note">{fare.note}</p>
                <a href={route.mapsUrl} target="_blank" rel="noreferrer" aria-label={`${labels[route.mode]} Google Maps 查询`}>
                  Google Maps 查询 <ExternalLink size={12} />
                </a>
              </article>
            );
          })}
        </div>
        <p className="route-source-note">
          票价核对于 2026-06-28。公交参考 <a href="https://www.ptc.gov.sg/fares/public-transport-fares-and-passes/" target="_blank" rel="noreferrer">PTC</a>，
          出租车参考 <a href="https://www.cdgtaxi.com.sg/ride-with-us/fares/" target="_blank" rel="noreferrer">ComfortDelGro</a>；以现场及叫车应用最终报价为准。
        </p>
      </section>
    </div>
  );
}
