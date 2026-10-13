# Deal Stack

Your coupons, card offers and the best way to pay, in one place.

## Launch

**Make your key.** Make up a long password (20+ letters and numbers) and save it in Notes. You'll paste it in a few places.

**GitHub**
1. Unzip deal-stack.zip in the Files app.
2. Go to github.com/new, name it `deal-stack`, choose **Public**, tap **Create repository**.
3. Tap **uploading an existing file**, select every file in the deal-stack folder, tap **Commit changes**. Check that `_worker.js` kept its name.
4. Open **Actions**, tap **set up a workflow yourself**, delete the sample text, paste everything from `workflow.txt`, and commit.

**Cloudflare**
5. In dash.cloudflare.com open **Storage & Databases**, then **D1**, tap **Create**, name it `deal-stack`, create it.
6. Open **Workers & Pages**, tap **Create application**, then **Pages**, then **Connect to Git**. Pick the deal-stack repository and tap **Begin setup**.
7. Framework preset **None**. Build command `exit 0`. Leave Build output directory empty (type `/` if it won't let you). Tap **Save and Deploy**.
8. In the project open **Settings**, then **Bindings**, tap **Add**, choose **D1 database**, name it `DB`, pick deal-stack, save.
9. In **Settings**, **Variables and Secrets**, tap **Add**, type **Secret**, name `APP_KEY`, paste your key, save.
10. Open **Deployments**, tap the menu on the newest one, tap **Retry deployment**. Note your address, like https://deal-stack.pages.dev.

**Connect the collector**
11. On GitHub open **Settings**, **Secrets and variables**, **Actions**. Add `HUB_URL` (your Cloudflare address, no slash at the end) and `HUB_KEY` (your key).
12. Open **Actions**, **Deal Stack collector**, **Run workflow**. It takes about 5 minutes and then runs every 6 hours.

**Your phone**
13. Open your address in Safari, enter your key, then **Share**, **Add to Home Screen**.

## Safari add-on (checkout tester and card-offer saver)
1. Install the free **Userscripts** app from the App Store and open it once.
2. In iPhone Settings open **Apps**, **Safari**, **Extensions**, **Userscripts**. Turn it on and allow it on all websites.
3. In Safari open your address followed by `/install/deal-stack.user.js`. Tap the **aA** (or puzzle) button, choose **Userscripts**, tap **Install**.
4. Open your Deal Stack address in Safari once and enter your key there. The add-on picks it up.

To save card offers, sign in on capitalone.com (Offers), capitaloneshopping.com or citi.com (Merchant Offers) in Safari and tap the Deal Stack button. For Venmo, screenshot the offers screen and import it in the Cards tab.

## Gmail scanner
1. In Safari open your address followed by `/install/gmail-scanner.gs`, select all the text and copy it.
2. Go to script.google.com (use **Request Desktop Website**), tap **New project**, delete the sample, paste.
3. Replace PASTE-YOUR-KEY-HERE with your key and save.
4. Pick **setup** in the function menu and tap **Run**. Allow access. Google warns that the app isn't verified because it's your own script: tap **Advanced**, then **Go to project**.

## Files
- `index.html`, `engine.js`: the app.
- `_worker.js`: your private hub on Cloudflare.
- `collector.js`: runs on GitHub's schedule. It follows each site's robots.txt and skips any site that blocks automated visits.
- `addon.js`, `gmail.js`: templates your hub fills in for the Safari add-on and the Gmail scanner.
- `workflow.txt`: the schedule for GitHub Actions.
