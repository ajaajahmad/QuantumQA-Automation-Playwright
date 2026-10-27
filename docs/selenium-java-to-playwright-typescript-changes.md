# Selenium Java to Playwright TypeScript Changes

This document records the migration from the original Java, Maven, TestNG, and Selenium framework to the current Playwright TypeScript framework. It focuses on what changed and why those changes were made at code level.

## High-Level Migration

The old framework used Java classes under `src/main/java` and TestNG tests under `src/test/java`. That tree was removed after equivalent Playwright TypeScript foundations were created.

The new framework is organized under `e2e/`:

```text
e2e/
  auth/
  fixtures/
  pages/
  specs/
  test-data/
  utils/
```

Reason: Playwright projects usually keep browser automation code together under a dedicated test boundary. This avoids carrying Java/Maven conventions such as `src/main/resources` and `src/test/resources` into a TypeScript framework.

## Build and Runtime Tooling

### Removed Java/Maven Tooling

Removed:

- `pom.xml`
- `testng.xml`
- `sms_campaign.xml`
- `src/main/java/**`
- `src/test/java/**`

Reason: Maven, TestNG, and Selenium were no longer responsible for compiling or running tests. Keeping those files would create two competing frameworks and make project ownership unclear.

### Added Node and TypeScript Tooling

Added:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `playwright.config.ts`

Reason: Playwright Test is run by Node tooling. TypeScript gives compile-time checking for page objects, fixtures, config, and test data models.

Key scripts added in `package.json`:

```json
"test": "playwright test",
"auth:setup": "playwright test --project=auth-setup",
"test:sms-campaign": "playwright test e2e/specs/campaign/create-sms-campaign.spec.ts",
"typecheck": "tsc --noEmit"
```

Reason: test execution, auth-state creation, targeted suite execution, and static validation are now first-class commands.

## Playwright Configuration

Added `playwright.config.ts`.

Code-level changes:

- `testDir` points to `./e2e`.
- `outputDir` points to `artifacts/test-results`.
- HTML report output points to `artifacts/playwright-report`.
- Two projects are configured:
  - `auth-setup`
  - `chromium`
- The `chromium` project depends on `auth-setup`.
- Browser is locked to headed Chromium:

```ts
const browserName = 'chromium';
const headless = false;
```

Reason: Playwright project dependencies allow login to happen once before normal tests. Locking to headed Chromium matches the requested local execution behavior and avoids accidental Firefox/WebKit/headless runs from config drift.

## Framework Structure

### Page Objects

Old Java Page Objects:

- `LoginPage.java`
- `ErrorValidationPage.java`
- `SmsCampaignPage.java`
- `CampaignCommonComponent.java`
- `LogoutComponent.java`
- `TableSelectionManager.java`

New TypeScript equivalents:

- `e2e/pages/login/login.page.ts`
- `e2e/pages/login/login-error.page.ts`
- `e2e/pages/campaign/sms-campaign.page.ts`
- `e2e/pages/components/campaign-common.component.ts`
- `e2e/pages/components/logout.component.ts`
- `e2e/utils/table-selection-manager.ts`

Reason: the Page Object Model was worth preserving, but the implementation needed to use Playwright `Page` and `Locator` APIs instead of Selenium `WebDriver`, `By`, and `WebElement`.

### Base Page

Added:

- `e2e/pages/base.page.ts`

Code-level purpose:

- Stores the Playwright `Page`.
- Provides small wrappers for `click`, `fill`, and `press Enter`.
- Provides `xpathLiteral()` to safely interpolate dynamic values into XPath selectors.

Reason: the Selenium `BasePage` had explicit waits and sleeps. Playwright locators already auto-wait, so the new base page stays intentionally small and avoids reintroducing sleep-heavy Selenium patterns.

## Fixtures

Added:

- `e2e/fixtures/test-fixtures.ts`

Code-level changes:

- Extends Playwright's base `test`.
- Provides typed fixtures:
  - `loginPage`
  - `loginErrorPage`
  - `logoutComponent`
  - `smsCampaignPage`
  - `useAuthenticatedSession`
- Restores `sessionStorage` through `context.addInitScript()`.

Reason: TestNG inheritance through `BaseTest` was replaced with Playwright fixtures. Fixtures are the Playwright-native way to share page objects, test setup, and per-test context behavior without class inheritance.

## Authentication and Session Reuse

Added:

- `e2e/auth/auth.setup.ts`
- `e2e/utils/auth-state.ts`

Code-level changes:

- `auth.setup.ts` logs in with the first credential row.
- `saveAuthState(page)` writes Playwright storage state to:

```text
artifacts/.auth/storage-state.json
```

- `saveAuthState(page)` also captures session storage to:

