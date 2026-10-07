import { brand } from "@/lib/routeverity/brand";
import { LoginForm } from "@/ui/routeverity/login-form";
import Image from "next/image";
import Link from "next/link";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen bg-white">
      <section className="rv-grid flex flex-1 items-center justify-center px-6 py-12">
        <div className="rv-stack w-full max-w-sm">
          <Link href="/">
            <Image
              src={brand.wordmark}
              alt="RouteVerity"
              width={240}
              height={60}
              priority
            />
          </Link>
          <div>
            <h1 className="text-2xl">Welcome to RouteVerity</h1>
            <p className="rv-muted mt-2">
              Sign in to your workspace, or create your account.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-[var(--rv-danger)]">
              Sign-in failed or the link has expired. Request a new link below.
            </p>
          )}
          <LoginForm />
          <Link href="/transparency" className="rv-muted text-xs underline">
            Transparent by design. Learn how we work.
          </Link>
        </div>
      </section>
      <aside className="hidden w-[440px] flex-col justify-center bg-[var(--rv-paper)] p-12 min-[900px]:flex lg:w-[595px]">
        <Image src={brand.logo} alt="" width={120} height={120} />
        <h2 className="mt-8 text-4xl leading-tight">{brand.tagline}</h2>
        <p className="rv-muted mt-5 text-lg">{brand.description}</p>
        <p className="rv-muted mt-12">
          Designed for transparent advertising measurement.
        </p>
      </aside>
    </main>
  );
}
