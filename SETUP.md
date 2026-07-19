# Setup — no laptop install required

Everything here is done through GitHub and Cloudflare's websites in a browser.
No Node, npm, wrangler, or Claude Code needed on the laptop.

## What you're setting up

- A Cloudflare Worker (`worker/index.js`) that holds the Anthropic API key
  and exposes `POST /evaluate` and `POST /help`.
- A GitHub Action that deploys that Worker automatically whenever you push
  changes to `worker/`.
- One lesson file (`lesson_session9_sum_of_two_values.html`) that calls it.

## One-time setup

1. **Create a GitHub repo** and push this whole folder to it (via GitHub's
   web upload, or `git push` from any machine that has git — the *deploy*
   step itself needs no local tools, only getting the files into the repo
   does).

2. **Get a Cloudflare API token.**
   - Log into (or create) a free Cloudflare account.
   - Go to My Profile → API Tokens → Create Token → "Edit Cloudflare
     Workers" template. Copy the token — you won't see it again.

3. **Get your Cloudflare Account ID.**
   - Cloudflare dashboard → Workers & Pages → your Account ID is shown on
     the right sidebar.

4. **Get an Anthropic API key.**
   - console.anthropic.com → API Keys → Create Key. This is billed
     pay-as-you-go — a few cents a day at most for this usage pattern.

5. **Add three repository secrets** in GitHub: repo → Settings → Secrets
   and variables → Actions → New repository secret.
   - `CLOUDFLARE_API_TOKEN` — from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — from step 3
   - `ANTHROPIC_API_KEY` — from step 4

6. **Push to `main`.** The GitHub Action (`.github/workflows/deploy.yml`)
   runs automatically, deploys the Worker, and pushes the API key to it as
   a Worker secret — you never handle the key outside GitHub's own secret
   storage.

7. **Find your Worker's URL.** Cloudflare dashboard → Workers & Pages →
   `nick-cp-tutor` → the URL is shown at the top, something like
   `https://nick-cp-tutor.<your-subdomain>.workers.dev`.

8. **Open `lesson_session9_sum_of_two_values.html`** and change one line:

   ```js
   const WORKER_BASE_URL = "REPLACE_WITH_YOUR_WORKER_URL";
   ```

   to your actual Worker URL from step 7. Push that change too — the page
   will now say **LIVE MODE** instead of **TEST MODE** at the top of the
   "Check your code" section, and every request goes through your real,
   always-on Worker instead of this artifact's preview bridge.

9. **Host the lesson file on GitHub Pages** (repo → Settings → Pages →
   deploy from the branch/folder this file lives in). That gives Nick a
   normal URL he can open any day, no browser extensions or Claude access
   needed on his end.

## Testing before you deploy anything

You don't have to do any of the above just to see it work. Open
`lesson_session9_sum_of_two_values.html` right here in this Claude
conversation (or re-download and open it again in a fresh one) — it runs
in **TEST MODE** automatically, calling Claude directly through Claude's
own preview bridge, no Worker or API key needed on your end for that. This
only works while the file is open inside Claude, not once it's hosted
elsewhere — that's exactly why step 8 exists.

## If something breaks after deploying

- **Worker deploy fails in the Actions tab** — click into the failed run's
  logs. The most common cause is a typo'd secret name; they must match
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`
  exactly.
- **Lesson page says "Couldn't reach the tutor" / "Couldn't check your
  code"** — open the browser console on that page; the error message
  passed through is whatever the Worker returned, which is usually enough
  to tell what's wrong (bad API key, Worker not deployed yet, wrong URL).
- **"No account id found, quitting"** in the Action logs — the
  `CLOUDFLARE_ACCOUNT_ID` secret is missing or wrong.
