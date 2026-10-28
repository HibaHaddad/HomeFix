import { Suspense } from "react";
import ProfessionalDirectory from "@/components/client/ProfessionalDirectory";
import DirectorySkeleton from "@/components/client/DirectorySkeleton";

export const metadata = { title: "Trouver un professionnel | HomeFix" };
export default function FindProfessionalPage() {
  return <Suspense fallback={<DirectorySkeleton/>}><ProfessionalDirectory/></Suspense>;
}
