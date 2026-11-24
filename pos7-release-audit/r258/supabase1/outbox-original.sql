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

      INSERT INTO public.pos7_push_events(
        store_id, event_key, payload
      )
      VALUES (
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
      )
      ON CONFLICT (event_key) DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$function$
