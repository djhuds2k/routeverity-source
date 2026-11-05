import { sendSmtpNotification } from "@dub/email/smtp-notification";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  close: vi.fn(),
  transport: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.transport },
}));
const message = {
  from: "noreply@routeverity.test",
  to: "monitor@routeverity.test",
  subject: "Local unit test",
  text: 'Check <status> & "details"',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transport.mockReturnValue({ sendMail: mocks.send, close: mocks.close });
  mocks.send.mockResolvedValue({ accepted: [message.to], rejected: [] });
});

it.each([
  "https://localhost:11025",
  "smtp://localhost:11025?rejectUnauthorized=false",
  "smtp://localhost:11025#ignored",
  "smtp://localhost:11025/unexpected",
])(
  "rejects unsupported SMTP configuration before connecting: %s",
  async (server) => {
    await expect(
      sendSmtpNotification({
        server,
        from: "noreply@routeverity.test",
        to: "monitor@routeverity.test",
        subject: "Local unit test",
        text: "No delivery attempted.",
      }),
    ).rejects.toThrow("EMAIL_SERVER");
    expect(mocks.transport).not.toHaveBeenCalled();
  },
);

it.each([
  ["smtp://smtp.example.test:587", "smtp.example.test", 587, false, true],
  ["smtps://smtp.example.test:465", "smtp.example.test", 465, true, false],
  ["smtp://smtp.example.test:465", "smtp.example.test", 465, true, false],
  ["smtp://127.0.0.1:11025", "127.0.0.1", 11025, false, false],
  ["smtp://[::1]:11025", "::1", 11025, false, false],
])(
  "requires strict remote TLS and permits only explicit loopback plaintext: %s",
  async (server, host, port, secure, requireTLS) => {
    await sendSmtpNotification({ server: String(server), ...message });
    expect(mocks.transport).toHaveBeenCalledWith(
      expect.objectContaining({
        host,
        port,
        secure,
        requireTLS,
        tls: { rejectUnauthorized: true },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
        dnsTimeout: 5000,
      }),
    );
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: message.text,
        html: "<pre>Check &lt;status&gt; &amp; &quot;details&quot;</pre>",
      }),
    );
    expect(mocks.close).toHaveBeenCalledOnce();
  },
);

it.each([
  { accepted: [], rejected: [] },
  { accepted: [message.to], rejected: [message.to] },
  { accepted: ["different@routeverity.test"], rejected: [] },
])(
  "rejects unaccepted or partially rejected recipients and closes its transport",
  async (result) => {
    mocks.send.mockResolvedValueOnce(result);
    await expect(
      sendSmtpNotification({ server: "smtp://localhost:11025", ...message }),
    ).rejects.toThrow("SMTP did not accept");
    expect(mocks.close).toHaveBeenCalledOnce();
  },
);

it("propagates transport failure and closes the owned transport", async () => {
  const failure = new Error("Local simulated transport failure");
  mocks.send.mockRejectedValueOnce(failure);
  await expect(
    sendSmtpNotification({ server: "smtp://localhost:11025", ...message }),
  ).rejects.toBe(failure);
  expect(mocks.close).toHaveBeenCalledOnce();
});
