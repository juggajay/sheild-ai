/**
 * Test Data Generation Helpers
 * Creates realistic test data for stress testing
 */

import { TEST_DATA } from '../config.js';

// Random string generator
export function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Random email generator
export function randomEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}_${randomString(6)}@test.com`;
}

// Random phone generator (Australian format)
export function randomPhone() {
  const prefixes = ['0412', '0423', '0434', '0445', '0456', '0467', '0478', '0489'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${prefix}${number}`;
}

// Random ABN generator (valid checksum)
export function randomABN() {
  // Use sample ABNs for valid checksums
  return TEST_DATA.sampleABNs[Math.floor(Math.random() * TEST_DATA.sampleABNs.length)];
}

// Random state generator
export function randomState() {
  return TEST_DATA.states[Math.floor(Math.random() * TEST_DATA.states.length)];
}

// Random date generator
export function randomFutureDate(minDays = 30, maxDays = 365) {
  const days = Math.floor(Math.random() * (maxDays - minDays)) + minDays;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function randomPastDate(minDays = 30, maxDays = 365) {
  const days = Math.floor(Math.random() * (maxDays - minDays)) + minDays;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Random money amount
export function randomAmount(min = 100000, max = 20000000) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Generate a random project
 */
export function generateProject() {
  const projectTypes = ['Commercial', 'Residential', 'Civil', 'Fitout', 'Industrial'];
  const streets = ['Main St', 'High St', 'Park Ave', 'Ocean Blvd', 'King St', 'Queen St'];
  const suburbs = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Hobart'];

  const type = projectTypes[Math.floor(Math.random() * projectTypes.length)];
  const street = streets[Math.floor(Math.random() * streets.length)];
  const suburb = suburbs[Math.floor(Math.random() * suburbs.length)];
  const state = randomState();

  return {
    name: `${type} Project ${randomString(4).toUpperCase()}`,
    address: `${Math.floor(Math.random() * 999) + 1} ${street}, ${suburb}`,
    state: state,
    start_date: randomPastDate(30, 90),
    end_date: randomFutureDate(180, 730),
    estimated_value: randomAmount(500000, 50000000),
    status: 'active',
  };
}

/**
 * Generate a random subcontractor
 */
export function generateSubcontractor() {
  const trades = [
    'Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Concrete', 'Steel',
    'Roofing', 'Glazing', 'Painting', 'Flooring', 'Landscaping', 'Demolition',
  ];
  const suffixes = ['Pty Ltd', 'Services', 'Group', 'Industries', 'Solutions'];

  const trade = trades[Math.floor(Math.random() * trades.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

  return {
    abn: randomABN(),
    trading_name: `${trade} ${suffix} ${randomString(3).toUpperCase()}`,
    contact_name: `Test Contact ${randomString(4)}`,
    contact_email: randomEmail('subcontractor'),
    contact_phone: randomPhone(),
    workers_comp_state: randomState(),
    portal_access: Math.random() > 0.5,
  };
}

/**
 * Generate insurance requirements
 */
export function generateRequirements() {
  return {
    public_liability: {
      required: true,
      minimum_coverage: randomAmount(5000000, 20000000),
      maximum_excess: randomAmount(1000, 10000),
      require_principal_indemnity: Math.random() > 0.3,
      require_cross_liability: Math.random() > 0.5,
    },
    professional_indemnity: {
      required: Math.random() > 0.3,
      minimum_coverage: randomAmount(1000000, 10000000),
      maximum_excess: randomAmount(5000, 25000),
    },
    workers_compensation: {
      required: true,
    },
    contract_works: {
      required: Math.random() > 0.5,
      minimum_coverage: randomAmount(1000000, 20000000),
    },
    motor_vehicle: {
      required: Math.random() > 0.7,
      minimum_coverage: randomAmount(10000000, 30000000),
    },
  };
}

/**
 * Generate a document/COC data
 */
export function generateDocument(subcontractorId, projectId) {
  const insuranceTypes = TEST_DATA.insuranceTypes;
  const type = insuranceTypes[Math.floor(Math.random() * insuranceTypes.length)];

  return {
    subcontractor_id: subcontractorId,
    project_id: projectId,
    document_type: type,
    file_name: `COC_${type}_${randomString(8)}.pdf`,
    status: 'pending',
    uploaded_at: new Date().toISOString(),
  };
}

/**
 * Generate exception data
 */
export function generateException(projectSubcontractorId) {
  const reasons = [
    'Coverage below minimum requirements',
    'Policy expired',
    'Missing principal indemnity clause',
    'Excess amount too high',
    'Wrong state for workers compensation',
  ];

  const riskLevels = ['low', 'medium', 'high'];

  return {
    project_subcontractor_id: projectSubcontractorId,
    issue_summary: reasons[Math.floor(Math.random() * reasons.length)],
    reason: `Detailed explanation for the exception: ${randomString(50)}`,
    risk_level: riskLevels[Math.floor(Math.random() * riskLevels.length)],
    expiration_type: 'fixed_duration',
    expiration_days: Math.floor(Math.random() * 30) + 7,
  };
}

/**
 * Generate communication data
 */
export function generateCommunication(subcontractorId, projectId) {
  const types = ['deficiency_notice', 'follow_up', 'expiration_reminder', 'critical_alert'];
  const type = types[Math.floor(Math.random() * types.length)];

  return {
    subcontractor_id: subcontractorId,
    project_id: projectId,
    type: type,
    subject: `${type.replace(/_/g, ' ').toUpperCase()} - Action Required`,
    body: `This is a test communication for stress testing. ${randomString(100)}`,
    send_immediately: true,
  };
}

/**
 * Generate bulk import data (CSV format)
 */
export function generateBulkImportCSV(count = 100) {
  let csv = 'abn,trading_name,contact_name,contact_email,contact_phone,workers_comp_state\n';

  for (let i = 0; i < count; i++) {
    const sub = generateSubcontractor();
    csv += `${sub.abn},${sub.trading_name},${sub.contact_name},${sub.contact_email},${sub.contact_phone},${sub.workers_comp_state}\n`;
  }

  return csv;
}

/**
 * Generate fake PDF content for upload testing
 * Returns a minimal valid PDF as binary data
 */
export function generateFakePDF() {
  // Minimal valid PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test COC Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF`;

  return pdfContent;
}

/**
 * Generate Stripe webhook event payload
 */
export function generateStripeWebhookEvent(eventType = 'checkout.session.completed') {
  const events = {
    'checkout.session.completed': {
      id: `evt_${randomString(24)}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_${randomString(24)}`,
          customer: `cus_${randomString(14)}`,
          subscription: `sub_${randomString(24)}`,
          mode: 'subscription',
          payment_status: 'paid',
          metadata: {
            company_id: '1',
          },
        },
      },
    },
    'customer.subscription.updated': {
      id: `evt_${randomString(24)}`,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: `sub_${randomString(24)}`,
          customer: `cus_${randomString(14)}`,
          status: 'active',
          items: {
            data: [{
              price: { id: `price_${randomString(24)}`, lookup_key: 'professional' },
            }],
          },
        },
      },
    },
    'invoice.paid': {
      id: `evt_${randomString(24)}`,
      type: 'invoice.paid',
      data: {
        object: {
          id: `in_${randomString(24)}`,
          customer: `cus_${randomString(14)}`,
          subscription: `sub_${randomString(24)}`,
          amount_paid: 9900,
          status: 'paid',
        },
      },
    },
  };

  return events[eventType] || events['checkout.session.completed'];
}

/**
 * Generate SendGrid webhook event payload
 */
export function generateSendGridWebhookEvent(eventType = 'delivered') {
  return [{
    email: randomEmail('recipient'),
    timestamp: Math.floor(Date.now() / 1000),
    event: eventType,
    sg_message_id: `${randomString(22)}.${randomString(10)}`,
    'smtp-id': `<${randomString(20)}@sendgrid.com>`,
  }];
}
