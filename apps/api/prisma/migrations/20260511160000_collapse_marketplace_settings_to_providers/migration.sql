-- Collapse per-operation marketplace service settings into per-provider settings.
--
-- The MPP Router catalog flattens ~493 POST operations across ~86 providers, with each
-- operation as its own catalog entry (e.g. `agentmail_inboxes_inbox_id_messages_send`).
-- The dashboard now shows one card/toggle per PROVIDER, so enablement is stored keyed by
-- the provider key — the `{provider}` segment of `/v1/services/{provider}/{operation}`,
-- which equals the part of the service id before the first underscore. (Provider segments
-- themselves never contain underscores in the MPP catalog.)
--
-- Strategy: for every distinct (userId, provider) currently represented by operation-level
-- rows, upsert a provider-level row that is enabled if ANY of that provider's operations was
-- enabled; then delete the now-superseded operation-level rows.

INSERT INTO "MarketplaceServiceSetting" ("id", "userId", "serviceId", "enabled", "createdAt", "updatedAt")
SELECT
  'mss_' || substr(md5(s."userId" || '|' || split_part(s."serviceId", '_', 1)), 1, 24),
  s."userId",
  split_part(s."serviceId", '_', 1) AS provider,
  bool_or(s."enabled"),
  MIN(s."createdAt"),
  NOW()
FROM "MarketplaceServiceSetting" s
WHERE POSITION('_' IN s."serviceId") > 0
GROUP BY s."userId", split_part(s."serviceId", '_', 1)
ON CONFLICT ("userId", "serviceId")
  DO UPDATE SET
    "enabled" = "MarketplaceServiceSetting"."enabled" OR EXCLUDED."enabled",
    "updatedAt" = NOW();

DELETE FROM "MarketplaceServiceSetting" WHERE POSITION('_' IN "serviceId") > 0;
