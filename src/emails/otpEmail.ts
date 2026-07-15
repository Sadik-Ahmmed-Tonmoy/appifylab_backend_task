export const otpEmail = (
  randomOtp: string,
  userEmail: string,
  title: string = "Verify Your Email Address"
) => {
  return `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#f4f7fb;
  font-family:Arial,sans-serif;
  color:#1f2937;
">

  <!-- Wrapper -->
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    role="presentation"
    style="background-color:#f4f7fb;padding:40px 15px;"
  >
    <tr>
      <td align="center">

        <!-- Container -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="
            max-width:600px;
            background:#ffffff;
            border-radius:20px;
            overflow:hidden;
            box-shadow:0 8px 25px rgba(0,0,0,0.08);
          "
        >

          <!-- Header -->
          <tr>
            <td
              align="center"
              style="
                background:linear-gradient(135deg,#007C74,#00A693);
                padding:45px 30px;
              "
            >

              <span style="
                display:block;
                margin:0 auto 25px auto;
                font-family:Arial,sans-serif;
                font-size:32px;
                font-weight:bold;
                color:#ffffff;
                letter-spacing:2px;
                text-transform:uppercase;
              ">
                Glassophite
              </span>

              <h1 style="
                margin:0;
                font-size:30px;
                line-height:38px;
                color:#ffffff;
                font-weight:700;
              ">
                ${title}
              </h1>

              <p style="
                margin:14px 0 0 0;
                font-size:15px;
                line-height:24px;
                color:#d6e0f0;
              ">
                Secure verification for your Glassophite account
              </p>

            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:45px 35px;">

              <p style="
                margin:0 0 18px 0;
                font-size:16px;
                line-height:28px;
                color:#374151;
              ">
                Hello,
              </p>

              <p style="
                margin:0 0 30px 0;
                font-size:16px;
                line-height:28px;
                color:#4b5563;
              ">
                Thanks for choosing
                <strong>Glassophite</strong>.
                Use the verification code below to continue securely.
              </p>

              <!-- OTP Card -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="margin-bottom:35px;"
              >
                <tr>
                  <td align="center">

                    <table
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="
                        background:#e8f8f3;
                        border:2px solid #00A693;
                        border-radius:18px;
                        width:100%;
                        max-width:340px;
                      "
                    >
                      <tr>
                        <td style="padding:28px 20px;" align="center">

                          <p style="
                            margin:0 0 12px 0;
                            font-size:13px;
                            font-weight:700;
                            color:#007C74;
                            letter-spacing:1px;
                            text-transform:uppercase;
                          ">
                            Verification Code
                          </p>

                          <p style="
                            margin:0;
                            font-size:38px;
                            line-height:42px;
                            font-weight:700;
                            letter-spacing:8px;
                            color:#007C74;
                            font-family:'Courier New', monospace;
                          ">
                            ${randomOtp}
                          </p>

                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Security Box -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="
                  background:#f9fafb;
                  border-left:4px solid #00A693;
                  border-radius:10px;
                  margin-bottom:30px;
                "
              >
                <tr>
                  <td style="padding:18px;">

                    <p style="
                      margin:0;
                      font-size:14px;
                      line-height:24px;
                      color:#4b5563;
                    ">
                      🔒 This verification code will expire shortly.
                      Never share your OTP with anyone.
                    </p>

                  </td>
                </tr>
              </table>

              <p style="
                margin:0;
                font-size:14px;
                line-height:24px;
                color:#6b7280;
              ">
                If you did not request this email, you can safely ignore it.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background:#f9fafb;
              border-top:1px solid #e5e7eb;
              padding:30px;
              text-align:center;
            ">

              <p style="
                margin:0 0 8px 0;
                font-size:15px;
                font-weight:700;
                color:#111827;
              ">
                Glassophite
              </p>

              <p style="
                margin:0 0 16px 0;
                font-size:13px;
                color:#6b7280;
              ">
                Premium Eyewear. Timeless Style.
              </p>

              <p style="
                margin:0;
                font-size:12px;
                color:#9ca3af;
              ">
                &copy; ${new Date().getFullYear()} Glassophite.
                All rights reserved.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
};
