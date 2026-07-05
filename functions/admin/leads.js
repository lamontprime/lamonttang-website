import { listLeads, renderLeadsHtml, checkAdminSecret } from "../_lib/lead-workflow.js";

function html(body, status = 200) {
    return new Response(body, {
          status,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
}

// Simple internal CRM view — not linked from the site, not in the sitemap, disallowed in robots.txt.
// Bookmark this with your secret query param: /admin/leads?secret=...
export async function onRequestGet(context) {
    const auth = checkAdminSecret(context.env, context.request);
    if (!auth.ok) return html(`<p>Not authorized: ${auth.reason}</p>`, 401);

  const url = new URL(context.request.url);
    const formFilter = url.searchParams.get("form") || undefined;
    const leads = await listLeads(context.env, { formFilter });

  return html(renderLeadsHtml(leads, { activeFilter: formFilter }));
}
