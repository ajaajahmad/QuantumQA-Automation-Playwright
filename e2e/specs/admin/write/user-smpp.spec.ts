import { expect, test } from '../../../fixtures/admin-fixtures';
import type { SaveResult, SmppField, SmppSettings } from '../../../pages/admin/components/user-form.component';
import type { EditUserPage } from '../../../pages/admin/users/edit-user.page';
import type { UsersPage } from '../../../pages/admin/users/users.page';
import { getAdminList, getUserSmpp, putUser, type UserSmppRecord } from '../../../utils/admin-api';
import { newUser, smppFor } from './test-users';

// The SMPP Configuration cases of the INF-14706 test plan (ADM-03 to ADM-13), titled with the
// plan's IDs. Writes: creates one SMPP user per run and edits only that user, putting its SMPP
// settings back after each test. Other people use the older qa_auto_ SMPP users (their values
// changed after the specs made them), so they are only ever read. Opt-in only:
// npm run test:admin-write. What these can't check (binds, the SMPP service, emails) is outside
// a browser suite.

test.describe.configure({ mode: 'serial' });

const sessionFields: SmppField[] = ['maxTransmitterSessions', 'maxReceiverSessions', 'maxTransceiverSessions'];

const storedName: Record<SmppField, keyof UserSmppRecord> = {
  username: 'smpp_username',
  shortcode: 'smpp_shortcode',
  allowedIps: 'smpp_allowed_ip',
  maxTransmitterSessions: 'smpp_max_transmitter_session',
  maxReceiverSessions: 'smpp_max_receiver_session',
  maxTransceiverSessions: 'smpp_max_transreceiver_session',
};

let username = '';
let userId = 0;
let valid: SmppSettings;

function asStored(smpp: SmppSettings): UserSmppRecord {
  return {
    is_smpp_enabled: 1,
    ...(Object.fromEntries(
      (Object.keys(storedName) as SmppField[]).map((field) => [storedName[field], smpp[field]]),
    ) as Omit<UserSmppRecord, 'is_smpp_enabled'>),
  };
}

// A fresh load of the edit route lands on Organizations, so the user is opened from the list.
async function openUser(usersPage: UsersPage, editUserPage: EditUserPage): Promise<void> {
  await usersPage.open();
  await usersPage.search(username);
  await usersPage.openEdit(username);
  await editUserPage.expectOpened(username);
}

// Saves the page and clears whichever dialog the answer brings up.
async function update(editUserPage: EditUserPage): Promise<SaveResult> {
  const result = await editUserPage.update();

  if (result.success) {
    await editUserPage.expectUpdated();
  } else {
    await editUserPage.dismissResult();
  }

  return result;
}

// Puts one field to a value, saves, then puts the field back to its valid value in the form, so
// each save carries only one bad value. A save that goes through returns to the Users list, so
// the user is opened again. Returns what the server said.
async function trySave(
  usersPage: UsersPage,
  editUserPage: EditUserPage,
  field: SmppField,
  value: string,
): Promise<SaveResult> {
  await editUserPage.form.enterSmppField(field, value);
  const result = await update(editUserPage);

  if (result.success) {
    await openUser(usersPage, editUserPage);
  }

  await editUserPage.form.enterSmppField(field, String(valid[field]));
  return result;
}

function observe(description: string): void {
  test.info().annotations.push({ type: 'observed', description });
}

