import { test } from '../../../fixtures/admin-fixtures';

// What the admin account is allowed to see; a change in its permissions changes these lists.
const groups = [
  'Admin',
  'User Onboarding',
  'SMS Channel',
  'WhatsApp Channel',
  'RCS Channel',
  'Truecaller Channel',
  'Voice Channel',
  'Email Channel',
  'Operations',
  'Media',
  'User MIS',
  'App Push',
  'Connector Log',
  'Live Agent',
];

const userOnboardingEntries = [
  'Organizations',
  'Contracts',
  'Users',
  'Teammates',
  'Credits',
  'Transaction History',
  'Rule Matrix',
  'Report Scheduler',
  'Daily Threshold',
  'SFTP Configurations',
  'Approval',
];

test.describe('Admin side navigation', () => {
  test('shows every group, with User Onboarding open on Organizations', async ({ organizationsPage, adminSideNav }) => {
    await organizationsPage.open();

    await adminSideNav.expectGroups(groups);
    await adminSideNav.expectActiveGroup('User Onboarding');
    await adminSideNav.expectEntries(userOnboardingEntries);
  });

  test('opens Admin with Admin Users, Role Permissions and Sales Users', async ({ organizationsPage, adminSideNav }) => {
    await organizationsPage.open();

    await adminSideNav.openGroup('Admin');

    await adminSideNav.expectEntries(['Admin Users', 'Role Permissions', 'Sales Users']);
  });
});
