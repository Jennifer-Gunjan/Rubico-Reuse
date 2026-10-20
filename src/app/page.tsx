import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  domain: "Only @rubicotech.com and @rubicotech.in accounts can sign in.",
  signin: "Sign-in did not complete. Please try again.",
  config: "The app is not configured yet.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <header className="nav"><div className="wrap"><Logo /></div></header>
      <main className="wrap hero">
        <h1>Give things a second life, inside Rubico.</h1>
        <p className="lead">Donate, exchange, sell or lend what you no longer need. Ask for what you are looking for.</p>
        <section className="card" aria-labelledby="signin" style={{ marginTop: 32 }}>
          <h2 id="signin">Sign in</h2>
          {error && <p className="error" role="alert">{ERRORS[error] ?? ERRORS.signin}</p>}
          <LoginForm />
        </section>
      </main>
    </>
  );
}
