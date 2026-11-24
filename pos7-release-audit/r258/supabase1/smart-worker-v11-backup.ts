const enc = new TextEncoder();
const b64url = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? enc.encode(value) : value;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

async function accessToken(service: Record<string, string>) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: service.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const pem = service.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned)),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(signature)}`,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "تعذر إصدار رمز FCM");
  return data.access_token as string;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const webhookSecret = Deno.env.get("POS7_PUSH_WEBHOOK_SECRET") || "";
  if (!webhookSecret || request.headers.get("x-pos7-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firebase = JSON.parse(
    Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || "{}",
  ) as Record<string, string>;
console.log("POS7_FCM_PROJECT_ID:", firebase.project_id);
  if (!firebase.project_id || !firebase.client_email || !firebase.private_key) {
    return new Response("Missing FCM service account", { status: 500 });
  }

  const webhook = await request.json();
  const eventId = Number(webhook.record?.id);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return new Response("Invalid event", { status: 400 });
  }

  const headers = {
    apikey: serviceRole,
    authorization: `Bearer ${serviceRole}`,
    "content-type": "application/json",
  };

  const claim = await fetch(
    `${supabaseUrl}/rest/v1/pos7_push_events?id=eq.${eventId}&delivered_at=is.null&processing_at=is.null&select=id,payload`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ processing_at: new Date().toISOString() }),
    },
  );

  const claimText = await claim.text();
  if (!claim.ok) {
    return new Response(
        `Could not claim event (${claim.status}): ${claimText}`,
            { status: 500 }
              );
              }
              const claimed = JSON.parse(claimText);
  if (!claimed.length) return new Response("Already claimed or delivered", { status: 200 });

  const payload = claimed[0].payload;

  try {
    const devicesResponse = await fetch(
      `${supabaseUrl}/rest/v1/pos7_owner_push_tokens?store_id=eq.pos7&select=fcm_token`,
      { headers },
    );
    const devices = await devicesResponse.json();
    if (!devicesResponse.ok) throw new Error("تعذر جلب أجهزة المالك");

    const oauth = await accessToken(firebase);
    const operation =
      payload.operation === "created" ? "جديدة" :
      payload.operation === "updated" ? "معدلة" : "ملغاة/محذوفة";

    const parts = [
      payload.label,
      payload.reference,
      payload.party,
      payload.amount ? `${payload.amount} ${payload.currency || "USD"}` : "",
    ].filter(Boolean);

    const title = `${payload.label || "حركة متجر"} ${operation}`;
    let body = parts.join(" — ");

    if (
      payload.operation === "updated" &&
      payload.old_amount &&
      payload.new_amount &&
      payload.old_amount !== payload.new_amount
    ) {
      body += ` — من ${payload.old_amount} إلى ${payload.new_amount}`;
    }

    await Promise.all(devices.map(async (device: { fcm_token: string }) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${firebase.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${oauth}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: device.fcm_token,
              notification: { title, body },
              data: {
                title,
                body,
                event_id: String(eventId),
                reference: String(payload.reference || ""),
                section: String(payload.section || ""),
               pos7_event_id: String(eventId),
pos7_reference: String(payload.reference || ""),
pos7_section: String(payload.section || ""),
pos7_record_id: String(payload.record_id || ""),},
              android: {
                priority: "HIGH",
                notification: { channel_id: "pos7_store_events" },
              },
            },
          }),
        },
      );

    const tokenHash = Array.from(
  new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(device.fcm_token)
  ))
).map(b => b.toString(16).padStart(2, "0"))
 .join("").slice(0, 12);

const resultText = await response.text();
let result;
try {
  result = JSON.parse(resultText);
} catch {
  result = {};
}

console.log("POS7_FCM_DEVICE_RESULT", JSON.stringify({
  device: tokenHash,
  http_status: response.status,
  accepted: response.ok,
  error_status: result.error?.status ?? null,
  error_codes: (result.error?.details ?? [])
    .map((item: { errorCode?: string }) => item.errorCode)
    .filter(Boolean)
}));

if (!response.ok) throw new Error(resultText);
}));
    const finish = await fetch(
      `${supabaseUrl}/rest/v1/pos7_push_events?id=eq.${eventId}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          delivered_at: new Date().toISOString(),
          processing_at: null,
        }),
      },
    );

    if (!finish.ok) throw new Error("تعذر إنهاء سجل الإشعار");

    return new Response(JSON.stringify({ sent: devices.length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    await fetch(
      `${supabaseUrl}/rest/v1/pos7_push_events?id=eq.${eventId}&delivered_at=is.null`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ processing_at: null }),
      },
    );

    return new Response(
      error instanceof Error ? error.message : "Push failed",
      { status: 500 },
    );
  }
});