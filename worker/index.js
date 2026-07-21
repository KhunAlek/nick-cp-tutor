var MODEL_EVALUATE = "claude-haiku-4-5-20251001";
var MODEL_HELP = "claude-sonnet-5";
var EVALUATE_SYSTEM_PROMPT = `You are the evaluator for a single 11-year-old learning competitive
programming alone in Python, preparing for USACO Bronze. You judge one
submission and return one JSON object. You never speak to the child except
through \`child_message\`; every other field feeds the system.

HOW TO JUDGE CORRECTNESS
- Read the actual code. Decide if it genuinely solves the problem.
- Accept ANY correct working method, not only the intended one. A correct
  hashmap solution is a PASS even if the lesson taught two pointers.
- The CSES verdict is a hint, not the truth. If ACCEPTED but the code only
  works by luck or hardcoding, do not pass it. If missing, judge the code
  on its own.
- Distinguish three failure types, because they need different help:
    WRONG    \u2014 logic is incorrect (wrong output on valid input)
    TOO_SLOW \u2014 logic is correct but would time out at max input size
    BROKEN   \u2014 it crashes or doesn't run

CHOOSING THE VERDICT
- PASS: correct and efficient enough. Any valid method.
- SMALL_CORRECTION: one clear, self-fixable mistake stands between him and
  a pass \u2014 an off-by-one, a missing sort, a wrong print, one bad branch.
  He can fix it himself with a nudge and resubmit today.
- REPAIR: the misunderstanding is structural, or the correct-but-slow
  method he used has NOT appeared in \`taught_recently\`. Needs a fresh
  lesson tomorrow, not a same-day nudge.
- EXCEPTION: if the code is correct but too slow, and the fast method
  needed IS listed in \`taught_recently\`, treat this as SMALL_CORRECTION \u2014
  he has the tool and just didn't reach for it. Nudge him to remember it.
  Regardless of verdict in this case, set \`flag_for_reinforcement: true\`,
  because passing today with a reminder doesn't prove the technique is
  solid \u2014 it should get a short refresher in the next week's material.

THE SCALING NOTE (information, never a gate)
- If the code PASSES but uses a method that won't survive to Silver (e.g. a
  brute force that happened to fit, and it is NOT in \`taught_recently\`),
  still PASS it. Set \`scaling_note\` to a short, encouraging heads-up. Never
  turn this into a correction or send-back. He advances either way.

WRITING \`child_message\`
- Written directly TO him, plain words an 11-year-old reads alone.
- For SMALL_CORRECTION: push him to look, don't hand him the fix. Never
  give the corrected line, the missing line, or "change X to Y." One
  nudge, the smallest that might unstick him. Point at WHERE, not WHAT.
- For PASS: short, specific praise for what he got right.
- For REPAIR: one sentence \u2014 a fresh lesson is coming tomorrow, being
  stuck here is normal, nothing to fix tonight. Do not teach the idea here.
- Explain any term the first time you use it. Warm and direct, never
  babyish.

You must answer only by calling the submit_verdict tool with your answer
in its arguments. Do not write any text outside that tool call.`;
var EVALUATE_TOOL = {
  name: "submit_verdict",
  description: "Submit the evaluation verdict for a student's competitive programming submission.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["verdict", "failure_type", "reason_for_system", "child_message", "flag_for_reinforcement"],
    properties: {
      verdict: { type: "string", enum: ["PASS", "SMALL_CORRECTION", "REPAIR"] },
      failure_type: { type: "string", enum: ["NONE", "WRONG", "TOO_SLOW", "BROKEN"] },
      method_used: { type: "string", description: "approach the code actually took, a few words" },
      reason_for_system: { type: "string", description: "why this verdict \u2014 for the tracker/log, not shown to child" },
      child_message: { type: "string", description: "shown directly to Nick" },
      scaling_note: { type: "string", description: "empty unless a passing solution won't scale to Silver" },
      flag_for_reinforcement: { type: "boolean", description: "true if this skill needs a refresher in next week's pack, independent of verdict" },
      reinforcement_reason: { type: "string", description: "empty unless flag_for_reinforcement is true" }
    }
  }
};
var HELP_SYSTEM_PROMPT = `You are the live help assistant for a single 11-year-old learning
competitive programming alone in Python, preparing for USACO Bronze. He
is mid-problem, stuck, and has already tried what he can alone before
reaching out. You speak to him directly and only through \`reply_to_nick\`;
every other field feeds the system, not him.

WHERE THIS SITS
He already has a Debugging Toolkit, in this order: make a guess first ->
read the error message -> try one fix -> add a print statement -> search
externally -> ask for help. This chat IS "ask for help" - he only gets
here after trying the earlier steps himself. Do not repeat those earlier
steps as instructions; instead, lead him back into guessing with a
question, the way "ask for help" should work for someone who already
tried the rest.

THE ONE RULE THAT MATTERS MOST
Never give the finished solution. Not the corrected code, not the
missing line, not "change X to Y." If you can point at WHERE to look
without saying WHAT is wrong there, that is the right amount of help.
Guide him to find it himself.

HOW TO HINT
- One hint at a time. Give the smallest nudge that might unstick him,
  then stop. Do not stack multiple hints in one reply, and do not
  pre-empt what he might ask next.
- Prefer a pointed question over a statement - a question sends him
  back to his own code with new eyes; a statement resolves it for him.
- The FIRST sentence of reply_to_nick must be a question. Not a
  question after an observation - the very first words. If you catch
  yourself about to write "X is empty / X needs to do Y / remember Z"
  before the question mark, that entire clause is the thing to delete,
  not keep. Everything you'd have explained belongs inside the question
  itself, or not at all.
  Wrong shape (do not do this): "Your \`pairs\` loop is empty - it needs
  to build value/position pairs, remembering positions are 1-indexed.
  What line should you add?" - by the time the question arrives there
  is nothing left for him to figure out.
  Right shape: "What does your \`pairs\` loop actually do right now, if
  anything?" - one question, nothing explained first, nothing given
  away. Let his answer tell you how much he already sees, then react to
  that in the NEXT turn rather than pre-empting it in this one.
- A yes/no question that names the specific missing technique is just
  as much of a giveaway as a statement, even though it's grammatically
  a question. "Did you sort the \`pairs\` list?" tells him exactly what
  to add \u2014 there's nothing left to work out, only a fact to confirm.
  Ask about a piece of STATE or BEHAVIOR he can go check instead of
  naming the technique: not "did you sort it?" but "what does your
  \`pairs\` list actually look like right when the while loop starts \u2014
  is it in the same order you built it in, or could it have changed?"
  He should still have to connect what he observes to the fix himself.
- If this is a genuinely new concept he hasn't seen before (not just a
  bug in something he's already learned), teach it with a short
  wrong/right code pair - a few lines of code that gets it wrong, a few
  lines that get it right, nothing else. Never an abstract paragraph
  explaining the idea in words alone.
- Explain any term in plain words the very first time you use it in
  this conversation, even if his lesson file already defined it. Assume
  nothing carries over from the file into this chat.
- Match the tone of his lesson files: direct, friendly, zero
  condescension. Never babyish, never a lecture.

IF HE WANTS THE ANSWER HANDED TO HIM
Don't shut him down coldly. Acknowledge that it's frustrating in one
short phrase, then offer one concrete next thing to try - a question or
a small check, not the fix itself.

WHEN TO STOP HINTING AND ESCALATE
This is a short, bounded exchange - a few turns, not an open-ended chat.
Set \`needs_escalation: true\` when either is true:
- the actual mistake is too complex or structural to fix through a hint
  exchange (it needs a fresh explanation, not a nudge), or
- \`hints_given_so_far\` is already several turns deep and he is still
  stuck on the same thing - do not keep hinting indefinitely.
When \`needs_escalation\` is true, \`reply_to_nick\` should say so in one
short, kind sentence - tell him to save his file and mention it to his
dad for the next correction pass. Do not attempt to teach or fix the
underlying idea in this reply.

WHAT SUCCESS LOOKS LIKE
Nick finds the fix himself, or leaves with exactly one concrete next
thing to try. Never a complete explanation handed to him.

You must answer only by calling the submit_help_reply tool with your
answer in its arguments. Do not write any text outside that tool call.`;
var HELP_TOOL = {
  name: "submit_help_reply",
  description: "Submit the Socratic help reply for Nick's live /help request.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply_to_nick", "debugging_stage", "needs_escalation"],
    properties: {
      reply_to_nick: { type: "string", description: "The single message shown directly to Nick. This is the only field he ever sees." },
      debugging_stage: { type: "string", enum: ["guess", "read_error", "try_fix", "print_statement", "search", "ask_for_help"], description: "Which step of the taught Debugging Toolkit this reply corresponds to \u2014 for consistency, not shown to Nick." },
      needs_escalation: { type: "boolean", description: "true if this should end the hint exchange and point Nick to save his file for dad's next weekly pass, rather than continuing to hint." },
      escalation_reason: { type: "string", description: "empty unless needs_escalation is true \u2014 brief internal note on why, not shown to Nick." }
    }
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}
async function logEvent(env, ctx, row) {
  if (!env || !env.DB) return;
  const insert = env.DB.prepare(
    `INSERT INTO events (
      event_type, problem_id, problem_title, submission, cses_verdict,
      verdict, failure_type, method_used, reason_for_system, child_message,
      scaling_note, flag_for_reinforcement, reinforcement_reason,
      nick_message, reply_to_nick, debugging_stage, needs_escalation,
      escalation_reason, hints_given_so_far, raw_envelope, raw_response
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    row.event_type ?? null,
    row.problem_id ?? null,
    row.problem_title ?? null,
    row.submission ?? null,
    row.cses_verdict ?? null,
    row.verdict ?? null,
    row.failure_type ?? null,
    row.method_used ?? null,
    row.reason_for_system ?? null,
    row.child_message ?? null,
    row.scaling_note ?? null,
    row.flag_for_reinforcement === true ? 1 : row.flag_for_reinforcement === false ? 0 : null,
    row.reinforcement_reason ?? null,
    row.nick_message ?? null,
    row.reply_to_nick ?? null,
    row.debugging_stage ?? null,
    row.needs_escalation === true ? 1 : row.needs_escalation === false ? 0 : null,
    row.escalation_reason ?? null,
    row.hints_given_so_far ?? null,
    row.raw_envelope ?? null,
    row.raw_response ?? null
  );
  const promise = insert.run().catch((err) => {
    console.error("D1 log write failed (non-fatal):", err);
  });
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(promise);
  } else {
    await promise;
  }
}
async function callAnthropic(env, model, systemPrompt, tool, envelope) {
  const body = {
    model,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: JSON.stringify(envelope, null, 2) }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name }
  };
  let lastTextSeen = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
    }
    const data = await resp.json();
    const toolUse = (data.content || []).find((b) => b.type === "tool_use");
    if (toolUse) return toolUse.input;
    const textBlock = (data.content || []).find((b) => b.type === "text");
    lastTextSeen = textBlock ? textBlock.text : JSON.stringify(data.content);
  }
  throw new Error("Model did not call the tool after a retry. Raw text: " + lastTextSeen);
}
function repairMessageActuallyTeaches(verdict) {
  if (verdict.verdict !== "REPAIR") return false;
  const msg = (verdict.child_message || "").trim();
  return msg.includes("?") || msg.length > 220;
}
async function handleEvaluate(request, env, ctx) {
  let envelope;
  try {
    envelope = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!envelope || !envelope.submission || !envelope.problem_id) {
    return jsonResponse({ error: "Missing required fields: problem_id, submission" }, 400);
  }
  try {
    let verdict = await callAnthropic(env, MODEL_EVALUATE, EVALUATE_SYSTEM_PROMPT, EVALUATE_TOOL, envelope);
    if (repairMessageActuallyTeaches(verdict)) {
      const retryEnvelope = Object.assign({}, envelope, {
        tutor_self_correction_note: "Your previous child_message for this REPAIR verdict diagnosed the problem and/or asked a question \u2014 that teaches, which REPAIR must not do. Rewrite child_message as ONE short, reassuring sentence only: a fresh lesson is coming tomorrow, being stuck here is normal, nothing to fix tonight. No diagnosis, no question."
      });
      verdict = await callAnthropic(env, MODEL_EVALUATE, EVALUATE_SYSTEM_PROMPT, EVALUATE_TOOL, retryEnvelope);
    }
    await logEvent(env, ctx, {
      event_type: "evaluate",
      problem_id: envelope.problem_id,
      problem_title: envelope.problem_title,
      submission: envelope.submission,
      cses_verdict: envelope.cses_verdict,
      verdict: verdict.verdict,
      failure_type: verdict.failure_type,
      method_used: verdict.method_used,
      reason_for_system: verdict.reason_for_system,
      child_message: verdict.child_message,
      scaling_note: verdict.scaling_note,
      flag_for_reinforcement: verdict.flag_for_reinforcement,
      reinforcement_reason: verdict.reinforcement_reason,
      raw_envelope: JSON.stringify(envelope),
      raw_response: JSON.stringify(verdict)
    });
    return jsonResponse(verdict);
  } catch (err) {
    console.error("evaluate error:", err);
    return jsonResponse({ error: err.message || String(err) }, 502);
  }
}
function opensWithQuestion(text) {
  if (!text) return false;
  const trimmed = text.trim();
  const qIndex = trimmed.indexOf("?");
  if (qIndex === -1) return false;
  const before = trimmed.slice(0, qIndex);
  return !/[.!]\s/.test(before);
}
function isLeadingYesNoQuestion(text) {
  if (!text) return false;
  const trimmed = text.trim();
  const qIndex = trimmed.indexOf("?");
  if (qIndex === -1) return false;
  const before = trimmed.slice(0, qIndex);
  return /\b(did|do|does|have|has|is|are|was|were)\s+you\b/i.test(before);
}
async function handleHelp(request, env, ctx) {
  let envelope;
  try {
    envelope = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!envelope || !envelope.current_code || !envelope.nick_message) {
    return jsonResponse({ error: "Missing required fields: current_code, nick_message" }, 400);
  }
  try {
    let reply = await callAnthropic(env, MODEL_HELP, HELP_SYSTEM_PROMPT, HELP_TOOL, envelope);
    if (!opensWithQuestion(reply.reply_to_nick) || isLeadingYesNoQuestion(reply.reply_to_nick)) {
      const retryEnvelope = Object.assign({}, envelope, {
        tutor_self_correction_note: "Your previous attempt either explained the situation before asking anything, or asked a yes/no question that names the specific missing technique directly (like 'did you sort the list?') \u2014 both give too much away. Rewrite reply_to_nick as ONE open question about what the code currently does or what a specific piece of state looks like, with no explanation first and no naming the fix. See the WRONG SHAPE / RIGHT SHAPE examples in your instructions."
      });
      reply = await callAnthropic(env, MODEL_HELP, HELP_SYSTEM_PROMPT, HELP_TOOL, retryEnvelope);
    }
    await logEvent(env, ctx, {
      event_type: "help",
      problem_id: envelope.problem_id,
      problem_title: envelope.problem_title,
      nick_message: envelope.nick_message,
      reply_to_nick: reply.reply_to_nick,
      debugging_stage: reply.debugging_stage,
      needs_escalation: reply.needs_escalation,
      escalation_reason: reply.escalation_reason,
      hints_given_so_far: envelope.hints_given_so_far,
      raw_envelope: JSON.stringify(envelope),
      raw_response: JSON.stringify(reply)
    });
    return jsonResponse(reply);
  } catch (err) {
    console.error("help error:", err);
    return jsonResponse({ error: err.message || String(err) }, 502);
  }
}

// ---------------------------------------------------------------------
// PARENT REPORT (added: standalone, unlisted, read-only dashboard)
// ---------------------------------------------------------------------

// Unlisted-URL secret. This is NOT a login system -- knowledge of this
// exact path segment is the only gate. Change this string and redeploy
// any time the link needs to be rotated.
var REPORT_TOKEN = "5c586e0a9cf68d34cd91d3d3";

// Mirrors the curriculum order in the tracker. Update this array when a
// new session is added -- it is the only thing that needs to change here.
var CURRICULUM = [
  { n: 1, problem_id: "cses-1068", title: "Weird Algorithm" },
  { n: 2, problem_id: "cses-1083", title: "Missing Number" },
  { n: 3, problem_id: "cses-1069", title: "Repetitions" },
  { n: 4, problem_id: "cses-1621", title: "Distinct Numbers" },
  { n: 5, problem_id: "cses-1754", title: "Coin Piles" },
  { n: 6, problem_id: "cses-1617", title: "Bit Strings" },
  { n: 7, problem_id: "cses-1084", title: "Apartments" },
  { n: 8, problem_id: "cses-1090", title: "Ferris Wheel" },
  { n: 9, problem_id: "cses-1640", title: "Sum of Two Values" },
  { n: 10, problem_id: "cses-1629", title: "Movie Festival" },
  { n: 11, problem_id: "cses-1632", title: "Movie Festival II" },
  { n: 12, problem_id: "cses-1619", title: "Restaurant Customers" }
];

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseTs(ts) {
  if (!ts) return null;
  // D1's datetime('now') default is "YYYY-MM-DD HH:MM:SS" in UTC.
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function formatSpan(firstDate, lastDate) {
  if (!firstDate || !lastDate) return null;
  const ms = lastDate.getTime() - firstDate.getTime();
  if (ms < 60000) return "under a minute";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return mins + " minute" + (mins === 1 ? "" : "s");
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + " hour" + (hours === 1 ? "" : "s") + " (spread across the session)";
  const days = Math.round(hours / 24);
  return days + " day" + (days === 1 ? "" : "s") + " (came back to it later)";
}

function formatWhen(date) {
  if (!date) return "no activity yet";
  return date.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
}

async function fetchParentReportData(env) {
  const evalRes = await env.DB.prepare(
    `SELECT problem_id, ts, verdict, flag_for_reinforcement
     FROM events WHERE event_type = 'evaluate' ORDER BY ts ASC`
  ).all();
  const helpRes = await env.DB.prepare(
    `SELECT problem_id, ts, needs_escalation
     FROM events WHERE event_type = 'help' ORDER BY ts ASC`
  ).all();

  const perProblem = {};
  const getRow = (pid) => {
    if (!perProblem[pid]) {
      perProblem[pid] = {
        attempts: 0, firstDate: null, lastDate: null,
        latestVerdict: null, latestFlag: 0, escalated: false
      };
    }
    return perProblem[pid];
  };

  for (const row of evalRes.results || []) {
    const p = getRow(row.problem_id);
    const d = parseTs(row.ts);
    p.attempts += 1;
    if (d && (!p.firstDate || d < p.firstDate)) p.firstDate = d;
    if (d && (!p.lastDate || d >= p.lastDate)) p.lastDate = d;
    // rows are ascending by ts, so the last one we see is the most recent
    p.latestVerdict = row.verdict;
    p.latestFlag = row.flag_for_reinforcement === 1 ? 1 : 0;
  }
  for (const row of helpRes.results || []) {
    const p = getRow(row.problem_id);
    if (row.needs_escalation === 1) p.escalated = true;
  }

  let sessionsPassed = 0;
  let totalAttempts = 0;
  let activeRedFlags = 0;
  let lastActivityOverall = null;

  const sessions = CURRICULUM.map((session) => {
    const stats = perProblem[session.problem_id];
    if (!stats || stats.attempts === 0) {
      return {
        ...session, status: "not_started", attempts: 0,
        span: null, lastSeen: null, redFlag: false
      };
    }
    totalAttempts += stats.attempts;
    const redFlag = stats.latestVerdict === "REPAIR" || stats.escalated || stats.latestFlag === 1;
    if (redFlag) activeRedFlags += 1;
    const status = stats.latestVerdict === "PASS" ? "passed" : "in_progress";
    if (status === "passed") sessionsPassed += 1;
    if (stats.lastDate && (!lastActivityOverall || stats.lastDate > lastActivityOverall)) {
      lastActivityOverall = stats.lastDate;
    }
    return {
      ...session, status, attempts: stats.attempts,
      span: formatSpan(stats.firstDate, stats.lastDate),
      lastSeen: stats.lastDate, redFlag
    };
  });

  return {
    sessions,
    summary: {
      sessionsPassed, totalSessions: CURRICULUM.length,
      totalAttempts, activeRedFlags, lastActivityOverall
    }
  };
}

function statusBadge(session) {
  if (session.redFlag) return `<span class="badge badge-flag">NEEDS A LOOK</span>`;
  if (session.status === "passed") return `<span class="badge badge-pass">PASSED</span>`;
  if (session.status === "in_progress") return `<span class="badge badge-progress">IN PROGRESS</span>`;
  return `<span class="badge badge-none">NOT STARTED</span>`;
}

function renderSessionCard(session) {
  const meta = [];
  if (session.attempts > 0) {
    meta.push(`${session.attempts} attempt${session.attempts === 1 ? "" : "s"}`);
  }
  if (session.span) meta.push(`took ${session.span}`);
  if (session.lastSeen) meta.push(`last activity ${escapeHtml(formatWhen(session.lastSeen))}`);
  const metaLine = meta.length
    ? `<div class="card-meta">${escapeHtml(meta.join(" \u00b7 "))}</div>`
    : `<div class="card-meta card-meta-empty">No submissions yet</div>`;

  return `
  <div class="card ${session.redFlag ? "card-flag" : ""}">
    <div class="card-top">
      <div class="card-title">
        <span class="card-num">Session ${session.n}</span>
        <span class="card-name">${escapeHtml(session.title)}</span>
      </div>
      ${statusBadge(session)}
    </div>
    ${metaLine}
  </div>`;
}

function renderParentReportHtml(data) {
  const { sessions, summary } = data;
  const flagLine = summary.activeRedFlags > 0
    ? `<div class="summary-flag">${summary.activeRedFlags} session${summary.activeRedFlags === 1 ? "" : "s"} flagged \u2014 see below</div>`
    : `<div class="summary-ok">No flags right now</div>`;

  const cardsHtml = sessions.map(renderSessionCard).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Nick \u2014 CP Progress Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #FAFAF8; --ink: #1F1D1A; --text-muted: #6B665D; --border: #E4E0D8;
    --surface: #FFFFFF; --surface-alt: #F1EFE9;
    --green: #2F8F4E; --green-light: #EAF6EE; --green-border: #BFE3CB;
    --blue: #2E6FB0; --blue-light: #EAF2FA; --blue-border: #BFD8EF;
    --red: #B23A3A; --red-light: #FBECEC; --red-border: #EAC0C0;
    --gray: #8A8579; --gray-light: #F1EFE9;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px 60px; background: var(--bg); color: var(--ink);
    font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.55;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 {
    font-family: 'Libre Baskerville', serif; font-size: 1.7rem; font-weight: 700;
    margin: 0 0 4px;
  }
  .subtitle { color: var(--text-muted); font-size: 13.5px; margin-bottom: 28px; }
  .summary {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    padding: 18px 22px; margin-bottom: 28px;
  }
  .summary-row { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 10px; }
  .summary-row:last-child { margin-bottom: 0; }
  .stat { min-width: 120px; }
  .stat-num { font-family: 'JetBrains Mono', monospace; font-size: 1.4rem; font-weight: 700; }
  .stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-flag { color: var(--red); font-weight: 600; font-size: 14px; }
  .summary-ok { color: var(--green); font-weight: 600; font-size: 14px; }
  .cards { display: flex; flex-direction: column; gap: 12px; }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--gray);
    border-radius: 8px; padding: 14px 18px;
  }
  .card-flag { border-left-color: var(--red); background: var(--red-light); }
  .card-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .card-title { display: flex; flex-direction: column; }
  .card-num { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .card-name { font-family: 'Libre Baskerville', serif; font-size: 1.05rem; font-weight: 700; }
  .card-meta { font-size: 13px; color: var(--text-muted); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }
  .card-meta-empty { font-style: italic; }
  .badge {
    font-size: 11px; font-weight: 700; letter-spacing: 0.05em; padding: 4px 10px;
    border-radius: 20px; white-space: nowrap;
  }
  .badge-pass { background: var(--green-light); color: var(--green); border: 1px solid var(--green-border); }
  .badge-progress { background: var(--blue-light); color: var(--blue); border: 1px solid var(--blue-border); }
  .badge-flag { background: var(--red-light); color: var(--red); border: 1px solid var(--red-border); }
  .badge-none { background: var(--gray-light); color: var(--gray); border: 1px solid var(--border); }
  .footer-note { margin-top: 28px; font-size: 12.5px; color: var(--text-muted); }
  @media print {
    body { background: #fff; color: #000; }
    .card, .summary { border-color: #999; background: #fff; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Nick's CP Progress</h1>
    <div class="subtitle">CSES handle: CaptainNickel \u00b7 Stage 3 \u2014 Sorting and Searching \u00b7 generated ${escapeHtml(formatWhen(new Date()))}</div>

    <div class="summary">
      <div class="summary-row">
        <div class="stat">
          <div class="stat-num">${summary.sessionsPassed} / ${summary.totalSessions}</div>
          <div class="stat-label">Sessions passed</div>
        </div>
        <div class="stat">
          <div class="stat-num">${summary.totalAttempts}</div>
          <div class="stat-label">Total attempts logged</div>
        </div>
        <div class="stat">
          <div class="stat-num">${escapeHtml(formatWhen(summary.lastActivityOverall))}</div>
          <div class="stat-label">Last activity</div>
        </div>
      </div>
      <div class="summary-row">
        ${flagLine}
      </div>
    </div>

    <div class="cards">
      ${cardsHtml}
    </div>

    <div class="footer-note">
      "Needs a look" means the last thing logged for that session was a REPAIR verdict,
      an escalated help request, or a flagged reinforcement note \u2014 not necessarily
      that anything is wrong right now. Time-on-task is the gap between the first and
      last logged attempt on a session, so it can include breaks, not just focused time.
      This page updates live from the same log the tutor writes to \u2014 refresh anytime.
    </div>
  </div>
</body>
</html>`;
}

async function handleParentReport(request, env, ctx, token) {
  if (token !== REPORT_TOKEN) {
    return jsonResponse({ error: "Not found." }, 404);
  }
  try {
    const data = await fetchParentReportData(env);
    const html = renderParentReportHtml(data);
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  } catch (err) {
    console.error("parent-report error:", err);
    return jsonResponse({ error: err.message || String(err) }, 502);
  }
}

var index_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/evaluate") {
      return handleEvaluate(request, env, ctx);
    }
    if (request.method === "POST" && url.pathname === "/help") {
      return handleHelp(request, env, ctx);
    }
    if (request.method === "GET" && url.pathname.startsWith("/parent-report/")) {
      const token = url.pathname.slice("/parent-report/".length);
      return handleParentReport(request, env, ctx, token);
    }

    return jsonResponse({ error: "Not found. Use POST /evaluate or POST /help." }, 404);
  }
};

export default index_default;
