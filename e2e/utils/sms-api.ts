import type { APIRequestContext } from '@playwright/test';

// API calls the SMS tests use to find and clean up the records they create. The UI is what
// the tests check; these only make sure nothing is left behind.

export type SmsSender = { id: string; sender: string };
export type SmsTemplate = { id: string; name: string };

const pageSize = 100;

async function listAll<T>(api: APIRequestContext, path: string): Promise<T[]> {
  const response = await api.get(`${path}?page=1&limit=${pageSize}`);

  if (!response.ok()) {
    throw new Error(`GET ${path} failed with ${response.status()}`);
  }

  const body = await response.json();
  return (body.data ?? body).docs as T[];
}

export function listSmsSenders(api: APIRequestContext): Promise<SmsSender[]> {
  return listAll<SmsSender>(api, '/api/v1/sms-senders');
}

export function listSmsTemplates(api: APIRequestContext): Promise<SmsTemplate[]> {
  return listAll<SmsTemplate>(api, '/api/v1/sms-templates');
}

export async function deleteSmsSender(api: APIRequestContext, id: string): Promise<void> {
  await api.delete(`/api/v1/sms-senders/${id}`);
}

export async function deleteSmsTemplate(api: APIRequestContext, id: string): Promise<void> {
  await api.delete(`/api/v1/sms-templates/${id}`);
}
