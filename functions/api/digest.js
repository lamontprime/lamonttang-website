import { runDigest, checkAdminSecret } from "../_lib/lead-workflow.js";

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
}

// Triggered once daily by an external scheduler (see CODEX_BUILD_PROMPT.md / CLOUDFLARE_DEPLOYMENT.md).
// Requires ?secret=<ADMIN_SECRET> so this can't be triggered by randoms hitting the URL.
export async function onRequestGet(context) {
    const auth = checkAdminSecret(context.env, context.request);
    if (!auth.ok) return json({ ok: false, error: auth.reason }, 401);

  const result = await runDigest(context.env);
    return json({ ok: true, ...result });
}

export async function onRequestPost(context) {
    return onRequestGet(context);
}
