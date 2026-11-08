"use client";
import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopo from "us-atlas/states-10m.json";

const FIPS: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI",
  "16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
  "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH",
  "40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
  "54":"WV","55":"WI","56":"WY","72":"PR",
};

type Props = {
  values: Record<string, number>;           // state abbrev -> value
  label: (state: string) => string;          // tooltip text
  color?: string;
};

export default function USMap({ values, label, color = "#242931" }: Props) {
  const [hover, setHover] = useState<{ s: string; x: number; y: number } | null>(null);
  const { paths, max } = useMemo(() => {
    const geo = feature(statesTopo as any, (statesTopo as any).objects.states) as any;
    const proj = geoAlbersUsa().fitSize([960, 600], geo);
    const path = geoPath(proj);
    const max = Math.max(1, ...Object.values(values));
    return { paths: geo.features.map((f: any) => ({ id: FIPS[String(f.id).padStart(2, "0")], d: path(f) ?? "" })), max };
  }, [values]);

  const fill = (s: string) => {
    const v = values[s];
    if (!v) return "#ebecee";
    const t = 0.15 + 0.85 * Math.sqrt(v / max);
    return `color-mix(in srgb, ${color} ${Math.round(t * 100)}%, white)`;
  };

  return (
    <div className="relative">
      <svg viewBox="0 0 960 600" className="w-full h-auto" role="img" aria-label="Map of the United States">
        {paths.map((p: any, i: number) => (
          <path key={i} d={p.d} fill={fill(p.id)} stroke="#fff" strokeWidth={1}
            onMouseMove={(e) => setHover({ s: p.id, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })}
            onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover?.s && (
        <div className="absolute pointer-events-none text-xs bg-white border rounded px-2 py-1 shadow"
          style={{ left: hover.x + 12, top: hover.y + 12, borderColor: "var(--rule)" }}>
          <b>{hover.s}</b> {label(hover.s)}
        </div>
      )}
    </div>
  );
}
