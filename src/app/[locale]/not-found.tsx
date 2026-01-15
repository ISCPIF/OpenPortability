import { Home, Search } from 'lucide-react'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { quantico } from '@/app/fonts/plex'
import logoBlanc from '@/../public/logo/logo-openport-blanc.svg'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
      <div className="max-w-md w-full relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src={logoBlanc}
            alt="OpenPort Logo"
            width={180}
            height={54}
            className="h-auto w-[140px] sm:w-[180px]"
            priority
          />
        </div>

        {/* 404 Card */}
        <div className={`${quantico.className} rounded-xl backdrop-blur-sm border shadow-xl overflow-hidden bg-slate-900/95 border-slate-700/50`}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-amber-500/20 border-amber-500/30">
                <Search className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold text-white">
                  {t('title')}
                </h1>
                <p className="text-[11px] text-slate-400">
                  {t('subtitle')}
                </p>
              </div>
            </div>
          </div>
          
          {/* Body */}
          <div className="px-5 py-4">
            <p className="text-[13px] leading-relaxed text-slate-300">
              {t('message')}
            </p>
          </div>
          
          {/* Footer */}
          <div className="px-5 py-4 border-t flex justify-end border-slate-700/50">
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium rounded-lg transition-all bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-500/20"
            >
              <Home className="w-4 h-4" />
              {t('backHome')}
            </a>
          </div>
        </div>

        {/* 404 badge */}
        <div className="flex justify-center mt-4">
          <span className="text-[10px] px-3 py-1 rounded-full bg-slate-800/50 text-slate-500 border border-slate-700/50">
            404
          </span>
        </div>
      </div>
    </div>
  )
}
