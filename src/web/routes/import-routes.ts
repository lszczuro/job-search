import type { FastifyInstance } from "fastify";

type ImportDeps = {
  createOrReuseRefreshJob?: (kind: "manual_refresh" | "scheduled_refresh") => Promise<unknown>;
};

export function registerImportRoutes(app: FastifyInstance, deps: ImportDeps) {
  app.post("/imports/refresh", async (_, reply) => {
    const job = await deps.createOrReuseRefreshJob?.("manual_refresh");
    return reply.code(202).send(job ?? { id: 1, kind: "manual_refresh", status: "pending", reused: false });
  });
}
