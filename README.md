# messaging-platform-playwright-e2e

End-to-end UI tests for a web messaging platform, written in **TypeScript** with **Playwright** using the Page Object Model.

The framework was migrated from Selenium/Java/TestNG. See [Migration Status](#migration-status) for what is still pending.

## Prerequisites

- Node.js 26+ (`nvm use` picks it up from `.nvmrc`)
- Access to the target environment (staging by default)

## Setup

```bash
git clone https://github.com/ajaajahmad/messaging-platform-playwright-e2e.git
cd messaging-platform-playwright-e2e
npm install
npx playwright install chromium
```

Create two local files, plus a third for the admin panel specs. All are gitignored, so credentials never get committed.

`config/qa.properties`: the app URL, the API host the app calls (`api_url`, required), the admin panel URL (`admin_url`, needed only by the admin specs), timeout in seconds, the campaign category, and the SMS/WhatsApp contact list and template names the tests use.

```properties
app_url=<app-login-url>
api_url=<api-host-the-app-calls>
admin_url=<admin-panel-url>
timeout=20
campaign_category=<campaign-category>
sms_sender_id=<sms-sender-id>
sms_list_name=<sms-contact-list>
sms_template_name=<sms-template>
waba_list_name=<whatsapp-contact-list>
waba_template_name=<whatsapp-template>
```

`e2e/test-data/userdata.json`: one or more user rows. The first row is used to log in for all tests; the login spec runs once per row.

```json
[
  {
    "username": "<username>",
    "password": "<password>",
    "mobile_last_four_digits": "<last-4-digits>",
    "one_time_password": "<otp>"
  }
]
```

`one_time_password` is the static OTP staging accepts. It is needed for any user with two-factor authentication on, and by the forgot-password spec. `mobile_last_four_digits` is the last 4 digits of the account's registered mobile number, used only by the forgot-password spec. That spec uses the first row that has both, and is skipped if none does.

`e2e/test-data/admin-userdata.json`: the admin panel account. It is kept out of `userdata.json` because the login spec logs in with every row there. The admin panel always asks for an OTP.

```json
{
  "username": "<admin-username>",
  "password": "<admin-password>",
  "one_time_password": "<admin-otp>"
}
```

`admin_url` can be the admin panel's login URL or its folder; the specs keep only the folder and reach its API under `api/v1`. `npm test` runs the admin projects too, and without `admin_url` or this file they fail with a pointer to this section. Run other projects by name to skip them.

`campaign_category` defaults to `automation` when empty or missing. If the account has no category with that name, the SMS campaign spec creates it from the dropdown's Create New box, and the spec then writes the name into `qa.properties`.

`sms_sender_id` is optional. The template picker only lists templates registered under the selected sender ID, so set it to the sender of `sms_template_name`. When it's empty, the form keeps whichever sender it selects by default.

Any property can be overridden with an environment variable: `APP_URL`, `API_URL`, `ADMIN_URL`, `TIMEOUT_SECONDS`, `CAMPAIGN_CATEGORY`, `SMS_SENDER_ID`, `SMS_LIST_NAME`, `SMS_TEMPLATE_NAME`, `WABA_LIST_NAME`, `WABA_TEMPLATE_NAME`.

## Running Tests

```bash
npm test                    # all specs, headless
npm run test:headed         # all specs, with the browser window open
npm run test:sms-campaign   # SMS campaign spec only
npm run test:password-reset # change the account password (on demand only)
npm run test:admin          # admin panel specs only
npm run test:admin-write    # admin Create and Update User specs, headed (creates users; on demand only)
npm run test:ui             # Playwright UI mode
npm run typecheck           # TypeScript check, no browser
```

Tests run in Chromium, headless by default. Set `HEADED=1` (or use `npm run test:headed`) to watch the browser; headed runs fill the maximised window. `CI` does not affect headless mode; it sets retries, the worker count and `forbidOnly`.

Login happens once and the access token is reused across runs. `auth-setup` reuses the session saved in `artifacts/.auth/` while its token cookie has at least 15 minutes left and the API accepts the token, and logs in otherwise. The browser drops the cookie an hour after login, even though the API may still accept the token, and a password reset revokes the token. `chromium` then runs every other spec with that saved session. Specs that call the API directly use the `api` fixture, which sends the saved token as a Bearer header, e.g. `await api.get('/api/v1/settings')`.

The `login` project (the login and forgot-password specs) runs alongside, from a clean browser. Those specs log in because that is what they test, and staging keeps other sessions alive when they log out.

The admin panel has three projects of its own, set up the same way. `admin-auth-setup` saves and reuses the admin session in separate files under `artifacts/.auth/`, with the same 15-minute rule; the admin cookie lasts two hours, and the admin API takes the token without a Bearer prefix. `admin` runs the admin specs with that session, and `admin-login` signs in and out from a clean browser.

> **Note:** the admin specs are read-only, because admin changes reach every account on staging. They open, read and search, and never create, edit, delete or approve anything, or run a forgot or change password flow for the admin user. The negative login cases use a made-up username, so repeated runs can't lock the shared admin account; each run signs in for real once, plus once more when the saved admin session has expired.

> **Caution:** the exceptions are Users > Create User and the edit page of the users those specs created, the only admin pages the specs may write to. Their specs live in `specs/admin/write/` and run only in the `admin-write` project, which exists with `ADMIN_WRITE=1` (`npm run test:admin-write`, headed). Each run creates two permanent users named `qa_auto_<timestamp>` with `example.com` emails under the Compiled Test organization: one plain, after which the same username is tried again to check it is refused, and one with SMPP enabled. The SMPP account allows binds only from `192.0.2.10`, a documentation-only address, so nothing real can connect with it. The update spec then edits the newest `qa_auto_` user made before it started (company and full name, state, city, zip code, address and session timeout); it never touches mobile or email, which the Approval page queues for approval. Nothing is deleted afterwards, because deleting users is outside what the specs may do.

> **Note:** the sender ID and template lifecycle specs create, edit and delete real records on staging. Each test removes everything it created through the API afterwards, even when it fails, and test records are named `QAT...` (sender IDs) and `qa_auto_...` (templates).

> **Note:** the SMS campaign spec clicks **Send Now**, so every run creates a campaign on staging. Staging uses a fake SMS setup, so no real messages are delivered. Retries are disabled for this spec so a failure can't create a duplicate campaign.

> **Caution:** `npm run test:password-reset` changes the password of the forgot-password account, which is also the account all tests log in with. It never runs as part of `npm test`, because the reset revokes every token, including the saved one. Run it on its own, not while other tests are running. The spec generates a new password with the same length and character types as the current one, resets it through forgot password, and logs in with it. Only after that login succeeds does it write the new password into `userdata.json` and save the new session, so the next run reuses that token instead of logging in.
>
> Just before clicking Reset, the new password is saved to `e2e/test-data/pending-password.json` (gitignored). If any later step fails, `userdata.json` is left unchanged and the pending file stays, because staging may already have accepted the new password. The next reset then stops until you log in with the pending password, copy it into `userdata.json` if it works, and delete the file.
>
> The forgot-password negative specs never change the password: each one checks that staging refused the password it submitted, and if staging ever accepts one, the test writes that password into `userdata.json` before failing, so later runs can still log in. They request 13 OTPs per run to the account's registered mobile, the login specs trigger 2FA OTPs too, and the reset requests one more.

## Reports and Debugging

Output goes to `artifacts/` (gitignored):

- `artifacts/playwright-report/`: HTML report. Open it with `npx playwright show-report artifacts/playwright-report`.
- `artifacts/test-results/`: screenshots, videos, and traces for failed tests. Open a trace with `npx playwright show-trace <path-to-trace.zip>`.

## Project Structure

```text
config/            runtime configuration (qa.properties is local only)
e2e/
  auth/            login setup that saves reusable auth state
  fixtures/        Playwright fixtures that provide page objects (admin-fixtures.ts for the admin panel)
  pages/           page objects by UI area (login, dashboard, sms, campaign, reports, users, admin) and shared components
  specs/           test specs (specs/admin/ for the admin panel)
  test-data/       local test data (real files are gitignored)
  utils/           config, auth state, test data, passwords, dates, XPath helpers
playwright.config.ts
```

## Migration Status

Ported so far: login (valid login and logout, field validation, password visibility, Enter to submit, 2FA wrong OTP and cancel, session redirects), forgot password (field validation, OTP checks, password policy, cancel on each screen, and an on-demand real reset), dashboard (tabs, currency balance, carousels, header menus, Settings pages, side navigation), SMS sender IDs and templates (list, search, page size, form validation, cancel, and create, edit and delete with duplicate and format checks), SMS campaigns (list, search, page size, create-form validation, and sending a campaign), the SMS, WhatsApp, RCS, Truecaller and Email summary reports (every tab and view, counts, custom, monthly and yearly periods, the filter bar, and page size, each checked against the request it sends and the columns, cells and totals the API returns; WhatsApp also covers incoming messages), and the SMS, WhatsApp, RCS, Truecaller and Email advanced search (both tabs: the fields and their lists, searching by picked value, contained text, mobile number, status, tag and GUID, every view, counts, dates, and page size, checked against what Search posts and the table it builds), and the SMS, WhatsApp, RCS, Truecaller and Email Account MIS pages (both tabs: the fields and their lists including Username, searching by picked value, contained text, mobile number and status, every view, counts, dates, and page size, checked the same way). Still to migrate from the Java suite:

1. WhatsApp campaigns

Locators are still mostly XPath carried over from Selenium. For new and touched code, prefer Playwright role, label, text, and test-id locators where the app exposes them.

## Admin Panel

New coverage, not part of the Java suite: login (signing in with the OTP and out again, empty fields, an unknown username, Enter to submit, the redirect without a session), Organizations (the home page, the listing checked row by row against the API, and search), every other User Onboarding page (Contracts, Users, Teammates, Credits, Transaction History, Rule Matrix, Report Scheduler, Daily Threshold, SFTP Configurations and Approval: each opened from the side nav, with its heading, columns, row count and total checked against the API), the side navigation's groups and entries, and, on demand, Create User (filling every required field, Cancel without saving, a real create checked on the user's edit page, a refused duplicate username, the SMPP Username and Shortcode length limits, and a create with SMPP enabled whose settings are checked on the edit page) and Update User (Cancel without saving, and an update of a test user's details checked by reopening it).

## License

[MIT](LICENSE)
