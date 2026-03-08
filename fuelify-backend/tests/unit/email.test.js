// fuelify-backend/tests/unit/email.test.js
process.env.NODE_ENV = 'test';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

const nodemailer = require('nodemailer');

describe('email service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  test('skips email when SMTP config is placeholder or missing', async () => {
    const { sendWelcomeEmail } = require('../../src/services/email');
    await expect(
      sendWelcomeEmail('user@test.com', 'Test User', 'Test Station')
    ).resolves.not.toThrow();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test('sends email when SMTP config is valid', async () => {
    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@test.local';
    process.env.SMTP_PASS = 'testpass';

    const { sendWelcomeEmail } = require('../../src/services/email');
    await expect(
      sendWelcomeEmail('owner@test.com', 'New Owner', 'Test Station')
    ).resolves.not.toThrow();
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
  });

  test('skips email when SMTP values are placeholders', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'your@gmail.com';
    process.env.SMTP_PASS = 'your_app_password';

    const { sendWelcomeEmail } = require('../../src/services/email');
    await expect(sendWelcomeEmail('owner@test.com', 'Owner', 'Station')).resolves.toEqual({
      sent: false,
      reason: 'SMTP_NOT_CONFIGURED',
    });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});
