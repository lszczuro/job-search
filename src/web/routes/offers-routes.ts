import type { FastifyInstance } from "fastify";
import { serializeOffersForHtml, type OfferListItem } from "../offer-view-model";

type OfferDeps = {
  listOffers?: () => Promise<OfferListItem[]>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
  createOffer?: (payload: { stanowisko: string; firma: string; url: string }) => Promise<unknown>;
  getLatestSuccessfulRefresh?: () => Promise<string | null>;
  timezone?: string;
};

type RefreshMeta = {
  timezone: string;
  lastUpdatedAt: string | null;
};

type CreateOfferError = {
  ok: false;
  error: "INVALID_PAYLOAD" | "DUPLICATE_URL";
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
    ".filter-input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:5px 8px;border:1px solid #d6d3d1;border-radius:8px;background:#fff;font:inherit;font-size:12px;color:#1f2937;min-width:80px;}",
    ".filter-input:focus{outline:none;border-color:#0f766e;box-shadow:0 0 0 2px rgba(15,118,110,.15);}",
    ".filter-range{display:flex;gap:4px;margin-top:6px;}",
    ".filter-range .filter-input{margin-top:0;}",
    ".filter-dropdown{position:relative;margin-top:6px;}",
    ".filter-dropdown>button{all:unset;display:inline-flex;align-items:center;gap:4px;padding:5px 8px;border:1px solid #d6d3d1;border-radius:8px;background:#fff;font:inherit;font-size:12px;color:#57534e;cursor:pointer;white-space:nowrap;}",
    ".filter-dropdown>button:hover{border-color:#a8a29e;}",
    ".filter-panel{position:absolute;top:calc(100% + 4px);left:0;z-index:50;min-width:160px;max-height:240px;overflow-y:auto;border:1px solid #d6d3d1;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.1);padding:6px;}",
    ".filter-panel label{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;}",
    ".filter-panel label:hover{background:#f5f5f4;}",
    ".filter-panel input[type=checkbox]{margin:0;accent-color:#0f766e;cursor:pointer;}",
    ".active-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:16px;min-height:32px;}",
    ".active-filters>span:first-child{font-size:13px;font-weight:600;color:#1f2937;margin-right:4px;}",
    ".active-filters>span{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;font-size:12px;color:#166534;}",
    ".active-filters>span>button{all:unset;cursor:pointer;font-size:14px;line-height:1;color:#166534;opacity:.7;}",
    ".active-filters>span>button:hover{opacity:1;}",
    ".active-filters>button{all:unset;cursor:pointer;font-size:12px;color:#b91c1c;text-decoration:underline;}",
    ".refresh-button{border:0;border-radius:999px;background:#f5f5f4;border:1px solid #d6d3d1;color:#1f2937;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;}",
    ".refresh-button:hover{background:#e7e5e4;}",
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

  app.post<{ Body: { stanowisko?: string; firma?: string; url?: string } }>("/offers", async (request, reply) => {
    const payload = {
      stanowisko: request.body?.stanowisko?.trim() ?? "",
      firma: request.body?.firma?.trim() ?? "",
      url: request.body?.url?.trim() ?? ""
    };

    if (!payload.stanowisko || !payload.firma || !payload.url) {
      return reply.status(400).send({ ok: false, error: "INVALID_PAYLOAD" });
    }

    try {
      new URL(payload.url);
    } catch {
      return reply.status(400).send({ ok: false, error: "INVALID_PAYLOAD" });
    }

    const result = await deps.createOffer?.(payload);

    if (result && typeof result === "object" && "ok" in result && result.ok === false) {
      const errorResult = result as CreateOfferError;

      if (errorResult.error === "DUPLICATE_URL") {
        return reply.status(409).send(errorResult);
      }

      return reply.status(400).send(errorResult);
    }

    return reply.status(201).send(result ?? { ok: false, error: "INVALID_PAYLOAD" });
  });

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
