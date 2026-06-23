import { isKycVerified } from '../lib/format.js'

export default function KycBadge({ user, className = '', label = 'KYC verified' }) {
  if (!isKycVerified(user)) return null

  return (
    <span
      aria-label={label}
      className={`inline-grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#1877f2] text-white shadow-[0_0_0_1px_rgba(255,255,255,.16)] ${className}`}
      title={label}
    >
      <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 16 16">
        <path d="M3.4 8.3 6.4 11 12.7 4.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </svg>
    </span>
  )
}
