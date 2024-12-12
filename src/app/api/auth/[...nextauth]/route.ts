import { authConfig } from "@/app/auth.config"
import NextAuth from "next-auth"
import { handlers } from "@/app/auth"

export const { GET, POST } = handlers