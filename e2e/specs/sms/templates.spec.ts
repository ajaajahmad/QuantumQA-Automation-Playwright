import { expect, test } from '../../fixtures/test-fixtures';
import type { TemplateDetails } from '../../pages/sms/create-template.page';
import { randomDigits, uniqueSuffix } from '../../utils/random';
import { deleteSmsTemplate, listSmsSenders, listSmsTemplates } from '../../utils/sms-api';

// The list and form-validation tests are read-only. The lifecycle tests create real templates
// on the automation-only staging account and delete everything they created afterwards.

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

test.describe('SMS Template lifecycle', () => {
  let templateIdsBefore: Set<string>;
  let template: TemplateDetails;

  // Remember what existed, so cleanup removes everything a test created, even a template
  // that a refusal test failed to stop.
  test.beforeEach(async ({ api }) => {
    templateIdsBefore = new Set((await listSmsTemplates(api)).map((existing) => existing.id));

    // An existing sender, not one the sender ID tests create and delete in parallel.
    const sender = (await listSmsSenders(api)).find((candidate) => !candidate.sender.startsWith('QAT'));
    test.skip(!sender, 'The account needs a sender ID to create templates.');

    template = {
      name: `qa_auto_${uniqueSuffix().toLowerCase()}`,
      dltTemplateId: randomDigits(19),
      senderId: sender!.sender,
      contentType: 'Transactional',
      content: 'QA automation template, please ignore.',
    };
  });

  test.afterEach(async ({ api }) => {
    for (const created of (await listSmsTemplates(api)).filter((current) => !templateIdsBefore.has(current.id))) {
      await deleteSmsTemplate(api, created.id);
    }
  });

  test('creates a template that is listed as approved', async ({ templatesPage, createTemplatePage }) => {
    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.enterDetails(template);

    const result = await createTemplatePage.saveTemplate();

    expect(result).toEqual({ success: true, message: `Template ID - ${template.dltTemplateId} created for 1 Sender ID(s)` });
    await templatesPage.open();
    await templatesPage.listing.expectRow(template.name, [
      template.dltTemplateId,
      template.content,
      template.contentType,
      'Approved',
      template.senderId,
    ]);
  });

  test('edits a template', async ({ templatesPage, createTemplatePage }) => {
    const editedContent = 'QA automation template, edited.';
    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.enterDetails(template);
    expect((await createTemplatePage.saveTemplate()).success).toBe(true);

    await templatesPage.open();
    await templatesPage.listing.openEdit(template.name);
    await createTemplatePage.expectName(template.name);
    await createTemplatePage.enterContent(editedContent);
    const result = await createTemplatePage.saveTemplate();

    expect(result).toEqual({ success: true, message: `Template ID - ${template.dltTemplateId} updated for 1 Sender ID(s)` });
    await templatesPage.open();
    await templatesPage.listing.expectRow(template.name, [editedContent]);
  });

  test('deletes a template after confirmation', async ({ templatesPage, createTemplatePage }) => {
    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.enterDetails(template);
    expect((await createTemplatePage.saveTemplate()).success).toBe(true);

    await templatesPage.open();
    await templatesPage.listing.delete(template.name);

    await templatesPage.expectNotification('Templates has been deleted');
    await templatesPage.listing.search(template.name);
    await templatesPage.listing.expectNoRecords();
  });

  test('refuses a duplicate template name', async ({ api, templatesPage, createTemplatePage }) => {
    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.enterDetails(template);
    expect((await createTemplatePage.saveTemplate()).success).toBe(true);

    await templatesPage.open();
    await templatesPage.openCreateTemplate();
    await createTemplatePage.enterDetails({ ...template, dltTemplateId: randomDigits(19) });
    const result = await createTemplatePage.saveTemplate();

    expect(result).toEqual({
      success: false,
      message: 'Template with the same name already exists. Please enter another name',
    });
    const named = (await listSmsTemplates(api)).filter((current) => current.name === template.name);
    expect(named).toHaveLength(1);
  });
});
