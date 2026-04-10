# Review Notes: cron-refresh-recovery

- Root cause: `createOrReuseRefreshJob()` treated any `running` refresh as active forever, so a worker crash could permanently block both cron and manual refresh creation.
- Change review: stale `running` refresh jobs older than 30 minutes, or missing `started_at`, are now marked as failed before a new pending refresh job is inserted.
- Regression coverage: added a repository test that proves an orphaned `running` job no longer blocks the next scheduled refresh.
- Residual risk: a legitimately long-running refresh that exceeds 30 minutes will be treated as interrupted and may allow a follow-up refresh to enqueue.
