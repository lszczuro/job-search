import type { FastifyInstance } from "fastify";

type ImportDeps = {
  createImportJob?: (kind: string) => Promise<unknown>;
};

export function registerImportRoutes(app: FastifyInstance, deps: ImportDeps) {
  app.post("/imports/refresh", async (_, reply) => {
    const job = await deps.createImportJob?.("manual_refresh");
    return reply.code(202).send(job ?? { id: 1, kind: "manual_refresh" });
  });
}
