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

Any property can be overridden with an environment variable: `APP_URL`, `TIMEOUT_SECONDS`, `SMS_LIST_NAME`, `SMS_TEMPLATE_NAME`, `WABA_LIST_NAME`, `WABA_TEMPLATE_NAME`.

## Running Tests

```bash
npm test                    # all specs
npm run test:sms-campaign   # SMS campaign spec only
npm run test:ui             # Playwright UI mode
npm run typecheck           # TypeScript check, no browser
```

Tests run in Chromium: headed locally, headless when `CI` is set. Projects run in order: `login` (the login and forgot-password specs, from a clean browser), then `auth-setup`, which logs in once and saves the session to `artifacts/.auth/`, then `chromium`, which runs every other spec with that session. Because of these dependencies, `npm run auth:setup` and `npm run test:sms-campaign` also run the login spec first.

> **Note:** the SMS campaign spec clicks **Send Now**, so every run creates a campaign on staging. Staging uses a fake SMS setup, so no real messages are delivered. Retries are disabled for this spec so a failure can't create a duplicate campaign.

> **Caution:** the forgot-password spec requests 4 OTPs per run to the account's registered mobile. It never changes the password: every password it submits is either rejected by the app or the current one, and staging refuses to reuse any of the last 3. Testing a successful reset needs a separate throwaway account.

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

Ported so far: login (valid, empty-field, and invalid-credential checks), forgot password, and SMS campaign creation. Still to migrate from the Java suite:

1. SMS MIS summary and advanced pages
2. WhatsApp campaign and MIS pages
3. RCS MIS pages
4. Truecaller MIS pages
5. Account MIS pages

Locators are still mostly XPath carried over from Selenium. For new and touched code, prefer Playwright role, label, text, and test-id locators where the app exposes them.

## License

[MIT](LICENSE)