test.describe('SMPP Configuration on Create User and the edit page', () => {
  // Puts the user's SMPP settings back whenever a test left them changed, so each test starts from
  // the values ADM-03 saved.
  test.afterEach(async ({ adminApi, usersPage, editUserPage }) => {
    if (!userId) return;

    const stored = await getUserSmpp(adminApi, userId);
    if (JSON.stringify(stored) === JSON.stringify(asStored(valid))) return;

    await openUser(usersPage, editUserPage);
    await editUserPage.form.enterSmpp(valid);
    const restored = await update(editUserPage);
    expect(restored, `restoring the SMPP settings, server answered: ${restored.message}`).toMatchObject({
      success: true,
    });
    expect(await getUserSmpp(adminApi, userId)).toEqual(asStored(valid));
  });

  test('ADM-03 saves a new SMPP user and keeps the values after a reload', async ({
    adminApi,
    createUserPage,
    usersPage,
    editUserPage,
  }) => {
    const base = newUser();
    valid = smppFor(base);
    await createUserPage.open();
    await createUserPage.enterDetails({ ...base, smpp: valid });

    const created = await createUserPage.save();
    expect(created, `server answered: ${created.message}`).toMatchObject({ success: true });
    userId = await createUserPage.expectSavedAndOpened({ ...base, smpp: valid });
    username = base.username;

    await openUser(usersPage, editUserPage);
    await editUserPage.form.expectSmpp(valid);
    expect(await getUserSmpp(adminApi, userId)).toEqual(asStored(valid));
  });

  test('ADM-04 accepts 1 and 30 in each session limit', async ({ adminApi, usersPage, editUserPage }) => {
    for (const limit of [1, 30]) {
      const atLimit = { ...valid, maxTransmitterSessions: limit, maxReceiverSessions: limit, maxTransceiverSessions: limit };
      await openUser(usersPage, editUserPage);
      await editUserPage.form.enterSmpp(atLimit);

      const saved = await update(editUserPage);
      expect(saved, `limit ${limit}, server answered: ${saved.message}`).toMatchObject({ success: true });
      await openUser(usersPage, editUserPage);
      await editUserPage.form.expectSmpp(atLimit);
      expect(await getUserSmpp(adminApi, userId)).toEqual(asStored(atLimit));
    }
  });

  test('ADM-05 refuses session limits of 0, 31 and -1', async ({ adminApi, usersPage, editUserPage }) => {
    test.setTimeout(240_000);
    await openUser(usersPage, editUserPage);

    for (const field of sessionFields) {
      for (const value of ['0', '31', '-1']) {
        const result = await trySave(usersPage, editUserPage, field, value);
        expect.soft(result.success, `${field} = ${value}, server answered: ${result.message}`).toBe(false);
      }
    }

    expect(await getUserSmpp(adminApi, userId), 'what is stored after the refused saves').toEqual(asStored(valid));
  });

  // Known defect: the server saves 2.5 in each session limit, though it refuses 0, 31 and -1. This
  // passes while the defect exists and fails once it's fixed: then remove test.fail.
  test('ADM-06 refuses a decimal session limit', async ({ adminApi, usersPage, editUserPage }) => {
    test.fail(true, 'Staging saves 2.5 as a session limit.');
    test.setTimeout(180_000);
    await openUser(usersPage, editUserPage);

    for (const field of sessionFields) {
      const result = await trySave(usersPage, editUserPage, field, '2.5');
      observe(`${field} 2.5: ${result.success ? 'saved' : 'refused'}, stored ${
        (await getUserSmpp(adminApi, userId))[storedName[field]]
      }`);
      expect.soft(result.success, `${field} = 2.5, server answered: ${result.message}`).toBe(false);
    }
  });

  test('ADM-06 refuses non-numeric session limits', async ({ adminApi, usersPage, editUserPage }) => {
    await openUser(usersPage, editUserPage);

    // A number input can't hold "abc" or spaces, so those go to the API in the form Update sends.
    // "05" reaches the server as the number 5, so the page can only save it as 5.
    const form = await editUserPage.captureUpdate();
    for (const field of sessionFields) {
      for (const value of ['abc', ' ']) {
        const { body } = await putUser(adminApi, userId, { ...form, [storedName[field]]: value });
        expect.soft(body.success, `${field} = ${JSON.stringify(value)} by API, server answered: ${body.message}`).not.toBe(true);
      }
    }

    await openUser(usersPage, editUserPage);
    const leadingZero = await trySave(usersPage, editUserPage, 'maxTransmitterSessions', '05');
    observe(`Max Transmitter Sessions "05": ${leadingZero.success ? 'saved' : `refused (${leadingZero.message})`}, stored ${
      (await getUserSmpp(adminApi, userId)).smpp_max_transmitter_session
    }`);
  });

  test('ADM-07 refuses a blank session limit', async ({ adminApi, usersPage, editUserPage }) => {
    test.setTimeout(180_000);
    await openUser(usersPage, editUserPage);

    for (const field of sessionFields) {
      const result = await trySave(usersPage, editUserPage, field, '');
      expect.soft(result.success, `${field} blank, server answered: ${result.message}`).toBe(false);
    }

    expect(await getUserSmpp(adminApi, userId), 'what is stored after the refused saves').toEqual(asStored(valid));
  });

  test('ADM-08 the server refuses a session limit of 31 sent straight to the API', async ({
    adminApi,
    usersPage,
    editUserPage,
  }) => {
    await openUser(usersPage, editUserPage);
    const form = await editUserPage.captureUpdate();

    for (const field of sessionFields) {
      const { status, body } = await putUser(adminApi, userId, { ...form, [storedName[field]]: 31 });
      expect.soft(body.success, `${field} = 31 by API, HTTP ${status}: ${body.message}`).not.toBe(true);
    }

    expect(await getUserSmpp(adminApi, userId), 'what is stored after the refused saves').toEqual(asStored(valid));
  });

  // Blank is allowed: the schema marks the field optional and its placeholder says blank means any
  // IP. The plan lists blank as invalid; that row is wrong.
  test('ADM-09 refuses malformed Allowed IPs and accepts a blank one', async ({ adminApi, usersPage, editUserPage }) => {
    test.setTimeout(180_000);
    await openUser(usersPage, editUserPage);

    for (const value of ['999.1.1.1', 'abc', '192.0.2.10,']) {
      const result = await trySave(usersPage, editUserPage, 'allowedIps', value);
      expect.soft(result.success, `Allowed IPs ${JSON.stringify(value)}, server answered: ${result.message}`).toBe(false);
    }

    await openUser(usersPage, editUserPage);
    await editUserPage.form.enterSmppField('allowedIps', '');
    const blank = await update(editUserPage);
    expect(blank, `blank Allowed IPs, server answered: ${blank.message}`).toMatchObject({ success: true });
    expect((await getUserSmpp(adminApi, userId)).smpp_allowed_ip).toBe('');
  });

  // The placeholder documents comma-separated IPs and wildcards ("10.0.0.5,192.168.1.*"), so those
  // must save. CIDR and IPv6 aren't specified (open question 8): only recorded.
  test('ADM-10 takes several IPs and wildcards, and records CIDR and IPv6', async ({
    adminApi,
    usersPage,
    editUserPage,
  }) => {
    test.setTimeout(180_000);

    for (const value of ['192.0.2.10,192.0.2.11', '192.0.2.*']) {
      await openUser(usersPage, editUserPage);
      await editUserPage.form.enterSmppField('allowedIps', value);
      const result = await update(editUserPage);
      expect.soft(result.success, `Allowed IPs ${value}, server answered: ${result.message}`).toBe(true);
      expect.soft((await getUserSmpp(adminApi, userId)).smpp_allowed_ip).toBe(value);
    }

    for (const value of ['192.0.2.0/24', '2001:db8::1']) {
      await openUser(usersPage, editUserPage);
      await editUserPage.form.enterSmppField('allowedIps', value);
      const result = await update(editUserPage);
      observe(`Allowed IPs ${value}: ${result.success ? 'saved' : `refused (${result.message})`}, stored ${JSON.stringify(
        (await getUserSmpp(adminApi, userId)).smpp_allowed_ip,
      )}`);
    }
  });

  // The rules beyond "required, up to 20 characters" aren't specified (open question 9), so only a
  // blank one is asserted. The duplicate reuses another SMPP user's Short Code, read without changing it.
  test('ADM-11 refuses a blank Short Code and records special characters and a duplicate', async ({
    adminApi,
    usersPage,
    editUserPage,
  }) => {
    test.setTimeout(240_000);
    await openUser(usersPage, editUserPage);

    const blank = await trySave(usersPage, editUserPage, 'shortcode', '');
    expect.soft(blank.success, `blank Short Code, server answered: ${blank.message}`).toBe(false);

    const special = await trySave(usersPage, editUserPage, 'shortcode', 'ab#$% 5');
    observe(`Short Code "ab#$% 5": ${special.success ? 'saved' : `refused (${special.message})`}`);

    const other = await anotherSmppUser(adminApi);
    if (!other) {
      observe('No other SMPP user found, so the duplicate cases did not run');
      return;
    }

    await openUser(usersPage, editUserPage);
    const sameShortcode = await trySave(usersPage, editUserPage, 'shortcode', other.smpp_shortcode!);
    observe(`Short Code already held by another user: ${sameShortcode.success ? 'saved' : `refused (${sameShortcode.message})`}`);

    // A duplicate SMPP Username could only be tried on Create User, which would leave one more user.
    await openUser(usersPage, editUserPage);
    await editUserPage.form.openSection('SMPP Configuration');
    await editUserPage.form.expectEditable('smpp_username', false);
    observe('SMPP Username is read-only on the edit page, so a duplicate one was not tried');
  });

  // What happens to binds already open when a limit drops isn't something a browser can see
  // (open question 6); this checks the panel side only.
  test('ADM-12 saves a lowered session limit', async ({ adminApi, usersPage, editUserPage }) => {
    for (const limit of [10, 3]) {
      await openUser(usersPage, editUserPage);
      await editUserPage.form.enterSmppField('maxTransmitterSessions', String(limit));
      const saved = await update(editUserPage);
      expect(saved, `Max Transmitter Sessions ${limit}, server answered: ${saved.message}`).toMatchObject({ success: true });
    }

    await openUser(usersPage, editUserPage);
    await editUserPage.form.expectSmpp({ ...valid, maxTransmitterSessions: 3 });
    expect((await getUserSmpp(adminApi, userId)).smpp_max_transmitter_session).toBe(3);
  });

  // The plan leaves this open (question 7); the server answers it: SMPP can't be switched off once
  // a user has it, and the settings stay as they were.
  test('ADM-13 refuses to untick Enable SMPP on an SMPP user', async ({ adminApi, usersPage, editUserPage }) => {
    await openUser(usersPage, editUserPage);
    await editUserPage.form.untickEnableSmpp();
    const saved = await update(editUserPage);

    expect(saved.success, `server answered: ${saved.message}`).toBe(false);
    expect(saved.message).toContain('SMPP cannot be disabled once the user is onboarded on SMPP');
    expect(await getUserSmpp(adminApi, userId)).toEqual(asStored(valid));
  });
});

// Another user's SMPP settings, from the qa_auto_ users other people now use; only read.
async function anotherSmppUser(api: Parameters<typeof getUserSmpp>[0]): Promise<UserSmppRecord | undefined> {
  const { data } = await getAdminList<{ id: number }>(api, 'users', { queryterm: 'qa_auto_' });

  for (const { id } of data.items) {
    if (id === userId) continue;
    const smpp = await getUserSmpp(api, id);
    if (smpp.is_smpp_enabled && smpp.smpp_shortcode && smpp.smpp_username) return smpp;
  }

  return undefined;
}