```text
artifacts/.auth/session-state.json
```

- `test-fixtures.ts` restores session storage before pages load.
- `playwright.config.ts` applies `storageState` to normal test projects.

Reason: Selenium tests logged in repeatedly through UI. That is slow and brittle. Playwright can reuse cookies and localStorage through `storageState`, but sessionStorage is not included in Playwright's storage state, so a custom sessionStorage capture and restore layer was added.

The auth utility also records auth-like local/session storage entries whose keys match:

```text
auth | key | token | session | jwt | bearer
```

Reason: this helps inspect whether tokens/session keys are being captured without hard-coding application-specific key names.

## Specs

### Login Spec

Added:

- `e2e/specs/login/login.spec.ts`

Code-level changes:

- Uses fixture-based `loginPage`.
- Explicitly disables persisted auth:

```ts
test.use({ storageState: { cookies: [], origins: [] }, useAuthenticatedSession: false });
```

Reason: login tests must validate the login page from a clean browser state. If global auth state were applied, the login page might be skipped and the test would no longer test login.

### SMS Campaign Spec

Added:

- `e2e/specs/campaign/create-sms-campaign.spec.ts`

Code-level changes:

- Uses persisted auth state instead of calling `loginPage.userLogin()` inside the test.
- Keeps the original Java workflow order:
  - open SMS menu
  - open Campaigns
  - create campaign
  - select contact list
  - choose template
  - send campaign

Reason: this spec mirrors the former active TestNG `CreateCampaignTest`, but uses Playwright's authenticated project state to avoid login repetition.

## Configuration

Old:

```text
src/main/resources/config.properties
src/main/resources/config.properties.example
```

New:

```text
config/qa.properties
config/config.example.properties
```

Added:

- `e2e/utils/config.ts`

Code-level changes:

- Reads `config/qa.properties`.
- Falls back to `config/config.example.properties`.
- Supports environment variable overrides such as:
  - `APP_URL`
  - `TIMEOUT_SECONDS`
  - `SMS_LIST_NAME`
  - `SMS_TEMPLATE_NAME`

Reason: Java resource folders were removed. Config is now project-level and environment-focused. Env var overrides make the framework easier to run locally and in CI.

Note: browser/headless values are currently fixed in `playwright.config.ts` to headed Chromium, as requested.

## Test Data

Old:

```text
src/test/resources/testdata/*
```

New:

```text
e2e/test-data/*
```

Added:

- `e2e/utils/test-data.ts`

Code-level changes:

- Reads `e2e/test-data/userdata.json`.
- Filters out rows with blank username/password.
- Exposes typed `UserCredentials`.

Reason: Playwright tests should load data through TypeScript utilities, not Java DataProviders. The typed reader makes credential shape explicit.

## Reporting and Artifacts

New generated output locations:

```text
artifacts/playwright-report
artifacts/test-results
artifacts/.auth
```

Reason: Playwright reports, traces, screenshots, videos, and auth state should not sit beside source files. Grouping generated files under `artifacts/` keeps the repository clean.

## Git Ignore Changes

Updated `.gitignore` to ignore:

- `node_modules/`
- `artifacts/`
- local logs
- local `.env`
- `config/*.properties`, except `config/config.example.properties`
- real JSON/XLSX/CSV files in `e2e/test-data`, except example JSON

Reason: credentials, generated reports, auth tokens, and local data should not be committed. Example config and example test data remain trackable for onboarding.

## Documentation Added

Added or updated:

- `docs/playwright-migration.md`
- `docs/project-structure.md`
- `docs/selenium-java-to-playwright-typescript-changes.md`

Reason: the framework changed language, runner, structure, auth strategy, and execution commands. The documentation captures the new operating model for future contributors.

## Validation Performed

Validated after migration and restructuring:

```bash
npm run typecheck
npx playwright test --list
npx playwright test --list --project=chromium
```

These checks confirm:

- TypeScript compiles.
- Playwright discovers the auth setup project.
- Playwright discovers the migrated specs.
- The active browser project is Chromium.

Full browser execution was not run during migration because it would hit the configured live application environment.

## Intentional First-Pass Decisions

### XPath Kept Temporarily

Many locators were migrated from Selenium XPath to Playwright XPath.

Reason: preserving selector behavior reduced migration risk. Over time, these should be replaced with role, label, text, CSS, or `data-testid` locators where the application supports them.

### Excel Data Retained Temporarily

Some `.xlsx` files remain under `e2e/test-data`.

Reason: they were carried over from the Java framework. If Playwright does not need them, they can be removed in a cleanup pass.

### Login Flow Still Exists

The login page object and login spec remain even though auth state is reused.

Reason: reusable auth speeds normal tests, but the login flow still needs direct coverage.
