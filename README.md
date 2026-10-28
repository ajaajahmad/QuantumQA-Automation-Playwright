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

`config/qa.properties`: the app URL, timeout in seconds, and the SMS/WhatsApp contact list and template names the tests use.

```properties
app_url=<app-login-url>
timeout=20
sms_list_name=<sms-contact-list>
sms_template_name=<sms-template>
waba_list_name=<whatsapp-contact-list>
waba_template_name=<whatsapp-template>
```

`e2e/test-data/userdata.json`: one or more `{ "username", "password" }` rows. The first row is used to log in for all tests; the login spec runs once per row.

```json
[
  { "username": "<username>", "password": "<password>" },
  { "username": "<forgot-password-username>", "mobileLast4": "<last-4-digits>", "otp": "<otp>" }
]
```

The second row is optional and is for the forgot-password spec only: a **dedicated throwaway account**, with `mobileLast4` and `otp` in place of `password` (the last 4 digits of its registered mobile number, and the OTP staging accepts). The login spec and auth setup ignore this row. Without it the forgot-password spec is skipped.

Any property can be overridden with an environment variable: `APP_URL`, `TIMEOUT_SECONDS`, `SMS_LIST_NAME`, `SMS_TEMPLATE_NAME`, `WABA_LIST_NAME`, `WABA_TEMPLATE_NAME`.

## Running Tests

```bash
npm test                    # all specs
npm run test:sms-campaign   # SMS campaign spec only
npm run test:ui             # Playwright UI mode
npm run typecheck           # TypeScript check, no browser
```

Tests run in Chromium: headed locally, headless when `CI` is set. Projects run in order: `login` (the login spec, from a clean browser), then `auth-setup`, which logs in once and saves the session to `artifacts/.auth/`, then `chromium`, which runs every other spec with that session. Because of these dependencies, `npm run auth:setup` and `npm run test:sms-campaign` also run the login spec first.

> **Caution:** the SMS campaign spec clicks **Send Now**, so every run sends a real campaign to the configured contact list. Retries are disabled for this spec so a failure can't send a duplicate.

> **Caution:** the forgot-password spec requests 4 OTPs per run, and its happy path resets the account's password to a new random value each time. Never point it at an account anyone uses. The new password is recorded as an annotation in the HTML report.

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
  pages/           page objects and shared components
  specs/           test specs
  test-data/       local test data (real files are gitignored)
  utils/           config, auth state, dates, XPath helpers
playwright.config.ts
```

## Migration Status

Ported so far: login (valid, empty-field, and invalid-credential checks) and SMS campaign creation. Still to migrate from the Java suite:

1. SMS MIS summary and advanced pages
2. WhatsApp campaign and MIS pages
3. RCS MIS pages
4. Truecaller MIS pages
5. Account MIS pages

Locators are still mostly XPath carried over from Selenium. For new and touched code, prefer Playwright role, label, text, and test-id locators where the app exposes them.

## License

[MIT](LICENSE)
