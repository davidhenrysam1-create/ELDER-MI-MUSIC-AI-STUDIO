import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center py-12">
      <GlassCard className="max-w-lg text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-violet/20 text-violet-200">
          <Icon name="waveform" size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">
          <GradientText>This track is not in the session</GradientText>
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          The page or file you asked for does not exist. Nothing was deleted — your projects, audio
          and exports are untouched.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary text-xs">
            <Icon name="dashboard" size={13} /> Back to dashboard
          </Link>
          <Link href="/docs" className="btn-ghost text-xs">
            <Icon name="file" size={13} /> Documentation
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
