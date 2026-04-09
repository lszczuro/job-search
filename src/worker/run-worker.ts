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
  runJob: (jobId: number) => Promise<JobResult>;
  markSucceeded: (id: number, result: JobResult) => Promise<void>;
};

export async function executeNextJob(args: ExecuteNextJobArgs) {
  const job = await args.fetchPendingJob();

  if (!job) {
    return false;
  }

  await args.markRunning(job.id);
  const result = await args.runJob(job.id);
  await args.markSucceeded(job.id, result);

  return true;
}
