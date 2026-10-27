# QuantumQA Automation Framework

End-to-end UI tests for a web messaging platform, written in **TypeScript** with **Playwright** using the Page Object Model.

The framework was migrated from Selenium/Java/TestNG. See [docs/playwright-migration.md](docs/playwright-migration.md) for what has been ported and what is still pending.

## Prerequisites

- Node.js 20+
- Access to the target environment (staging by default)

## Setup

```bash
git clone https://github.com/ajaajahmad/QuantumQA-Automation.git
cd QuantumQA-Automation
npm install
npx playwright install chromium
```

Create the two local files from their examples. Both are gitignored, so credentials never get committed.

```bash
cp config/config.example.properties config/qa.properties
cp e2e/test-data/userdata.example.json e2e/test-data/userdata.json
```

Then edit them:

- `config/qa.properties`: the app URL, timeout (seconds), and the SMS/WhatsApp contact list and template names the tests use.
- `e2e/test-data/userdata.json`: one or more `{ "username", "password" }` rows. The first row is used to log in for all tests; the login spec runs once per row.

Any property can be overridden with an environment variable: `APP_URL`, `TIMEOUT_SECONDS`, `SMS_LIST_NAME`, `SMS_TEMPLATE_NAME`, `WABA_LIST_NAME`, `WABA_TEMPLATE_NAME`.

## Running Tests

```bash
npm test                    # all specs
npm run test:sms-campaign   # SMS campaign spec only
npm run test:ui             # Playwright UI mode
npm run typecheck           # TypeScript check, no browser
```

Tests run in headed Chromium. Before the specs run, the `auth-setup` project logs in once and saves the session to `artifacts/.auth/`, which the other specs reuse.

> **Caution:** the SMS campaign spec clicks **Send Now**, so every run sends a real campaign to the configured contact list.

## Reports and Debugging

Output goes to `artifacts/` (gitignored):

- `artifacts/playwright-report/`: HTML report. Open it with `npx playwright show-report artifacts/playwright-report`.
- `artifacts/test-results/`: screenshots, videos, and traces for failed tests. Open a trace with `npx playwright show-trace <path-to-trace.zip>`.

## Project Structure

```text
config/            runtime configuration (qa.properties is local only)
docs/              migration notes and structure guide
e2e/
  auth/            login setup that saves reusable auth state
  fixtures/        Playwright fixtures that provide page objects
  pages/           page objects and shared components
  specs/           test specs
  test-data/       local test data (real files are gitignored)
  utils/           config, auth state, dates, table helpers
playwright.config.ts
```

See [docs/project-structure.md](docs/project-structure.md) for details.

## License

[MIT](LICENSE)
