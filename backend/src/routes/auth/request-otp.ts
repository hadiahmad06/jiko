// src/routes/auth/request-otp.ts
import { Router } from 'express';
// import crypto from 'crypto';
// import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const router = Router();

// Temporary in-memory store for OTPs
// { [phoneNumber: string]: { code: string, expiresAt: number } }
// const otpStore: Record<string, { code: string; expiresAt: number }> = {};

// const snsClient = new SNSClient({ region: process.env.AWS_REGION });

// function generateOtp(): string {
//   return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
// }

router.post('/', async (req, res) => {
  // const { phoneNumber } = req.body;
  // if (!phoneNumber) return res.status(400).json({ error: 'Missing phoneNumber' });
  //
  // const otp = generateOtp();
  // const expiresAt = Date.now() + 5 * 60 * 1000; // OTP valid for 5 minutes
  //
  // // Store OTP in memory (or use Redis/DynamoDB for production)
  // otpStore[phoneNumber] = { code: otp, expiresAt };
  //
  // try {
  //   // Send SMS via AWS SNS
  //   await snsClient.send(new PublishCommand({
  //     PhoneNumber: phoneNumber,
  //     Message: `Your login code is: ${otp}. It expires in 5 minutes.`,
  //   }));
  //
  //   res.json({ message: 'OTP sent' });
  // } catch (err) {
  //   console.error('Error sending OTP via SNS:', err);
  //   res.status(500).json({ error: 'Failed to send OTP' });
  // }
  return res.status(500).json({ error: 'Internal Server Error' });
});

export default router;