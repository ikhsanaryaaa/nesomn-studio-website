-- Preserve accepted remote identity for ambiguous provider reconciliation.
ALTER TABLE ai_jobs ADD COLUMN provider_ref text;
