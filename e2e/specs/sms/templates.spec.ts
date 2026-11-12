import { expect, test } from '../../fixtures/test-fixtures';

// Read-only: nothing here saves a template.

test.describe('SMS Templates', () => {
  test('lists the templates the API returned', async ({ templatesPage }) => {
    const templates = await templatesPage.open();

    await templatesPage.listing.expectColumns([
      'DLT Template ID',
      'Name',
      'Content',
      'Content Type',
      'Status',
      'DLT Sender ID',
      'Created On',
      'Action',
    ]);
    await templatesPage.listing.expectTotalRecords(templates.total);
    await templatesPage.listing.expectRowCount(Math.min(templates.total, 10));
  });

  test('finds a template by name', async ({ templatesPage }) => {
    const [template] = (await templatesPage.open()).docs;
    test.skip(!template, 'The account has no templates.');

    await templatesPage.listing.search(template.name);

    await templatesPage.listing.expectEveryRowToContain(template.name);
  });

  test('shows no records for an unknown name', async ({ templatesPage }) => {
    await templatesPage.open();

    await templatesPage.listing.search('zz_no_such_template_qa');

    await templatesPage.listing.expectNoRecords();
  });

  test('reloads the list when the page size changes', async ({ templatesPage }) => {
    const templates = await templatesPage.open();

    await templatesPage.listing.setPageSize(25);

    await templatesPage.listing.expectRowCount(Math.min(templates.total, 25));
  });

  test('offers the account sender IDs and every content type', async ({
    senderIdsPage,
    templatesPage,
    createTemplatePage,
  }) => {
    const senders = await senderIdsPage.open();
    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.expectDisplayed();

    await createTemplatePage.expectSenderIdOptions(senders.docs.map((sender) => sender.sender));
    await createTemplatePage.expectContentTypeOptions([
      'Transactional',
      'Promotional',
      'Service Implicit',
      'Service Explicit',
    ]);
  });

  test('refuses to save an empty template', async ({ templatesPage, createTemplatePage }) => {
    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.expectDisplayed();

    await createTemplatePage.clickSave();

    await createTemplatePage.expectRequiredFieldErrors();
    await createTemplatePage.expectDisplayed();
  });

  test('cancel returns to the template list', async ({ page, templatesPage, createTemplatePage }) => {
    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.expectDisplayed();

    await createTemplatePage.cancel();

    await templatesPage.expectDisplayed();
    await expect(page).toHaveURL(/\/content-management\/sms\/templates$/);
  });
});
