# Playwright TypeScript Migration

This repository now contains a Playwright TypeScript test stack. The old Java/TestNG/Selenium source tree has been removed.

For a detailed code-level change log, see `docs/selenium-java-to-playwright-typescript-changes.md`.

## What Has Been Ported

- Playwright project configuration in `playwright.config.ts`
- TypeScript config in `tsconfig.json`
- Runtime config reader in `e2e/utils/config.ts`
- JSON user data reader in `e2e/utils/test-data.ts`
- Login page object
- Login error page object
- Logout component
- Campaign common component
- Table selection helper
- SMS campaign page object
- SMS campaign creation spec
- Basic valid login spec
- Auth setup that persists cookies, localStorage, and sessionStorage

## Commands

```bash
npm install
npx playwright install
npm run typecheck
npm run auth:setup
npm test
npm run test:sms-campaign
```

## Runtime Configuration

The Playwright stack reads `config/qa.properties` first and falls back to `config/config.example.properties`.

The following environment variables can override properties:

- `APP_URL`
- `BROWSER`
- `HEADLESS`
- `TIMEOUT_SECONDS`
- `SMS_LIST_NAME`
- `SMS_TEMPLATE_NAME`
- `WABA_LIST_NAME`
- `WABA_TEMPLATE_NAME`

The Playwright runner is locked to headed Chromium by default.

## Migration Notes

The first migrated flow mirrors the former active TestNG suite, which ran `CreateCampaignTest`.

Continue migrating modules one by one:

1. SMS MIS summary and advanced pages
2. WhatsApp campaign and MIS pages
3. RCS MIS pages
4. Truecaller MIS pages
5. Account MIS pages

Prefer Playwright role, label, text, and stable test-id locators when the application exposes them. XPath has been kept for the first pass because it preserves behavior from the Selenium suite.
