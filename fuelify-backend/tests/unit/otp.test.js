process.env.NODE_ENV = 'test';

const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_TEST' });
const mockTwilioFactory = jest.fn(() => ({ messages: { create: mockCreate } }));

jest.mock('twilio', () => mockTwilioFactory);

describe('otp service', () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envSnapshot };
    delete process.env.OTP_BYPASS_ENABLED;
    delete process.env.OTP_BYPASS_CODE;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  afterAll(() => {
    process.env = envSnapshot;
  });

  test('uses fixed bypass OTP in non-production when enabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.OTP_BYPASS_ENABLED = 'true';
    process.env.OTP_BYPASS_CODE = '654321';

    const { generateOtp, sendOtp } = require('../../src/services/otp');
    expect(generateOtp()).toBe('654321');

    const result = await sendOtp('+15550002222', '654321');
    expect(result).toEqual({ success: true, bypass: true });
    expect(mockTwilioFactory).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('sends via twilio when bypass disabled', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OTP_BYPASS_ENABLED = 'false';
    process.env.TWILIO_ACCOUNT_SID = 'AC_TEST';
    process.env.TWILIO_AUTH_TOKEN = 'AUTH_TEST';
    process.env.TWILIO_PHONE_NUMBER = '+15550009999';

    const { generateOtp, sendOtp } = require('../../src/services/otp');
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);

    await sendOtp('5550001234', otp);
    expect(mockTwilioFactory).toHaveBeenCalledWith('AC_TEST', 'AUTH_TEST');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
