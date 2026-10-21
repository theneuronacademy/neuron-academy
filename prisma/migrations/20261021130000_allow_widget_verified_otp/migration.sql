-- MSG91 Widget verification is validated by MSG91 server-side and does not
-- expose a raw OTP to this application. Permit a verified proof row without
-- an OTP hash; direct SMS OTP rows continue to store a non-null hash.
ALTER TABLE "OtpRequest" ALTER COLUMN "otpHash" DROP NOT NULL;
