import type { SmppSettings } from '../../../pages/admin/components/user-form.component';
import type { NewAdminUser } from '../../../pages/admin/users/create-user.page';

// The users the write specs create, all under the Compiled Test organization and named
// qa_auto_<timestamp>, so the update specs can tell them from everyone else's.
export function newUser(): NewAdminUser {
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
export function smppFor(user: NewAdminUser): SmppSettings {
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
