import { Logo } from "@/components/Logo";
import { Workbench } from "@/components/Workbench";
import { EXAMPLE_TEXT } from "@/lib/analysis";
import { analyze } from "@/server/analyze";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await analyze(EXAMPLE_TEXT);
  return (
    <>
      <header className="site-header">
        <h1 className="site-title">
          <Logo />
        </h1>
        <p className="tagline">Plain English in. Valid SQLite out.</p>
      </header>
      <main className="site-main">
        <Workbench initialText={EXAMPLE_TEXT} initial={initial} />
      </main>
    </>
  );
}
