import AudioWorkoutStudio from "@/components/AudioWorkoutStudio";
import PwaRegister from "@/components/PwaRegister";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col">
        <AudioWorkoutStudio />
        <PwaRegister />
      </div>
    </div>
  );
}
