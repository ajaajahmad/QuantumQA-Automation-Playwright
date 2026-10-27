# Project Structure

```text
config/
  config.example.properties
  qa.properties
docs/
e2e/
  auth/
  fixtures/
  pages/
  specs/
  test-data/
  utils/
playwright.config.ts
package.json
tsconfig.json
```

## Directory Roles

- `config/`: environment-level runtime configuration.
- `e2e/auth/`: setup tests that create reusable authenticated browser state.
- `e2e/specs/`: executable Playwright specs.
- `e2e/pages/`: page objects and reusable page components.
- `e2e/fixtures/`: Playwright fixture composition.
- `e2e/test-data/`: local test data files.
- `e2e/utils/`: framework helpers such as config, dates, and table selection.
- `artifacts/`: generated Playwright reports, traces, screenshots, and videos.
- `artifacts/.auth/`: generated cookies, localStorage, and sessionStorage state.

## Local Files

`config/qa.properties` and real files under `e2e/test-data/` are ignored so credentials and environment-specific data stay local.

The Playwright runner is configured to use headed Chromium by default.

Keep tracked examples current:

- `config/config.example.properties`
- `e2e/test-data/userdata.example.json`
