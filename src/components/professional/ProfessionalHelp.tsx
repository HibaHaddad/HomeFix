import HomeFixHelp from "@/components/support/HomeFixHelp";

export default function ProfessionalHelp({ name, email }: { name: string; email: string }) {
  return <HomeFixHelp name={name} email={email} professional />;
}
