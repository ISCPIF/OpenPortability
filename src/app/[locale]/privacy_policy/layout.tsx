import { auth } from "@/app/auth"
import { redirect } from "next/navigation"

export default async function PrivaryPolicyLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return <>{children}</>
}
