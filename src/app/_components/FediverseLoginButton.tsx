// import { useState, useEffect } from 'react'
// import { motion, AnimatePresence } from 'framer-motion'
// import { signIn } from "next-auth/react"
// import { SiMastodon } from 'react-icons/si'
// import { plex } from "@/app/fonts/plex"
// import { ChevronDown, Plus, Search, X, AtSign } from 'lucide-react'
// import { useTranslations } from 'next-intl'

// interface FediverseLoginButtonProps {
//   onLoadingChange?: (loading: boolean) => void
//   onError?: (error: string) => void
//   isConnected?: boolean
//   isSelected?: boolean
//   className?: string
//   onClick?: () => void
//   showForm?: boolean
//   instances?: string[]
// }

// const itemVariants = {
//   hidden: { opacity: 0, y: 20 },
//   visible: { opacity: 1, y: 0 },
//   exit: { opacity: 0, y: -20 }
// }

// const formVariants = {
//   hidden: { opacity: 0, scale: 0.95 },
//   visible: {
//     opacity: 1,
//     scale: 1,
//     transition: {
//       type: "spring",
//       stiffness: 300,
//       damping: 30
//     }
//   },
//   exit: {
//     opacity: 0,
//     scale: 0.95,
//     transition: {
//       duration: 0.2
//     }
//   }
// }

// export default function FediverseLoginButton({
//   onLoadingChange = () => { },
//   onError = () => { },
//   isConnected = false,
//   isSelected = false,
//   className = "",
//   onClick = () => { },
//   showForm = false,
//   instances = []
// }: FediverseLoginButtonProps) {
//   const [inputText, setInputText] = useState('')
//   const [inputType, setInputType] = useState<'instance' | 'handle'>('instance')
//   const [inputError, setInputError] = useState('')
//   const t = useTranslations('dashboardLoginButtons')

//   // Detect if input is a handle (@user@domain.tld) or just an instance (domain.tld)
//   useEffect(() => {
//     const isHandle = inputText.includes('@');
//     setInputType(isHandle ? 'handle' : 'instance');
//   }, [inputText]);

//   const validateInput = (input: string): boolean => {
//     setInputError('')

//     // Remove spaces
//     input = input.trim()

//     // Check if empty
//     if (!input) {
//       setInputError(t('services.mastodon.error.required'))
//       return false
//     }

//     if (inputType === 'handle') {
//       // Validate handle format (username@domain.tld)
//       const handleRegex = /^@?([a-zA-Z0-9_]+)@([a-zA-Z0-9][a-zA-Z0-9\.\-]+)$/;
//       if (!handleRegex.test(input)) {
//         setInputError('Invalid handle format. Use format: username@domain.tld')
//         return false
//       }
//     } else {
//       // Validate instance format (domain.tld)
//       const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9\.\-]+$/;
//       if (!hostnameRegex.test(input)) {
//         setInputError(t('services.mastodon.error.invalid_format'))
//         return false
//       }
//     }

//     return true
//   }

//   const handleSignIn = async (input: string) => {
//     if (!input) return

//     // Validate custom input
//     if (!instances.includes(input) && !validateInput(input)) {
//       return
//     }

//     try {
//       onLoadingChange(true)
//       const callbackUrl = window.location.pathname.includes('/reconnect') ? '/reconnect' : '/dashboard'

//       // Determine if we're signing in with a handle or instance
//       const params = inputType === 'handle' 
//         ? { handle: input.trim() } 
//         : { instance: input.trim() };

//       const result = await signIn("fediverse", {
//         redirect: false,
//         callbackUrl: callbackUrl
//       }, params)
      
//       console.log("Fediverse SignIn result:", result)

//       if (result?.error) {
//         onError(result.error)
//       } else if (result?.ok && result.url) {
//         window.location.href = result.url
//       }
//     } catch (error) {
//       console.error("Error during Fediverse sign in:", error)
//       onError(t('services.mastodon.error.unreachable'))
//     } finally {
//       onLoadingChange(false)
//     }
//   }

//   if (!showForm) {
//     return (
//       <motion.button
//         variants={itemVariants}
//         initial="hidden"
//         animate="visible"
//         exit="exit"
//         onClick={onClick}
//         className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 text-white 
//                    ${isSelected
//             ? 'bg-[#2e8555] ring-2 ring-green-400/50'
//             : 'bg-[#38a169] hover:bg-[#2e8555]'} 
//                    rounded-xl transition-all duration-200 ${plex.className} ${className}
//                    hover:shadow-lg hover:shadow-green-500/20`}
//         disabled={isConnected}
//       >
//         <SiMastodon className="w-5 h-5" />
//         <span className="font-medium">
//           {isConnected ? t('connected') : "Fediverse"}
//         </span>
//         <ChevronDown
//           className={`w-4 h-4 transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`}
//         />
//       </motion.button>
//     )
//   }

//   return (
//     <div
//       className={`px-4 py-4 bg-white rounded-2xl shadow-xl text-sm text-gray-800`}
//     >
//       <div className="">
//         <datalist id="known_fediverse_instances">
//           {instances.map((instance, index) => (
//             <option key={index} value={instance} />
//           ))}
//         </datalist>
//         <form onSubmit={(e) => {
//           e.preventDefault();
//           handleSignIn(inputText);
//         }}>
//           <div className="relative">
//             <div className="flex items-center justify-between">
//               <p>
//                 {inputType === 'handle' 
//                   ? 'Enter your Fediverse handle' 
//                   : 'Enter your Fediverse instance'}
//               </p>
//               <div className="text-xs text-gray-500">
//                 {inputType === 'handle' 
//                   ? 'Format: username@domain.tld' 
//                   : 'Format: domain.tld'}
//               </div>
//             </div>
//             <div className="relative">
//               {inputType === 'handle' && (
//                 <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
//                   <AtSign size={16} />
//                 </div>
//               )}
//               <input
//                 type="text" 
//                 list="known_fediverse_instances"
//                 value={inputText}
//                 onChange={(e) => {
//                   setInputError('')
//                   const value = e.target.value?.trim();
//                   setInputText(e.target.value)
//                 }}
//                 className={`w-full px-4 ${inputType === 'handle' ? 'pl-9' : 'pl-4'} py-3 my-3 bg-gray-50 border rounded-xl 
//                               text-gray-800 placeholder-gray-500 
//                               focus:ring-2 focus:outline-none 
//                               ${inputError
//                   ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20'
//                   : 'border-gray-200 focus:border-green-400 focus:ring-green-400/20'
//                 }`}
//                 placeholder={inputType === 'handle' 
//                   ? "username@example.social" 
//                   : "example.social"}
//               />
//             </div>
//             {inputError && (
//               <p
//                 className="mt-2 text-sm text-red-600"
//               >
//                 {inputError}
//               </p>
//             )}
//           </div>

//           <button
//             type="button"
//             onClick={() => handleSignIn(inputText)}
//             className="w-full px-4 py-3 mt-4 text-white bg-[#38a169] hover:bg-[#2e8555] rounded-xl 
//                        transition-all duration-200 font-medium flex items-center justify-center gap-2"
//           >
//             <SiMastodon className="w-4 h-4" />
//             {t('connect')}
//           </button>
//         </form>
//       </div>
//     </div>
//   )
// }