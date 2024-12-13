import { redirect } from "next/navigation";
import { auth } from "./auth";

export default async function Home() {
  const session = await auth();
  
  if (session?.user.has_onboarded) {
    redirect("/dashboard");
  } else {
    redirect("/auth/signin");
  }
}
