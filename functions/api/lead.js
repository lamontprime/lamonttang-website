import { processLead } from "../_lib/lead-workflow.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  try {
    const input = await context.request.json();
    const result = await processLead(input, context.env);
    return json(result);
  } catch (error) {
    return json({
      ok: false,
      error: error?.message || "Unable to process lead."
    }, 400);
  }
}
