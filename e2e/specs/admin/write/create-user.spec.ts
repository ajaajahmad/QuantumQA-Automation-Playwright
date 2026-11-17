import { expect, test } from '../../../fixtures/admin-fixtures';
import type { SmppSettings } from '../../../pages/admin/components/user-form.component';
import type { NewAdminUser } from '../../../pages/admin/users/create-user.page';

// Writes: each creating test leaves one permanent user per run under the Compiled Test
// organization, because deleting users is outside what these specs may do. Opt-in only:
// npm run test:admin-write.

function newUser(): NewAdminUser {
  const stamp = Date.now().toString();

  return {
    organization: 'Compiled Test',
    companyName: 'QA Automation',
    fullName: 'QA Automation User',
    username: `qa_auto_${stamp}`,
    email: `qa_auto_${stamp}@example.com`,
    mobile: `9${stamp.slice(-9)}`,
    dltEntityId: `1${stamp}${stamp.slice(-5)}`.slice(0, 19),
    currencyUnit: 'INR',
    amount: '1',
    timeZone: 'Asia/Kolkata',
    country: 'India',
    expiresInYear: new Date().getFullYear() + 1,
  };
}

// Named after the user's timestamp. The allowed IP is a documentation-only address (RFC 5737), so
// nothing real can bind with the account; a blank one would accept any IP. The session counts
// differ from the defaults (1 each) so a saved value can't pass by accident.
function smppFor(user: NewAdminUser): SmppSettings {
  const stamp = user.username.slice(-13);

  return {
    username: `qa${stamp}`,
    shortcode: `5${stamp.slice(-7)}`,
    allowedIps: '192.0.2.10',
    maxTransmitterSessions: 3,
    maxReceiverSessions: 2,
    maxTransceiverSessions: 1,
  };
}

test.describe('Create User', () => {
  test('Cancel leaves the form without saving', async ({ page, createUserPage }) => {
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') posts.push(new URL(request.url()).pathname);
    });

    await createUserPage.open();
    await createUserPage.enterDetails(newUser());
    await createUserPage.cancel();

    await expect(page).toHaveURL(/#\/organizations\/user$/);
    expect(posts.filter((path) => path.endsWith('/api/v1/users'))).toEqual([]);
  });

  test('creates a user, then refuses the same username again', async ({ createUserPage }) => {
    const user = newUser();
    await createUserPage.open();
    await createUserPage.enterDetails(user);

    const created = await createUserPage.save();
    expect(created, `server answered: ${created.message}`).toMatchObject({ success: true });
    await createUserPage.expectSavedAndOpened(user);

    await createUserPage.open();
    await createUserPage.enterDetails({ ...user, email: `dup_${user.email}` });

    const duplicate = await createUserPage.save();
    expect(duplicate.success, `server answered: ${duplicate.message}`).toBe(false);
  });

  test('SMPP Username and Shortcode stop at 15 and 20 characters', async ({ createUserPage }) => {
    const smpp = smppFor(newUser());
    await createUserPage.open();

    await createUserPage.form.enterSmpp({ ...smpp, username: 'u'.repeat(20), shortcode: '5'.repeat(25) });

    await createUserPage.form.expectSmpp({ ...smpp, username: 'u'.repeat(15), shortcode: '5'.repeat(20) });
  });

  test('creates a user with SMPP enabled', async ({ createUserPage }) => {
    const base = newUser();
    const user = { ...base, smpp: smppFor(base) };
    await createUserPage.open();
    await createUserPage.enterDetails(user);

    const created = await createUserPage.save();
    expect(created, `server answered: ${created.message}`).toMatchObject({ success: true });
    await createUserPage.expectSavedAndOpened(user);
  });
});
