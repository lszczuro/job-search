import Fastify from "fastify";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { createRuntimeDeps } from "../app/runtime";
import { registerOfferRoutes } from "./routes/offers-routes";
import { registerImportRoutes } from "./routes/import-routes";
import type { OfferListItem } from "./offer-view-model";

type ServerDeps = {
  timezone?: string;
  listOffers?: () => Promise<OfferListItem[]>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
  createOffer?: (payload: { stanowisko: string; firma: string; url: string }) => Promise<unknown>;
  createOrReuseRefreshJob?: (kind: "manual_refresh" | "scheduled_refresh") => Promise<unknown>;
  getLatestSuccessfulRefresh?: () => Promise<string | null>;
};

let offersAppBundlePromise: Promise<string> | null = null;

async function getOffersAppBundle() {
  if (!offersAppBundlePromise) {
    offersAppBundlePromise = build({
      entryPoints: [fileURLToPath(new URL("./client/offers-app.tsx", import.meta.url))],
      bundle: true,
      format: "esm",
      write: false,
      platform: "browser",
      jsx: "automatic",
      minify: true,
      legalComments: "none",
      define: {
        "process.env.NODE_ENV": "\"production\""
      }
    }).then((result) => result.outputFiles[0]?.text ?? "");
  }

  return offersAppBundlePromise;
}

export function buildServer(deps: ServerDeps = {}) {
  const app = Fastify();
  const runtimeDeps =
    deps.listOffers && deps.updateOffer && deps.createOffer && deps.createOrReuseRefreshJob && deps.getLatestSuccessfulRefresh
      ? null
      : createRuntimeDeps();
  const mergedDeps = { ...runtimeDeps, ...deps };

  app.get("/health", async () => ({ ok: true }));
  app.get("/assets/offers-app.js", async (_, reply) =>
    reply.type("application/javascript").send(await getOffersAppBundle())
  );
  registerOfferRoutes(app, mergedDeps);
  registerImportRoutes(app, mergedDeps);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = buildServer();
  app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
}
