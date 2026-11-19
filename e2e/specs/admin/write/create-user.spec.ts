import { expect, test } from '../../../fixtures/admin-fixtures';
import { newUser, smppFor } from './test-users';

// Writes: each creating test leaves one permanent user per run under the Compiled Test
// organization, because deleting users is outside what these specs may do. Opt-in only:
// npm run test:admin-write.

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
