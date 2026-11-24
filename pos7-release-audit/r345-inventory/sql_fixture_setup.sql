BEGIN;
CREATE TEMP TABLE pos7_owner_snapshot(store_id text PRIMARY KEY,revision bigint,publisher_device text,sections jsonb,updated_at timestamptz) ON COMMIT DROP;
CREATE TEMP TABLE pos7_inventory_gate_r152(store_id text PRIMARY KEY,enabled boolean,approved_device text) ON COMMIT DROP;
CREATE TEMP TABLE pos7_store2_clone_guard_r218(store_id text PRIMARY KEY,blocked boolean) ON COMMIT DROP;
CREATE TEMP TABLE pos7_owner_commands(event_id uuid PRIMARY KEY,store_id text,status text,event_type text,device_id text,payload jsonb,result jsonb,processed_at timestamptz) ON COMMIT DROP;
CREATE TEMP TABLE r345_test_results(test text PRIMARY KEY) ON COMMIT DROP;
CREATE FUNCTION pg_temp.pos7_is_member(text,text[]) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('pos7.r345_test_owner',true)='yes' $$;
SELECT set_config('pos7.r345_test_owner','yes',true);
INSERT INTO pg_temp.pos7_inventory_gate_r152 VALUES ('pos7',true,'fixture-tab2');
INSERT INTO pg_temp.pos7_store2_clone_guard_r218 VALUES ('pos7',false);
INSERT INTO pg_temp.pos7_owner_snapshot VALUES ('pos7',7,'fixture-tab2',
'{"products":{"p1":{"id":"p1","barcode":"٠١٢٣","stock":-2.0,"stock_revision":5,"stock_revision_untrusted":false},"p2":{"id":"p2","barcode":"456","stock":0,"stock_revision":null,"stock_revision_untrusted":true},"p3":{"id":"p3","barcode":"555","stock":3,"stock_revision":null,"stock_revision_untrusted":true},"p4":{"id":"p4","barcode":"0789","stock":1,"stock_revision":null,"stock_revision_untrusted":true},"p5":{"id":"p5","barcode":"789","stock":2,"stock_revision":null,"stock_revision_untrusted":true},"p6":{"id":"p6","barcode":"654","stock":0,"stock_revision":null,"stock_revision_untrusted":true},"p7":{"id":"p7","barcode":"777","stock":2,"stock_revision":0,"stock_revision_untrusted":false},"p8":{"id":"p8","barcode":"888","stock":4,"stock_revision":2,"stock_revision_untrusted":true}},"sales":{"s":{"amount":19}},"cashLedger":{"c":{"amount":10}}}'::jsonb,now());
INSERT INTO pg_temp.pos7_owner_commands(event_id,store_id,status,event_type,device_id,payload) VALUES
 ('00000000-0000-4000-8000-000000000001','pos7','pending','inventory_count','11111111-1111-4111-8111-111111111111','{"product_id":"p1","barcode":"123","baseline_qty":-5,"counted_qty":7,"stock_revision":4,"batch_id":"fixture-batch","requires_tablet_validation":true,"source":"owner_phone_inventory"}'),
 ('00000000-0000-4000-8000-000000000006','pos7','pending','inventory_count','11111111-1111-4111-8111-111111111111','{"product_id":"p6","barcode":"654","baseline_qty":0,"counted_qty":0,"stock_revision":0,"batch_id":"fixture-other","requires_tablet_validation":true,"source":"owner_phone_inventory"}'),
 ('00000000-0000-4000-8000-000000000007','pos7','pending','inventory_count','11111111-1111-4111-8111-111111111111','{"product_id":"p7","barcode":"777","baseline_qty":2,"counted_qty":10,"stock_revision":0,"batch_id":"fixture-batch","requires_tablet_validation":true,"source":"owner_phone_inventory"}');
