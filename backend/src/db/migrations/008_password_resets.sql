-- 008_password_resets.sql
-- OTP-based password recovery. One row per request. The OTP is bcrypt-hashed
-- (never stored in cleartext). After a successful OTP verification we issue a
-- random reset_token (also hashed on disk) that authorises the one-shot
-- password change. Rate limiting + attempt caps are enforced in the service.
--
-- email_outbox is the "mock email provider" — the password-reset adapter writes
-- a row here so judges can SELECT the queued message. Swap for nodemailer once
-- SMTP is configured; the adapter interface stays the same.

CREATE TABLE password_resets (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           INT UNSIGNED NOT NULL,
  otp_hash          VARCHAR(255) NOT NULL,
  attempts          INT UNSIGNED NOT NULL DEFAULT 0,
  used              TINYINT(1)   NOT NULL DEFAULT 0,
  reset_token_hash  VARCHAR(255) NULL,
  reset_token_used  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at        DATETIME     NOT NULL,
  reset_expires_at  DATETIME     NULL,
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pr_user_created (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE email_outbox (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  to_email   VARCHAR(120) NOT NULL,
  subject    VARCHAR(200) NOT NULL,
  body       TEXT         NOT NULL,
  status     ENUM('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
  queued_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at    DATETIME     NULL
) ENGINE=InnoDB;
