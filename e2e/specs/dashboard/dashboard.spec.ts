import { expect, test } from '../../fixtures/test-fixtures';
import type { SettingsItem } from '../../pages/components/app-header.component';
import type { DashboardTab } from '../../pages/dashboard/dashboard.page';
import type { Page } from '@playwright/test';

// Read-only: these tests open pages and menus but never change settings, language or data.

async function expectLandedOn(page: Page, path: string, heading: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
}

test.describe('Dashboard', () => {
  test('opens on the Home tab', async ({ dashboardPage }) => {
    await dashboardPage.open();

    await dashboardPage.expectTabShown('Home');
  });

  // Compared with the response the page itself loaded, so a campaign spending balance in
  // a parallel test can't make the numbers differ.
  test('shows the currency balance the API returned', async ({ page, dashboardPage, appHeader }) => {
    const currencyResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/v1/users/user-currency',
    );
    await dashboardPage.open();

    const currency = (await (await currencyResponse).json()) as { currency_unit: string; available_balance: number };
    await appHeader.expectCurrencyBalance(currency.currency_unit, currency.available_balance);
  });

  for (const tab of ['SMS', 'Email', 'Activity Stream', 'Home'] as DashboardTab[]) {
    test(`switches to the ${tab} tab`, async ({ dashboardPage }) => {
      await dashboardPage.open(tab === 'Home' ? 'SMS' : 'Home');
      await dashboardPage.openTab(tab);

      await dashboardPage.expectTabShown(tab);
    });

    test(`opens the ${tab} tab from its URL`, async ({ dashboardPage }) => {
      await dashboardPage.open(tab);

      await dashboardPage.expectTabShown(tab);
    });
  }

  test('pages through the product carousel and back', async ({ dashboardPage }) => {
    const carousel = dashboardPage.productCarousel;
    await dashboardPage.open();
    await carousel.expectAtStart();

    const forward = await carousel.scrollToEnd();
    await carousel.expectAtEnd();
    expect(forward).toBeGreaterThan(0);

    const back = await carousel.scrollToStart();
    await carousel.expectAtStart();
    expect(back).toBe(forward);
  });

  test('links product slides to sales by email and resources to new tabs', async ({ dashboardPage }) => {
    await dashboardPage.open();

    const salesLinks = await dashboardPage.productCarousel.linkHrefs('Connect with Sales');
    expect(salesLinks.length).toBeGreaterThan(0);
    for (const href of salesLinks) {
      expect(href).toMatch(/^mailto:\S+@\S+/);
    }

    const resourceTargets = await dashboardPage.resourcesCarousel.linkTargets('Know More');
    expect(resourceTargets.length).toBeGreaterThan(0);
    expect(resourceTargets.every((target) => target === '_blank')).toBe(true);
  });
});

test.describe('Header', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.open();
  });

  test('profile menu shows the user, Settings and Logout', async ({ appHeader }) => {
    await appHeader.openProfileMenu();

    await appHeader.expectProfileMenuContents();
  });

  test('language menu lists the available languages', async ({ appHeader }) => {
    await appHeader.expectLanguageOptions();
  });

  test('logo returns to the dashboard from another page', async ({ page, sideNav, appHeader, dashboardPage }) => {
    await sideNav.open('Contacts', 'Lists');
    await expectLandedOn(page, '/contacts/lists', 'Lists');

    await appHeader.clickLogo();

    await dashboardPage.expectTabShown('Home');
  });

  for (const [item, path] of [
    ['Account Details', '/user/settings/account-details'],
    ['Currency Alert', '/user/settings/currency-credit/currency-alert'],
    ['Currency History', '/user/settings/currency-credit/credit-history'],
    ['Password', '/user/settings/password'],
  ] as [SettingsItem, string][]) {
    test(`Settings > ${item} opens its page`, async ({ page, appHeader }) => {
      await appHeader.openSettings(item);

      await expectLandedOn(page, path, item);
    });
  }
});

test.describe('Side navigation', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.open();
  });

  // Reports > SMS/Email, Developers > Documentation and Users > Accounts Summary are left out:
  // on staging they don't navigate anywhere, so there is no page to check.
  for (const [section, entry, path, heading] of [
    ['SMS', 'Campaigns', '/campaigns/sms', 'SMS Campaigns'],
    ['SMS', 'Sender IDs', '/content-management/sms/sender-ids', 'Sender IDs'],
    ['SMS', 'Templates', '/content-management/sms/templates', 'SMS Templates'],
    ['Email', 'Campaigns', '/campaigns/email', 'Email Campaigns'],
    ['Email', 'Templates', '/content-management/email/templates', 'Email Templates'],
    ['Email', 'Domains', '/domain/email', 'Domains'],
    ['Contacts', 'Lists', '/contacts/lists', 'Lists'],
    ['Download', 'Manual', '/download-center/manual', 'Manual'],
    ['Download', 'Auto Generated - Panel', '/download-center/auto-generated-panel', 'Auto Generated - Panel'],
    ['Download', 'Auto Generated - API', '/download-center/auto-generated-api', 'Auto Generated - API'],
    ['Developers', 'Authentication', '/developers/authentication', 'Authentication'],
    ['Users', 'Accounts', '/user-management/accounts', 'Accounts'],
  ]) {
    test(`${section} > ${entry} opens its page`, async ({ page, sideNav }) => {
      await sideNav.open(section, entry);

      await expectLandedOn(page, path, heading);
    });
  }

  // Known defect: one section shows its translation key ("menu.cdp") instead of a label.
  // This passes while the defect exists and fails once it's fixed: then remove test.fail.
  test('shows a translated label for every section', async ({ sideNav }) => {
    test.fail(true, 'Staging shows the raw key "menu.cdp" as a nav label.');

    const labels = await sideNav.sectionLabels();
    expect(labels.filter((label) => /^[a-z]+(\.[a-z_]+)+$/.test(label))).toEqual([]);
  });
});
