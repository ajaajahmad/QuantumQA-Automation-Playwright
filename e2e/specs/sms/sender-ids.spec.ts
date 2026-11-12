import { expect, test } from '../../fixtures/test-fixtures';
import type { SenderIdDetails } from '../../pages/sms/create-sender-id.page';
import { randomDigits, uniqueSuffix } from '../../utils/random';
import { deleteSmsSender, listSmsSenders } from '../../utils/sms-api';

// The list and form-validation tests are read-only. The lifecycle tests create real sender IDs
// on the automation-only staging account and delete everything they created afterwards.

const formatRule =
  'Minimum 3 and Maximum 17 characters are allowed in Sender ID. Special characters allowed are & _ - . (dot)';

test.describe('SMS Sender IDs', () => {
  test('lists the sender IDs the API returned', async ({ senderIdsPage }) => {
    const senders = await senderIdsPage.open();

    await senderIdsPage.listing.expectColumns(['Sender ID', 'DLT Header ID', 'DLT Entity ID', 'Created On', 'Action']);
    await senderIdsPage.listing.expectTotalRecords(senders.total);
    await senderIdsPage.listing.expectRowCount(Math.min(senders.total, 10));
  });

  test('finds a sender ID by name', async ({ senderIdsPage }) => {
    const [sender] = (await senderIdsPage.open()).docs;
    test.skip(!sender, 'The account has no sender IDs.');

    await senderIdsPage.listing.search(sender.sender);

    await senderIdsPage.listing.expectEveryRowToContain(sender.sender);
  });

  test('searches by partial name, ignoring case', async ({ senderIdsPage }) => {
    const [sender] = (await senderIdsPage.open()).docs;
    test.skip(!sender, 'The account has no sender IDs.');
    const partial = sender.sender.slice(0, 3).toLowerCase();

    await senderIdsPage.listing.search(partial);

    await senderIdsPage.listing.expectEveryRowToContain(partial);
  });

  test('shows no records for an unknown name and restores the list when cleared', async ({ senderIdsPage }) => {
    const senders = await senderIdsPage.open();

    await senderIdsPage.listing.search('zz_no_such_sender_qa');
    await senderIdsPage.listing.expectNoRecords();

    await senderIdsPage.listing.search('');
    await senderIdsPage.listing.expectRowCount(Math.min(senders.total, 10));
  });

  test('reloads the list when the page size changes', async ({ senderIdsPage }) => {
    const senders = await senderIdsPage.open();

    await senderIdsPage.listing.setPageSize(25);

    await senderIdsPage.listing.expectRowCount(Math.min(senders.total, 25));
  });

  test('refuses to save an empty sender ID', async ({ senderIdsPage, createSenderIdPage }) => {
    await senderIdsPage.open();
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.expectDisplayed();

    await createSenderIdPage.clickSave();

    await createSenderIdPage.expectSenderRequiredError();
    await createSenderIdPage.expectDisplayed();
  });

  // Lives here rather than in the templates spec: the sender ID lifecycle tests below create and
  // delete sender IDs, and tests in one file run in order, so the list can't change mid-check.
  test('template form offers the account sender IDs and every content type', async ({
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

  test('cancel returns to the sender ID list', async ({ page, senderIdsPage, createSenderIdPage }) => {
    await senderIdsPage.open();
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.expectDisplayed();

    await createSenderIdPage.cancel();

    await senderIdsPage.expectDisplayed();
    await expect(page).toHaveURL(/\/content-management\/sms\/sender-ids$/);
  });
});

test.describe('SMS Sender ID lifecycle', () => {
  let senderIdsBefore: Set<string>;
  let sender: SenderIdDetails;

  // Remember what existed, so cleanup removes everything a test created, even a sender ID
  // that a refusal test failed to stop. Names start with QAT so other specs can avoid them.
  test.beforeEach(async ({ api }) => {
    senderIdsBefore = new Set((await listSmsSenders(api)).map((existing) => existing.id));
    sender = { sender: `QAT${uniqueSuffix().slice(-8)}`, entityId: randomDigits(19), headerId: randomDigits(19) };
  });

  test.afterEach(async ({ api }) => {
    for (const created of (await listSmsSenders(api)).filter((current) => !senderIdsBefore.has(current.id))) {
      await deleteSmsSender(api, created.id);
    }
  });

  test('creates a sender ID that is listed with its DLT IDs', async ({ senderIdsPage, createSenderIdPage }) => {
    await senderIdsPage.open();
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.enterDetails(sender);
    await createSenderIdPage.clickSave();

    await senderIdsPage.expectNotification('Sender added Successfully');
    await senderIdsPage.listing.expectRow(sender.sender, [sender.headerId, sender.entityId]);
  });

  test('edits a sender ID', async ({ senderIdsPage, createSenderIdPage }) => {
    const newHeaderId = randomDigits(19);
    await senderIdsPage.open();
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.enterDetails(sender);
    await createSenderIdPage.clickSave();
    await senderIdsPage.expectNotification('Sender added Successfully');

    await senderIdsPage.listing.openEdit(sender.sender);
    await createSenderIdPage.expectDetails(sender);
    await createSenderIdPage.enterHeaderId(newHeaderId);
    await createSenderIdPage.clickSave();

    await senderIdsPage.expectNotification('Senders has been successfully updated');
    await senderIdsPage.listing.expectRow(sender.sender, [newHeaderId]);
  });

  test('deletes a sender ID after confirmation', async ({ senderIdsPage, createSenderIdPage }) => {
    await senderIdsPage.open();
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.enterDetails(sender);
    await createSenderIdPage.clickSave();
    await senderIdsPage.expectNotification('Sender added Successfully');

    await senderIdsPage.listing.delete(sender.sender);

    await senderIdsPage.expectNotification('Senders has been deleted');
    await senderIdsPage.listing.search(sender.sender);
    await senderIdsPage.listing.expectNoRecords();
  });

  test('refuses a sender ID that already exists', async ({ senderIdsPage, createSenderIdPage }) => {
    const [existing] = (await senderIdsPage.open()).docs;
    test.skip(!existing, 'The account has no sender IDs to duplicate.');
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.enterDetails({ ...sender, sender: existing.sender });
    await createSenderIdPage.clickSave();

    await createSenderIdPage.expectRefused('Sender already exists, please choose some other name');
  });

  for (const [label, name] of [
    ['shorter than 3 characters', 'QA'],
    ['longer than 17 characters', 'QATXXXXXXXXXXXXXXX'],
    ['with a character outside & _ - .', 'QAT#1'],
  ]) {
    test(`refuses a sender ID ${label}`, async ({ senderIdsPage, createSenderIdPage }) => {
      await senderIdsPage.open();
      await senderIdsPage.openCreateSenderId();
      await createSenderIdPage.enterDetails({ ...sender, sender: name });
      await createSenderIdPage.clickSave();

      await createSenderIdPage.expectRefused(formatRule);
    });
  }

  // Known defect: the app's own rule and message exclude spaces, but it saves the sender ID.
  // This passes while the defect exists and fails once it's fixed: then remove test.fail.
  test('refuses a sender ID with a space', async ({ senderIdsPage, createSenderIdPage }) => {
    test.fail(true, 'Staging saves sender IDs that contain a space.');
    await senderIdsPage.open();
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.enterDetails({ ...sender, sender: `QAT ${uniqueSuffix().slice(-4)}` });
    await createSenderIdPage.clickSave();

    await createSenderIdPage.expectRefused(formatRule);
  });
});
