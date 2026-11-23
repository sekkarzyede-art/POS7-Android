-- R329: optimize existing publisher-change guard while preserving enforcement.
-- No data writes or publishing operations. Runs on Store 1 only.
CREATE OR REPLACE FUNCTION pos7_transfer_private.guard_publisher_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog','public','pos7_transfer_private','pg_temp'
AS $r329$
BEGIN
 -- Most ordinary syncs, including R325, do NOT change the publishing device.
 -- Return before touching large private transfer receipts / full JSONB comparisons.
 IF NEW.publisher_device IS NOT DISTINCT FROM OLD.publisher_device THEN
   RETURN NEW;
 END IF;
 IF EXISTS(SELECT 1 FROM pos7_transfer_private.receipts)
 AND NOT EXISTS(
   SELECT 1 FROM pos7_transfer_private.receipts
   WHERE device_id=NEW.publisher_device AND replacement_sections=NEW.sections
   AND (result->>'revision')::bigint=NEW.revision
   AND completed_at>=transaction_timestamp()
 ) THEN
   RAISE EXCEPTION 'use_backup_transfer_for_new_tablet';
 END IF;
 RETURN NEW;
END $r329$;
