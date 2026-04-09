import type { FastifyInstance } from "fastify";
import { serializeOffersForHtml, type OfferListItem } from "../offer-view-model";

type OfferDeps = {
  listOffers?: () => Promise<OfferListItem[]>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
  getLatestSuccessfulRefresh?: () => Promise<string | null>;
  timezone?: string;
};

type RefreshMeta = {
  timezone: string;
  lastUpdatedAt: string | null;
};

export function renderOffersList(offers: OfferListItem[], refreshMeta: RefreshMeta) {
  return [
    "<html><head><meta charset=\"utf-8\" /><title>Job Tracker</title>",
    "<style>",
    "body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#f3efe7;color:#1f2937;}",
    ".page{max-width:min(96vw,1880px);margin:0 auto;padding:32px 20px 48px;}",
    ".shell{border:1px solid #d6d3d1;border-radius:24px;background:#fffdf8;box-shadow:0 24px 80px rgba(15,23,42,.08);overflow:visible;}",
    ".fallback{padding:20px;color:#57534e;border-top:1px solid #e7e5e4;}",
    ".page-shell{padding:24px;}",
    ".page-header{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:24px;}",
    ".eyebrow{margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a16207;}",
    "h1{margin:0;font-size:32px;line-height:1.1;}",
    ".summary{margin:0;color:#57534e;}",
    ".toolbar{display:grid;gap:16px;margin-bottom:20px;}",
    ".toolbar-group{display:grid;gap:10px;}",
    ".labels{display:flex;flex-wrap:wrap;gap:8px;}",
    ".column-toggles{display:flex;flex-wrap:wrap;gap:8px;}",
    ".chip{border:1px solid #d6d3d1;background:#f5f5f4;border-radius:999px;padding:6px 10px;font-size:13px;cursor:pointer;}",
    ".chip-active{background:#111827;color:#fff;border-color:#111827;}",
    ".toggle-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #d6d3d1;background:#fafaf9;border-radius:999px;padding:6px 10px;font-size:13px;cursor:pointer;}",
    ".toggle-chip input{margin:0;accent-color:#0f766e;}",
    ".inline-editor{display:grid;gap:8px;min-width:160px;}",
    ".edit-select,.edit-input{width:100%;padding:8px 10px;border:1px solid #d6d3d1;border-radius:10px;background:#fff;font:inherit;color:inherit;}",
    ".edit-input{min-width:220px;}",
    ".save-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
    ".save-button{border:0;border-radius:999px;background:#0f766e;color:#fff;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;}",
    ".save-button[disabled]{background:#a8a29e;cursor:not-allowed;}",
    ".save-feedback{font-size:12px;color:#0f766e;}",
    ".save-feedback-error{color:#b91c1c;}",
    ".sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}",
    ".empty-state{margin:0;padding:24px;border:1px dashed #d6d3d1;border-radius:16px;background:#fafaf9;}",
    ".table-wrap{overflow-x:auto;padding-bottom:8px;}",
    "table{width:max-content;min-width:100%;border-collapse:collapse;background:#fff;}",
    "th,td{text-align:left;padding:14px 12px;border-top:1px solid #e7e5e4;vertical-align:top;}",
    "th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#78716c;}",
    "a{color:#0f766e;font-weight:600;text-decoration:none;}",
    "a:hover{text-decoration:underline;}",
    ".sort-button{all:unset;cursor:pointer;}",
    "</style></head><body><main class=\"page\"><div class=\"shell\">",
    "<h1>Job Tracker</h1>",
    "<div id=\"offers-app\"></div>",
    `<script id="initial-offers" type="application/json">${serializeOffersForHtml(offers)}</script>`,
    `<script id="initial-refresh-meta" type="application/json">${JSON.stringify(refreshMeta)}</script>`,
    "<script type=\"module\" src=\"/assets/offers-app.js\"></script>",
    "<noscript><p class=\"fallback\">Włącz JavaScript, aby używać sortowania i filtrowania tabeli.</p></noscript>",
    "</div></main></body></html>"
  ].join("");
}

export function registerOfferRoutes(app: FastifyInstance, deps: OfferDeps) {
  app.get("/", async (_, reply) => {
    const offers = (await deps.listOffers?.()) ?? [];
    const lastUpdatedAt = (await deps.getLatestSuccessfulRefresh?.()) ?? null;

    return reply.type("text/html").send(
      renderOffersList(offers, {
        timezone: deps.timezone ?? "Europe/Warsaw",
        lastUpdatedAt
      })
    );
  });

  app.get("/offers", async () => deps.listOffers?.() ?? []);

  app.patch<{ Params: { id: string }; Body: Record<string, string> }>(
    "/offers/:id",
    async (request, reply) => {
      const result = (await deps.updateOffer?.(Number(request.params.id), request.body)) ?? { ok: true };

      if (result && typeof result === "object" && "ok" in result && result.ok === false) {
        return reply.status(400).send(result);
      }

      return result;
    }
  );
}
