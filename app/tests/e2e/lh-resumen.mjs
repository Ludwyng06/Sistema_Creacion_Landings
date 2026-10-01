// Resume los informes de Lighthouse de docs/bitacora/capturas/dia8B/<PREFIJO>-*.json (por defecto `lh`; `PREFIJO=lh-despues`) en una tabla.
import { readFileSync } from "node:fs";
for (const n of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(`../docs/bitacora/capturas/dia8B/${process.env.PREFIJO ?? "lh"}-${n}.json`, "utf8"));
  const c = j.categories;
  const pct = (k) => Math.round((c[k]?.score ?? 0) * 100);
  console.log(n, "| rend", pct("performance"), "| acc", pct("accessibility"), "| bp", pct("best-practices"), "| CLS", j.audits["cumulative-layout-shift"].displayValue, "| LCP", j.audits["largest-contentful-paint"].displayValue, "| TBT", j.audits["total-blocking-time"].displayValue, "| legacy", j.audits["legacy-javascript"].displayValue ?? "-");
  for (const s of j.audits["layout-shifts"].details?.items ?? []) console.log("   salto", s.score, s.node?.snippet?.slice(0, 100));
  for (const id of ["color-contrast", "aria-prohibited-attr", "errors-in-console"]) for (const it of j.audits[id].details?.items ?? []) console.log("  ", id, it.node?.snippet?.slice(0, 120) ?? JSON.stringify(it).slice(0, 120));
}
