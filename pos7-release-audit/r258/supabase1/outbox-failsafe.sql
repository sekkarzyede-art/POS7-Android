CREATE SCHEMA pos7_push_private_r258;
REVOKE ALL ON SCHEMA pos7_push_private_r258 FROM PUBLIC,anon,authenticated;
CREATE TABLE pos7_push_private_r258.deferred_events(
 event_key text PRIMARY KEY,store_id text NOT NULL,payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),last_sqlstate text NOT NULL
);
ALTER TABLE pos7_push_private_r258.deferred_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pos7_push_private_r258.deferred_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION pos7_push_private_r258.enqueue(p_store text,p_key text,p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $fn$
DECLARE failure text;
BEGIN
 BEGIN
  INSERT INTO public.pos7_push_events(store_id,event_key,payload) VALUES(p_store,p_key,p_payload) ON CONFLICT(event_key) DO NOTHING;
 EXCEPTION WHEN OTHERS THEN
  failure:=SQLSTATE;
  BEGIN
   INSERT INTO pos7_push_private_r258.deferred_events(store_id,event_key,payload,last_sqlstate)
   VALUES(p_store,p_key,p_payload,failure) ON CONFLICT(event_key) DO NOTHING;
   RAISE WARNING 'POS7_R258 notification deferred: SQLSTATE %',failure;
  EXCEPTION WHEN OTHERS THEN
   RAISE WARNING 'POS7_R258 notification fallback failed: SQLSTATE %',SQLSTATE;
  END;
 END;
END $fn$;
CREATE OR REPLACE FUNCTION pos7_push_private_r258.recover()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' SET lock_timeout TO '1s' AS $fn$
DECLARE e record; top_id bigint; seq_id bigint; called boolean; n integer:=0;
BEGIN
 SELECT coalesce(max(id),0) INTO top_id FROM public.pos7_push_events;
 SELECT last_value,is_called INTO seq_id,called FROM public.pos7_push_events_id_seq;
 IF top_id>seq_id OR (top_id=seq_id AND NOT called) OR EXISTS(SELECT 1 FROM pos7_push_private_r258.deferred_events WHERE created_at>clock_timestamp()-interval '30 minutes') THEN
  LOCK TABLE public.pos7_push_events IN SHARE ROW EXCLUSIVE MODE;
  SELECT coalesce(max(id),0) INTO top_id FROM public.pos7_push_events;
  SELECT last_value,is_called INTO seq_id,called FROM public.pos7_push_events_id_seq;
  IF top_id>seq_id OR (top_id=seq_id AND NOT called) THEN
   PERFORM setval('public.pos7_push_events_id_seq'::regclass,GREATEST(top_id,seq_id),true);
  END IF;
  FOR e IN SELECT * FROM pos7_push_private_r258.deferred_events WHERE created_at>clock_timestamp()-interval '30 minutes' ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED LOOP
   BEGIN
    INSERT INTO public.pos7_push_events(store_id,event_key,payload,created_at)
    VALUES(e.store_id,e.event_key,e.payload,e.created_at) ON CONFLICT(event_key) DO NOTHING;
    DELETE FROM pos7_push_private_r258.deferred_events WHERE event_key=e.event_key;
    n:=n+1;
   EXCEPTION WHEN OTHERS THEN
    UPDATE pos7_push_private_r258.deferred_events SET last_sqlstate=SQLSTATE WHERE event_key=e.event_key;
   END;
  END LOOP;
 END IF;
 RETURN n;
END $fn$;
CREATE OR REPLACE FUNCTION public.pos7_owner_snapshot_push_outbox()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  section_name text;
  record_id text;
  old_section jsonb;
  new_section jsonb;
  old_doc jsonb;
  new_doc jsonb;
  changed record;
  op text;
  ref text;
  party text;
  amount text;
  currency text;
  label text;
  body jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Preserve the existing first-snapshot rule.
  IF coalesce(OLD.revision, 0) = 0
     AND coalesce(OLD.sections, '{}'::jsonb) = '{}'::jsonb
  THEN
    RETURN NEW;
  END IF;

  FOR section_name IN
    SELECT unnest(ARRAY[
      'sales', 'purchases', 'receipts', 'payments',
      'expenses', 'returns', 'walletTx', 'cashLedger'
    ])
  LOOP
    -- Extract each section once.
    old_section := coalesce(
      OLD.sections -> section_name, '{}'::jsonb
    );
    new_section := coalesce(
      NEW.sections -> section_name, '{}'::jsonb
    );

    IF old_section IS NOT DISTINCT FROM new_section THEN
      CONTINUE;
    END IF;

    label := CASE section_name
      WHEN 'sales' THEN 'فاتورة بيع'
      WHEN 'purchases' THEN 'فاتورة شراء'
      WHEN 'receipts' THEN 'سند قبض'
      WHEN 'payments' THEN 'سند صرف'
      WHEN 'expenses' THEN 'مصروف'
      WHEN 'returns' THEN 'مرتجع'
      WHEN 'walletTx' THEN 'حركة محفظة'
      ELSE 'حركة صندوق'
    END;

    -- Compare once; loop only over changed records.
    FOR changed IN
      SELECT
        coalesce(o.key, n.key) AS id,
        o.value AS before_doc,
        n.value AS after_doc
      FROM jsonb_each(old_section) AS o
      FULL OUTER JOIN jsonb_each(new_section) AS n
        ON n.key = o.key
      WHERE o.value IS DISTINCT FROM n.value
    LOOP
      record_id := changed.id;
      old_doc := changed.before_doc;
      new_doc := changed.after_doc;

      op := CASE
        WHEN old_doc IS NULL THEN 'created'
        WHEN new_doc IS NULL THEN 'deleted'
        ELSE 'updated'
      END;

      body := coalesce(new_doc, old_doc);

      ref := coalesce(
        body ->> 'number',
        body ->> 'ref',
        body ->> 'invoiceNumber',
        record_id
      );

      party := coalesce(
        body ->> 'customer',
        body ->> 'supplier',
        body ->> 'party',
        body ->> 'name',
        body ->> 'account',
        ''
      );

      amount := coalesce(
        body ->> 'totalUSD',
        body ->> 'amountUSD',
        body ->> 'total',
        body ->> 'amount',
        body ->> 'value',
        ''
      );

      currency := coalesce(body ->> 'currency', 'USD');

      PERFORM pos7_push_private_r258.enqueue(
        NEW.store_id,
        NEW.revision::text || ':' ||
          section_name || ':' || record_id || ':' || op,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'revision', NEW.revision,
          'section', section_name,
          'operation', op,
          'label', label,
          'reference', ref,
          'party', party,
          'amount', amount,
          'currency', currency,
          'old_amount', coalesce(
            old_doc ->> 'totalUSD',
            old_doc ->> 'amountUSD',
            old_doc ->> 'total',
            old_doc ->> 'amount',
            ''
          ),
          'new_amount', coalesce(
            new_doc ->> 'totalUSD',
            new_doc ->> 'amountUSD',
            new_doc ->> 'total',
            new_doc ->> 'amount',
            ''
          )
        )
      );
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$function$
;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pos7_push_private_r258 FROM PUBLIC,anon,authenticated;