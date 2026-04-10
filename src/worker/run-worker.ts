import cron from "node-cron";
import { createRuntimeDeps } from "../app/runtime";

type JobResult = {
  fetched: number;
  added: number;
  rejected: number;
  duplicates: number;
  errors: number;
};

type ExecuteNextJobArgs = {
  fetchPendingJob: () => Promise<{
    id: number;
    kind: string;
    status: string;
  } | null>;
  markRunning: (id: number) => Promise<void>;
  runRefreshJob: (jobId: number) => Promise<JobResult>;
  publishNotification: (added: number) => Promise<void>;
  markSucceeded: (id: number, result: JobResult) => Promise<void>;
  markFailed: (id: number, errorMessage: string) => Promise<void>;
};

type ScheduleRefreshCronArgs = {
  cron: string;
  timezone: string;
  enqueueScheduledRefresh: () => Promise<void>;
};

export async function executeNextJob(args: ExecuteNextJobArgs) {
  const job = await args.fetchPendingJob();

  if (!job) {
    return false;
  }

  await args.markRunning(job.id);

  try {
    const result = await args.runRefreshJob(job.id);

    if (result.added > 0) {
      try {
        await args.publishNotification(result.added);
      } catch (error) {
        console.error("Failed to publish nfty notification", error);
      }
    }

    await args.markSucceeded(job.id, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown import error";
    await args.markFailed(job.id, errorMessage);
  }

  return true;
}

export function scheduleRefreshCron(args: ScheduleRefreshCronArgs) {
  const tick = async () => {
    await args.enqueueScheduledRefresh();
  };

  return {
    tick,
    start() {
      return cron.schedule(args.cron, () => {
        void tick();
      }, {
        timezone: args.timezone
      });
    }
  };
}

if (process.env.NODE_ENV !== "test") {
  const runtime = createRuntimeDeps();
  const scheduler = scheduleRefreshCron({
    cron: runtime.refreshCron,
    timezone: runtime.timezone,
    enqueueScheduledRefresh: async () => {
      await runtime.createOrReuseRefreshJob("scheduled_refresh");
    }
  });

  scheduler.start();

  setInterval(async () => {
    await executeNextJob({
      fetchPendingJob: runtime.fetchPendingJob,
      markRunning: runtime.markJobRunning,
      runRefreshJob: runtime.runRefreshJob,
      publishNotification: runtime.publishNftyNotification,
      markSucceeded: runtime.markJobSucceeded,
      markFailed: runtime.markJobFailed
    });
  }, 1_000);
}
