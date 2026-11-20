import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { AdminSideNav } from '../components/admin-side-nav.component';

// One User Onboarding list page: its side-nav entry, route, heading, the API that fills the table,
// and the table's columns.
export type OnboardingList = {
  entry: string;
  path: string;
  heading: string;
  api: string;
  columns: string[];
};

export type OnboardingListResponse = {
  items: unknown[];
  meta: { totalItems: number };
};

export const contractsList: OnboardingList = {
  entry: 'Contracts',
  path: '#/organizations/contract',
  heading: 'Contracts',
  api: '/api/v1/org-contracts',
  columns: ['Contract Description', 'Billing Type', 'Expires On', 'Created At', 'Actions'],
};

export const usersList: OnboardingList = {
  entry: 'Users',
  path: '#/organizations/user',
  heading: 'Users',
  api: '/api/v1/users',
  columns: ['Username', 'Client ID', 'Company Name', 'Email', 'Parent Username', 'Created At', 'Expired At', 'Actions'],
};

export const teammatesList: OnboardingList = {
  entry: 'Teammates',
  path: '#/organizations/teammate',
  heading: 'Teammates',
  api: '/api/v1/team-mates',
  columns: ['Teammate User', 'Parent Username', 'Email', 'Mobile Number', 'Created At', 'Actions'],
};

export const creditsList: OnboardingList = {
  entry: 'Credits',
  path: '#/organizations/credits-listing',
  heading: 'User Credits',
  api: '/api/v1/user-credits/latest',
  columns: [
    'Username',
    'Total Currency',
    'Available Balance',
    'Credit Mode',
    'Threshold Value',
    'Threshold Status',
    'Actions',
  ],
};

export const transactionHistoryList: OnboardingList = {
  entry: 'Transaction History',
  path: '#/organizations/transaction-history',
  heading: 'Transaction History',
  api: '/api/v1/user-credits/transaction-history',
  columns: [
    'SNo',
    'Transaction Date',
    'User Name',
    'Admin Username',
    'Status',
    'Transaction Type',
    'Previous Balance',
    'Amount',
    'Updated Balance',
    'Action By',
    'Actions',
  ],
};

export const ruleMatrixList: OnboardingList = {
  entry: 'Rule Matrix',
  path: '#/organizations/rule-matrix',
  heading: 'Rule Matrix',
  api: '/api/v1/rule-matrix',
  columns: [
    'Rule Id',
    'Rule Name',
    'Sms Trans Sender',
    'Sms Promo Sender',
    'Sms Trans Template',
    'Sms Promo Template',
    'Created At',
    'Actions',
  ],
};

export const reportSchedulerList: OnboardingList = {
  entry: 'Report Scheduler',
  path: '#/organizations/scheduler',
  heading: 'Report Scheduler',
  api: '/api/v1/stats-subscriptions',
  columns: ['Username', 'Time', 'Frequency', 'Panel', 'API', 'Email Ids', 'Actions'],
};

export const dailyThresholdList: OnboardingList = {
  entry: 'Daily Threshold',
  path: '#/organizations/daily-threshold/listing',
  heading: 'Daily Threshold',
  api: '/api/v1/daily-threshold',
  columns: [
    'Username',
    'SMS Panel',
    'SMS API',
    'WA Panel',
    'WA API',
    'Voice',
    'Email Panel',
    'Email API',
    'RCS Panel',
    'RCS API',
    'Actions',
  ],
};

export const sftpConfigurationsList: OnboardingList = {
  entry: 'SFTP Configurations',
  path: '#/organizations/sftp',
  heading: 'SFTP Configuration',
  api: '/api/v1/sftp-configurations',
  columns: [
    'Username',
    'Channel',
    'SFTP Upload Path',
    'Alert Email Ids',
    'Status',
    'Created By',
    'Updated By',
    'Created At',
    'Updated At',
    'Actions',
  ],
};

export const approvalList: OnboardingList = {
  entry: 'Approval',
  path: '#/organizations/approval',
  heading: 'Approval',
  api: '/api/v1/user-contact-update-requests/pending',
  columns: [
    'Username',
    'Company Name',
    'Email',
    'New Email',
    'Mobile',
    'New Mobile',
    'Requested By',
    'Requested At',
    'Actions',
  ],
};

export const userOnboardingLists: OnboardingList[] = [
  contractsList,
  usersList,
  teammatesList,
  creditsList,
  transactionHistoryList,
  ruleMatrixList,
  reportSchedulerList,
  dailyThresholdList,
  sftpConfigurationsList,
  approvalList,
];

// Read-only: only the list is read. The pages' create, edit and approve buttons are left out on purpose.
export class OnboardingListPage {
  readonly sideNav: AdminSideNav;

  private readonly page: Page;
  private readonly columnHeaders: Locator;
  private readonly rows: Locator;
  private readonly totalCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sideNav = new AdminSideNav(page);
    // Some admin pages also render a hidden copy of the table; only the visible one is the list.
    const table = page.locator('ngx-datatable').filter({ visible: true });
    this.columnHeaders = table.locator('datatable-header-cell');
    this.rows = table.locator('datatable-body-row');
    this.totalCount = table.locator('datatable-footer .page-count');
  }

  // Opens the list from the open side-nav group and returns what its API sent.
  async openFromSideNav(list: OnboardingList): Promise<OnboardingListResponse> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => isListResponse(candidate, list)),
      this.sideNav.openEntry(list.entry),
    ]);

    await expect(this.page).toHaveURL(new RegExp(`${escapeRegExp(list.path)}$`));
    await expect(this.page.getByRole('heading', { name: list.heading, exact: true, level: 1 })).toBeVisible();
    return ((await response.json()) as { data: OnboardingListResponse }).data;
  }

  async expectColumns(list: OnboardingList): Promise<void> {
    await expect(this.columnHeaders).toHaveText(list.columns);
  }

  // The footer formats the total with comma thousands separators, e.g. 1,027 total.
  async expectRowsOf(response: OnboardingListResponse): Promise<void> {
    await expect(this.rows).toHaveCount(response.items.length);
    await expect(this.totalCount).toHaveText(`${response.meta.totalItems.toLocaleString('en-US')} total`);
  }
}

function isListResponse(response: Response, list: OnboardingList): boolean {
  const url = new URL(response.url());
  return response.request().method() === 'GET' && url.pathname.endsWith(list.api);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
