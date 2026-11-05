import nodemailer from "nodemailer";

export async function sendSmtpNotification({
  server,
  from,
  to,
  subject,
  text,
}: {
  server: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const url = new URL(server);
  if (
    !["smtp:", "smtps:"].includes(url.protocol) ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    throw new Error("EMAIL_SERVER must be a plain SMTP or SMTPS URL.");
  const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
  const local = ["127.0.0.1", "localhost", "::1"].includes(hostname);
  const secure = url.protocol === "smtps:" || url.port === "465";
  const transport = nodemailer.createTransport({
    host: hostname,
    port: Number(url.port || (secure ? 465 : 587)),
    secure,
    requireTLS: !local && !secure,
    ...(url.username
      ? {
          auth: {
            user: decodeURIComponent(url.username),
            pass: decodeURIComponent(url.password),
          },
        }
      : {}),
    tls: { rejectUnauthorized: true },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    dnsTimeout: 5000,
  });
  const escaped = text.replace(
    /[&<>"]/g,
    (value) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[value] ??
      value,
  );
  try {
    const result = await transport.sendMail({
      from,
      to,
      subject,
      text,
      html: `<pre>${escaped}</pre>`,
    });
    if (
      result.rejected.length ||
      !result.accepted.some(
        (address) => address.toLowerCase() === to.toLowerCase(),
      )
    )
      throw new Error("SMTP did not accept the operational alert recipient.");
  } finally {
    transport.close();
  }
}
