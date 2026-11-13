# QuantumQA-Automation-Playwright

End-to-end UI tests for a web messaging platform, written in **TypeScript** with **Playwright** using the Page Object Model.

The framework was migrated from Selenium/Java/TestNG. See [Migration Status](#migration-status) for what is still pending.

## Prerequisites

- Node.js 26+ (`nvm use` picks it up from `.nvmrc`)
- Access to the target environment (staging by default)

## Setup

```bash
git clone https://github.com/ajaajahmad/QuantumQA-Automation-Playwright.git
cd QuantumQA-Automation-Playwright
npm install
npx playwright install chromium
```

Create two local files. Both are gitignored, so credentials never get committed.

`config/qa.properties`: the app URL, the API host the app calls (`api_url`, required), timeout in seconds, the campaign category, and the SMS/WhatsApp contact list and template names the tests use.

```properties
app_url=<app-login-url>
api_url=<api-host-the-app-calls>
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

`campaign_category` defaults to `automation` when empty or missing. If the account has no category with that name, the SMS campaign spec creates it from the dropdown's Create New box, and the spec then writes the name into `qa.properties`.

`sms_sender_id` is optional. The template picker only lists templates registered under the selected sender ID, so set it to the sender of `sms_template_name`. When it's empty, the form keeps whichever sender it selects by default.

Any property can be overridden with an environment variable: `APP_URL`, `API_URL`, `TIMEOUT_SECONDS`, `CAMPAIGN_CATEGORY`, `SMS_SENDER_ID`, `SMS_LIST_NAME`, `SMS_TEMPLATE_NAME`, `WABA_LIST_NAME`, `WABA_TEMPLATE_NAME`.

## Running Tests

```bash
npm test                    # all specs
npm run test:sms-campaign   # SMS campaign spec only
npm run test:password-reset # change the account password (on demand only)
npm run test:ui             # Playwright UI mode
npm run typecheck           # TypeScript check, no browser
```

Tests run in Chromium: headed locally, headless when `CI` is set.

Login happens once and the access token is reused across runs. `auth-setup` reuses the session saved in `artifacts/.auth/` while its token cookie has at least 15 minutes left and the API accepts the token, and logs in otherwise. The browser drops the cookie an hour after login, even though the API may still accept the token, and a password reset revokes the token. `chromium` then runs every other spec with that saved session. Specs that call the API directly use the `api` fixture, which sends the saved token as a Bearer header, e.g. `await api.get('/api/v1/settings')`.

The `login` project (the login and forgot-password specs) runs alongside, from a clean browser. Those specs log in because that is what they test, and staging keeps other sessions alive when they log out.

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
  fixtures/        Playwright fixtures that provide page objects
  pages/           page objects by UI area (login, dashboard, sms, campaign, reports) and shared components
  specs/           test specs
  test-data/       local test data (real files are gitignored)
  utils/           config, auth state, test data, passwords, dates, XPath helpers
playwright.config.ts
```

## Migration Status

Ported so far: login (valid login and logout, field validation, password visibility, Enter to submit, 2FA wrong OTP and cancel, session redirects), forgot password (field validation, OTP checks, password policy, cancel on each screen, and an on-demand real reset), dashboard (tabs, currency balance, carousels, header menus, Settings pages, side navigation), SMS sender IDs and templates (list, search, page size, form validation, cancel, and create, edit and delete with duplicate and format checks), SMS campaigns (list, search, page size, create-form validation, and sending a campaign), and the WhatsApp summary report (both tabs: every view, counts, custom, monthly and yearly periods, and page size, each checked against the request it sends and the columns the API returns). Still to migrate from the Java suite:

1. SMS MIS summary and advanced pages
2. WhatsApp campaigns, WhatsApp advanced MIS pages
3. RCS MIS pages
4. Truecaller MIS pages
5. Account MIS pages

Locators are still mostly XPath carried over from Selenium. For new and touched code, prefer Playwright role, label, text, and test-id locators where the app exposes them.

## License

[MIT](LICENSE)
