# Deal Stack

Your coupons, card offers and the best way to pay, in one place.

## What each file does
- `index.html`, `engine.js`, `sw.js`, `manifest.webmanifest`, icons: the app.
- `_worker.js`: your private hub on Cloudflare (D1 binding named DB, secret named APP_KEY).
- `collector.js`: runs on GitHub's schedule. Reads each store's homepage, its deals pages, the pages its promotions link to and their terms. Follows robots.txt and skips any site that blocks automated visits.
- `addon.js`, `gmail.js`: templates your hub fills in for the Safari add-on (/install/deal-stack.user.js) and the Gmail scanner (/install/gmail-scanner.gs).
- `workflow.txt`: the GitHub Actions schedule (already installed as .github/workflows/main.yml).
- `wrangler.jsonc`: tells Cloudflare how to run the hub. `wrangler.template.jsonc` is a blank copy.

## Every deal says
- what it's worth, what it applies to (your whole order, a section, specific items or one product), where to use it, and its fine print word for word with the page it came from.
- Deals the app can't describe clearly are left out.
