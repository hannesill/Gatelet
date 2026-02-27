export const defaultPolicyYaml = `provider: outlook_mail
account: "{account}"

operations:
  search:
    allow: true
    mutations:
      - field: maxResults
        action: set
        value: 10
    guards:
      block_subjects:
        - password reset
        - reset your password
        - verification code
        - security code
        - two-factor
        - 2FA
        - one-time password
        - one-time pin
        - one-time code
        - OTP
        - sign-in attempt
        - login alert
        - security alert
        - confirm your identity
        - einmalcode
        - sicherheitswarnung
        - sicherheitscode
      block_sender_domains:
        - accounts.google.com
        - accountprotection.microsoft.com
        - account.live.com
        - login.microsoftonline.com
      redact_patterns:
        - pattern: "\\\\b\\\\d{3}-\\\\d{2}-\\\\d{4}\\\\b"
          replace: "[REDACTED-SSN]"
        - pattern: "\\\\b\\\\d{4}[\\\\s-]?\\\\d{4}[\\\\s-]?\\\\d{4}[\\\\s-]?\\\\d{4}\\\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\\\b\\\\d{4}[\\\\s-]?\\\\d{6}[\\\\s-]?\\\\d{5}\\\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\\\bCVV[:\\\\s]*\\\\d{3,4}\\\\b"
          replace: "CVV [REDACTED]"
        - pattern: "\\\\b[A-Z]{1,2}\\\\d{6,9}\\\\b"
          replace: "[REDACTED-PASSPORT]"
        - pattern: "\\\\brouting[:\\\\s#]*\\\\d{9}\\\\b"
          replace: "routing [REDACTED]"
        - pattern: "\\\\baccount[:\\\\s#]*\\\\d{8,17}\\\\b"
          replace: "account [REDACTED]"

  read_message:
    allow: true
    guards:
      block_subjects:
        - password reset
        - reset your password
        - verification code
        - security code
        - two-factor
        - 2FA
        - one-time password
        - one-time pin
        - one-time code
        - OTP
        - sign-in attempt
        - login alert
        - security alert
        - confirm your identity
        - einmalcode
        - sicherheitswarnung
        - sicherheitscode
      block_sender_domains:
        - accounts.google.com
        - accountprotection.microsoft.com
        - account.live.com
        - login.microsoftonline.com
      redact_patterns:
        - pattern: "\\\\b\\\\d{3}-\\\\d{2}-\\\\d{4}\\\\b"
          replace: "[REDACTED-SSN]"
        - pattern: "\\\\b\\\\d{4}[\\\\s-]?\\\\d{4}[\\\\s-]?\\\\d{4}[\\\\s-]?\\\\d{4}\\\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\\\b\\\\d{4}[\\\\s-]?\\\\d{6}[\\\\s-]?\\\\d{5}\\\\b"
          replace: "[REDACTED-CC]"
        - pattern: "\\\\bCVV[:\\\\s]*\\\\d{3,4}\\\\b"
          replace: "CVV [REDACTED]"
        - pattern: "\\\\b[A-Z]{1,2}\\\\d{6,9}\\\\b"
          replace: "[REDACTED-PASSPORT]"
        - pattern: "\\\\brouting[:\\\\s#]*\\\\d{9}\\\\b"
          replace: "routing [REDACTED]"
        - pattern: "\\\\baccount[:\\\\s#]*\\\\d{8,17}\\\\b"
          replace: "account [REDACTED]"

  create_draft:
    allow: true
    constraints:
      - field: to
        rule: must_not_be_empty
      - field: subject
        rule: must_not_be_empty
    mutations:
      - field: cc
        action: delete
      - field: bcc
        action: delete

  list_drafts:
    allow: true
    mutations:
      - field: maxResults
        action: set
        value: 10

  send:
    allow: false
    # To enable sending with alias enforcement:
    # allow: true
    # constraints:
    #   - field: from
    #     rule: must_match
    #     value: ".*\\\\+agent@.*"
    constraints:
      - field: to
        rule: must_not_be_empty
      - field: subject
        rule: must_not_be_empty
    mutations:
      - field: cc
        action: delete
      - field: bcc
        action: delete

  reply:
    allow: false
    # To enable replying:
    # allow: true
    constraints:
      - field: messageId
        rule: must_not_be_empty
      - field: body
        rule: must_not_be_empty
    mutations:
      - field: replyAll
        action: set
        value: false

  categorize:
    allow: true

  archive:
    allow: true
`;
