import { appOrigin } from "@/lib/routeverity/environment";
import { isLocalOrigin } from "@/lib/routeverity/validation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CheckEmail() {
  return (
    <main className="rv-page max-w-lg pt-20">
      <section className="rv-card rv-stack">
        <h1>Check your email</h1>
        <p>
          Open the sign-in link we sent you. It expires after 15 minutes and can
          only be used once.
        </p>
        {isLocalOrigin(appOrigin()) && (
          <p className="rv-muted">
            For local development, open the MailHog inbox at localhost:18025.
            Production must use a configured SMTP provider.
          </p>
        )}
        <Link href="/login" className="underline">
          Request another link
        </Link>
      </section>
    </main>
  );
}
