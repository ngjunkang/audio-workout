import AudioWorkoutStudio from "@/components/AudioWorkoutStudio";
import PwaRegister from "@/components/PwaRegister";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const planParam = (await searchParams).plan;
  const initialEncodedPlan = Array.isArray(planParam) ? planParam[0] : planParam;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col">
        <AudioWorkoutStudio initialEncodedPlan={initialEncodedPlan} />
        <PwaRegister />
      </div>
    </div>
  );
}
