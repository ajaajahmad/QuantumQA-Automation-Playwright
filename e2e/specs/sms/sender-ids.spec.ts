import { expect, test } from '../../fixtures/test-fixtures';

// Read-only: nothing here saves a sender ID. Invalid-format checks are left out because the app
// only validates the format on Save, and a Save that slipped through would create a real one.

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

  test('cancel returns to the sender ID list', async ({ page, senderIdsPage, createSenderIdPage }) => {
    await senderIdsPage.open();
    await senderIdsPage.openCreateSenderId();
    await createSenderIdPage.expectDisplayed();

    await createSenderIdPage.cancel();

    await senderIdsPage.expectDisplayed();
    await expect(page).toHaveURL(/\/content-management\/sms\/sender-ids$/);
  });
});
