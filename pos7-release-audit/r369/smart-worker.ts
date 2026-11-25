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


async function dispatchR369(devices, state, send, retire, persist, now) {
 const results=state.devices||(state.devices={});
 for(const device of devices){
  const hash=device.hash, prior=results[hash]||{};
  if(prior.status==="accepted"||prior.status==="invalid"||prior.status==="failed")continue;
  if(prior.retry_at&&Date.parse(prior.retry_at)>now())continue;
  const attempts=(prior.attempts||0)+1;
  let outcome;
  try{outcome=await send(device)}catch(_){outcome={http:0,codes:[],retryAfter:0}}
  const http=outcome.http,codes=outcome.codes||[];
  let status=http>=200&&http<300?"accepted":http===404&&codes.includes("UNREGISTERED")?"invalid":(http===0||http===429||http>=500)&&attempts<4?"retry":"failed";
  const delay=Math.max(http===429?60000:15000,15000*2**(attempts-1),outcome.retryAfter||0);
  results[hash]={status,attempts,http,codes,at:new Date(now()).toISOString(),...(status==="retry"?{retry_at:new Date(now()+delay).toISOString()}: {})};
  await persist();
  if(status==="invalid"){try{await retire(hash)}catch(_){console.warn("POS7_R369 retirement deferred")}}
 }
 const entries=Object.values(results), current=devices.map(d=>results[d.hash]||{status:"retry"});
 const accepted=entries.filter(x=>x.status==="accepted").length;
 const retry=current.some(x=>x.status==="retry"),failed=current.some(x=>x.status==="failed");
 state.status=retry?"retry":failed?"failed":accepted?"accepted":"no_target";
 const due=current.filter(x=>x.status==="retry").map(x=>Date.parse(x.retry_at||"")).filter(Number.isFinite);
 state.retry_at=retry?new Date(due.length?Math.min(...due):now()+60000).toISOString():state.status==="no_target"?new Date(now()+60000).toISOString():null;
 return {status:state.status,accepted,invalid:entries.filter(x=>x.status==="invalid").length};
}
const project = "rmskuolsiqbzxuakofpb";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});
async function hashToken(token){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(token)))).map(b=>b.toString(16).padStart(2,"0")).join("")}
Deno.serve(async request=>{
 if(request.method!=="POST")return json({error:"method"},405);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(url!=="https://"+project+".supabase.co"||!key)return json({error:"configuration"},500);
 let eventId;try{eventId=Number((await request.json()).record?.id)}catch(_){return json({error:"bad request"},400)}
 if(!Number.isSafeInteger(eventId)||eventId<=0)return json({error:"event"},400);
 const h={apikey:key,authorization:"Bearer "+key,"content-type":"application/json"};
 const secret=Deno.env.get("POS7_PUSH_WEBHOOK_SECRET")||"";
 let permitted=!!secret&&request.headers.get("x-pos7-webhook-secret")===secret;
 if(!permitted){
  const id=request.headers.get("x-pos7-event-id")||"",ts=request.headers.get("x-pos7-timestamp")||"",sig=request.headers.get("x-pos7-signature")||"";
  if(id!==String(eventId)||!/^[0-9]{10}$/.test(ts)||!/^[0-9a-f]{64}$/.test(sig))return json({error:"unauthorized"},401);
  const v=await fetch(url+"/rest/v1/rpc/pos7_store2_verify_push_r223",{method:"POST",headers:h,body:JSON.stringify({p_event_id:eventId,p_ts:Number(ts),p_signature:sig})});
  permitted=v.ok&&(await v.json())===true;
 }
 if(!permitted)return json({error:"unauthorized"},401);
 const fresh=new Date(Date.now()-30*60000).toISOString(),stamp=new Date().toISOString();
 const path=url+"/rest/v1/pos7_push_events?id=eq."+eventId+"&store_id=eq.pos7&delivered_at=is.null";
 let payload,state,claimed=false;
 async function patch(body,claim=false){
  const filter=claim?"&processing_at=is.null&created_at=gte."+encodeURIComponent(fresh):"&processing_at=eq."+encodeURIComponent(stamp);
  const r=await fetch(path+filter,{method:"PATCH",headers:{...h,Prefer:"return=representation"},body:JSON.stringify(body)});
  if(!r.ok)throw Error("event patch "+r.status);const rows=await r.json();
  if(!claim&&rows.length!==1)throw Error("claim lost");return rows;
 }
 try{
  const rows=await patch({processing_at:stamp},true);if(!rows.length)return json({status:"skipped_old_or_claimed"});
  claimed=true;payload=rows[0].payload||{};state=payload._r369||{devices:{}};
  if(state.retry_at&&Date.parse(state.retry_at)>Date.now()){await patch({processing_at:null});return json({status:"not_due"})}
  const firebase=JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")||"{}");
  if(firebase.project_id!=="pos7-owner-notifications"||!firebase.client_email||!firebase.private_key)throw Error("FCM configuration");
  const dr=await fetch(url+"/rest/v1/pos7_owner_push_tokens?store_id=eq.pos7&select=fcm_token",{headers:h});
  if(!dr.ok)throw Error("devices "+dr.status);
  const raw=await dr.json(),tokens=[...new Set(raw.map(d=>d.fcm_token).filter(t=>typeof t==="string"&&t.length>0))];
  const devices=await Promise.all(tokens.map(async token=>({token,hash:await hashToken(token)})));
  const operation=payload.operation==="created"?"جديدة":payload.operation==="updated"?"معدلة":"ملغاة/محذوفة";
  const title=(payload.label||"حركة متجر")+" "+operation;
  let body=[payload.label,payload.reference,payload.party,payload.amount?payload.amount+" "+(payload.currency||"USD"):""].filter(Boolean).join(" — ");
  if(payload.operation==="updated"&&payload.old_amount&&payload.new_amount&&payload.old_amount!==payload.new_amount)body+=" — من "+payload.old_amount+" إلى "+payload.new_amount;
  let oauth;
  const result=await dispatchR369(devices,state,async d=>{
   oauth=oauth||await accessToken(firebase);
   const response=await fetch("https://fcm.googleapis.com/v1/projects/"+firebase.project_id+"/messages:send",{method:"POST",headers:{authorization:"Bearer "+oauth,"content-type":"application/json"},body:JSON.stringify({message:{token:d.token,data:{title,body,event_id:String(eventId),reference:String(payload.reference||""),section:String(payload.section||""),pos7_event_id:String(eventId),pos7_reference:String(payload.reference||""),pos7_section:String(payload.section||""),pos7_record_id:String(payload.record_id||""),pos7_project_id:project},android:{priority:"HIGH",ttl:"1800s"}}})});
   let res={};try{res=await response.json()}catch(_){}
   const codes=(res.error?.details||[]).map(x=>x.errorCode).filter(Boolean);
   const retry=response.headers.get("retry-after");const retryAfter=retry?(Number.isFinite(Number(retry))?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now())||0):0;
   console.log("POS7_R369_DEVICE_RESULT",JSON.stringify({eventId,hash:d.hash.slice(0,12),http:response.status,codes}));
   return {http:response.status,codes,retryAfter};
  },async()=>{/* Invalid token is recorded by its hash; do not delete a registration while an account switch may be in progress. */},async()=>{payload._r369=state;await patch({payload})},()=>Date.now());
  payload._r369=state;
  await patch({payload,processing_at:null,...(result.status==="accepted"?{delivered_at:new Date().toISOString()}:{})});
  console.log("POS7_R369_EVENT_RESULT",JSON.stringify({eventId,...result}));return json(result);
 }catch(e){
  if(claimed){try{state=state||{devices:{}};state.status="retry";state.retry_at=new Date(Date.now()+60000).toISOString();payload._r369=state;await patch({payload,processing_at:null})}catch(_){console.warn("POS7_R369 claim recovery needed",eventId)}}
  console.error("POS7_R369 worker error",eventId,String(e?.message||e).slice(0,100));return json({status:"retry"},503);
 }
});
