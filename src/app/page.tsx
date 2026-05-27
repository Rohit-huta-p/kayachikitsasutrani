import Link from "next/link";

export default function Landing() {
  return (
    <>
      {/* Mobile (<md) */}
      <div className="md:hidden min-h-screen flex flex-col bg-cream">
        {/* Hero */}
        <div
          className="px-6 pt-16 pb-10 text-center text-white"
          style={{
            background: "linear-gradient(135deg, #8B6F4F 0%, #A67C52 50%, #C9A878 100%)",
          }}
        >
          <div className="text-5xl mb-2" aria-hidden="true">📜</div>
          <h1 className="text-3xl font-bold">Shloka Sutra</h1>
          <p className="mt-2 text-sm opacity-90 max-w-sm mx-auto">
            Learn Ayurvedic shlokas through guided audio recitation
          </p>
        </div>

        {/* Features */}
        <div className="flex-1 px-6 py-6 flex flex-col gap-3 max-w-md mx-auto w-full">
          <Feature icon="🎧" title="Listen & repeat" desc="Each line plays 3 times. Full shloka 3 times." />
          <Feature icon="✨" title="Per-word highlight" desc="Words light up as they're spoken — never lose your place." />
          <Feature icon="🏆" title="Leaderboards" desc="Compete on speed, attempts, and order completed." />

          <div className="flex-1" />

          <Link
            href="/signup"
            className="bg-accent text-white rounded-full py-3 px-6 text-center font-bold text-sm shadow-sm hover:opacity-90 transition"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="border border-accent text-brown rounded-full py-3 px-6 text-center font-semibold text-sm hover:bg-accent-soft transition"
          >
            I already have an account
          </Link>
        </div>
      </div>

      {/* Desktop (md+) */}
      <div className="hidden md:flex flex-col min-h-screen bg-cream">
        <div
          className="px-8 pt-24 pb-16 text-center text-white"
          style={{
            background: "linear-gradient(135deg, #8B6F4F 0%, #A67C52 50%, #C9A878 100%)",
          }}
        >
          <div className="text-6xl mb-3" aria-hidden="true">📜</div>
          <h1 className="text-5xl font-bold">Shloka Sutra</h1>
          <p className="mt-4 text-lg opacity-90 max-w-2xl mx-auto">
            Learn Ayurvedic shlokas through guided audio recitation
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-5xl mx-auto px-8 py-12 w-full">
          <FeatureCard icon="🎧" title="Listen & repeat" desc="Each line plays 3 times. Full shloka 3 times." />
          <FeatureCard icon="✨" title="Per-word highlight" desc="Words light up as they're spoken — never lose your place." />
          <FeatureCard icon="🏆" title="Leaderboards" desc="Compete on speed, attempts, and order completed." />
        </div>

        <div className="flex gap-4 justify-center mt-auto pb-16">
          <Link
            href="/signup"
            className="bg-accent text-white rounded-full py-3 px-10 text-center font-bold text-base shadow-sm hover:opacity-90 transition"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="border border-accent text-brown rounded-full py-3 px-10 text-center font-semibold text-base hover:bg-accent-soft transition"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white border border-[#E5DDD0] rounded-xl p-4 flex gap-3 items-start">
      <span className="text-2xl shrink-0" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-brown">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white border border-[#E5DDD0] rounded-2xl p-6 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md transition">
      <span className="text-4xl" aria-hidden="true">{icon}</span>
      <div className="text-lg font-bold text-brown">{title}</div>
      <div className="text-sm text-gray-500">{desc}</div>
    </div>
  );
}
