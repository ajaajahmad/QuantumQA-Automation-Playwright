import { expect, test } from '../../fixtures/test-fixtures';
import { pushApps } from '../../utils/app-push';
import { blockWrites } from '../../utils/write-guard';

// Read-only. An integration needs a real FCM private key, so nothing is configured; the create
// form is only read and tried empty, with every write aborted.

test.describe('App Push Configurations', () => {
  test('opens from the side nav', async ({ page, sideNav }) => {
    await page.goto('/dashboard/home', { waitUntil: 'domcontentloaded' });

    await sideNav.open('APP Push', 'Configurations');

    await expect(page).toHaveURL(/\/integration\/app-push\/listing$/);
  });

  test('lists the integrations the API returned', async ({ pushConfigurationsPage }) => {
    const list = await pushConfigurationsPage.open();

    await pushConfigurationsPage.expectColumns([
      'APP Name',
      'Service Provider',
      'Certificates',
      'Status',
      'Created By',
      'Updated By',
      'Action',
    ]);
    await pushConfigurationsPage.expectRowsOf(list);
  });

  // The create page's App Name list comes from another endpoint; it must offer the same apps,
  // active ones only.
  test('offers the active integrations to campaigns', async ({ api, pushConfigurationsPage }) => {
    const list = await pushConfigurationsPage.open();

    const apps = await pushApps(api);

    expect(apps.map((app) => app.app_name).sort()).toEqual(
      list.docs.filter((configuration) => configuration.is_active).map((configuration) => configuration.app_name).sort(),
    );
  });

  test('offers View, Copy, Edit and Mark As Default on an integration', async ({ pushConfigurationsPage }) => {
    const list = await pushConfigurationsPage.open();
    test.skip(list.docs.length === 0, 'The account has no App Push integration.');

    expect(await pushConfigurationsPage.actions(list.docs[0].app_name)).toEqual([
      'View',
      'Copy',
      'Edit',
      'Mark As Default',
    ]);
  });

  test('shows an empty create form with FCM as the only provider', async ({
    pushConfigurationsPage,
    createPushIntegrationPage,
  }) => {
    await pushConfigurationsPage.open();

    await pushConfigurationsPage.openCreate();

    await createPushIntegrationPage.expectForm();
    expect(await createPushIntegrationPage.serviceProviders()).toEqual(['Select', 'FCM']);
  });

  test('refuses to configure an empty integration', async ({ page, pushConfigurationsPage, createPushIntegrationPage }) => {
    const blocked = await blockWrites(page);
    await pushConfigurationsPage.open();
    await pushConfigurationsPage.openCreate();

    await createPushIntegrationPage.configure();

    // The certificates are not named, though a key is needed to push.
    await createPushIntegrationPage.expectFieldErrors(['App Name is required', 'Project Id is required']);
    expect(blocked).toEqual([]);
  });

  test('returns to the list on Cancel', async ({ pushConfigurationsPage, createPushIntegrationPage }) => {
    await pushConfigurationsPage.open();
    await pushConfigurationsPage.openCreate();

    await createPushIntegrationPage.cancel();
  });
});
