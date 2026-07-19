// Nick CP Tutor — Cloudflare Worker
//
// Two endpoints, per the implementation brief Section 3:
//   POST /evaluate — judge a CSES submission, return a verdict object.
//   POST /help     — one bounded Socratic reply for a stuck learner.
//
// Holds the Anthropic API key server-side as env.ANTHROPIC_API_KEY
// (set via `wrangler secret put ANTHROPIC_API_KEY`, or pushed automatically
// by the GitHub Actions deploy workflow — see ../SETUP.md).
//
// No login, no D1, no sessions, no audit log — per the brief's guardrails.
// State lives client-side in the lesson HTML (localStorage), not here.

const MODEL = "claude-haiku-4-5-20251001";

const EVALUATE_SYSTEM_PROMPT = `You are the evaluator for a single 11-year-old learning competitive
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
    WRONG    — logic is incorrect (wrong output on valid input)
    TOO_SLOW — logic is correct but would time out at max input size
    BROKEN   — it crashes or doesn't run

CHOOSING THE VERDICT
- PASS: correct and efficient enough. Any valid method.
- SMALL_CORRECTION: one clear, self-fixable mistake stands between him and
  a pass — an off-by-one, a missing sort, a wrong print, one bad branch.
  He can fix it himself with a nudge and resubmit today.
- REPAIR: the misunderstanding is structural, or the correct-but-slow
  method he used has NOT appeared in \`taught_recently\`. Needs a fresh
  lesson tomorrow, not a same-day nudge.
- EXCEPTION: if the code is correct but too slow, and the fast method
  needed IS listed in \`taught_recently\`, treat this as SMALL_CORRECTION —
  he has the tool and just didn't reach for it. Nudge him to remember it.
  Regardless of verdict in this case, set \`flag_for_reinforcement: true\`,
  because passing today with a reminder doesn't prove the technique is
  solid — it should get a short refresher in the next week's material.

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
- For REPAIR: one sentence — a fresh lesson is coming tomorrow, being
  stuck here is normal, nothing to fix tonight. Do not teach the idea here.
- Explain any term the first time you use it. Warm and direct, never
  babyish.

You must answer only by calling the submit_verdict tool with your answer
in its arguments. Do not write any text outside that tool call.`;

const EVALUATE_TOOL = {
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
      reason_for_system: { type: "string", description: "why this verdict — for the tracker/log, not shown to child" },
      child_message: { type: "string", description: "shown directly to Nick" },
      scaling_note: { type: "string", description: "empty unless a passing solution won't scale to Silver" },
      flag_for_reinforcement: { type: "boolean", description: "true if this skill needs a refresher in next week's pack, independent of verdict" },
      reinforcement_reason: { type: "string", description: "empty unless flag_for_reinforcement is true" }
    }
  }
};

const HELP_SYSTEM_PROMPT = `You are the live help assistant for a single 11-year-old learning
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
- Open with the question. Do not announce where the bug is or confirm
  "that's the problem" before asking anything - even naming the right
  spot as a statement first turns the question that follows into a
  formality instead of something he has to actually work out. If you
  want to point at a location, do it BY asking about it ("what happens
  in your \`pairs\` loop right now?"), not by stating it and then asking
  a question on top.
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

const HELP_TOOL = {
  name: "submit_help_reply",
  description: "Submit the Socratic help reply for Nick's live /help request.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply_to_nick", "debugging_stage", "needs_escalation"],
    properties: {
      reply_to_nick: { type: "string", description: "The single message shown directly to Nick. This is the only field he ever sees." },
      debugging_stage: { type: "string", enum: ["guess", "read_error", "try_fix", "print_statement", "search", "ask_for_help"], description: "Which step of the taught Debugging Toolkit this reply corresponds to — for consistency, not shown to Nick." },
      needs_escalation: { type: "boolean", description: "true if this should end the hint exchange and point Nick to save his file for dad's next weekly pass, rather than continuing to hint." },
      escalation_reason: { type: "string", description: "empty unless needs_escalation is true — brief internal note on why, not shown to Nick." }
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

// Calls the Anthropic API with a forced tool call. Retries once if the
// model writes text instead of invoking the tool (observed occasionally
// with Haiku during testing) before giving up with a clear error — never
// silently reshapes non-conforming text into something schema-shaped.
async function callAnthropic(env, systemPrompt, tool, envelope) {
  const body = {
    model: MODEL,
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

async function handleEvaluate(request, env) {
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
    const verdict = await callAnthropic(env, EVALUATE_SYSTEM_PROMPT, EVALUATE_TOOL, envelope);
    return jsonResponse(verdict);
  } catch (err) {
    console.error("evaluate error:", err);
    return jsonResponse({ error: err.message || String(err) }, 502);
  }
}

async function handleHelp(request, env) {
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
    const reply = await callAnthropic(env, HELP_SYSTEM_PROMPT, HELP_TOOL, envelope);
    return jsonResponse(reply);
  } catch (err) {
    console.error("help error:", err);
    return jsonResponse({ error: err.message || String(err) }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/evaluate") {
      return handleEvaluate(request, env);
    }

    if (request.method === "POST" && url.pathname === "/help") {
      return handleHelp(request, env);
    }

    return jsonResponse({ error: "Not found. Use POST /evaluate or POST /help." }, 404);
  }
};
