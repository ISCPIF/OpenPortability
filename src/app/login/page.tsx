'use client'

import { useSession, signIn } from "next-auth/react"
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to GoodbyeX</h1>
            <p className="text-gray-300">Sign in to continue to your account</p>
          </div>
          
          <button
            onClick={() => signIn('twitter', { callbackUrl: '/' })}
            className="w-full group relative flex items-center justify-center gap-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-[#1DA1F2]/20 hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
            </svg>
            Continue with Twitter
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              By signing in, you agree to our{' '}
              <a href="#" className="text-blue-400 hover:text-blue-300 underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-blue-400 hover:text-blue-300 underline">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}