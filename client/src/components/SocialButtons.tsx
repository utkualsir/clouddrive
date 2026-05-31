const FB_URL = 'https://www.facebook.com/profile.php?id=61580093684116';
const IG_URL = 'https://www.instagram.com/utkualsirr/';

export default function SocialButtons({ gradientId }: { gradientId: string }) {
  return (
    <div className="flex items-center gap-2">
      {/* Facebook */}
      <a
        href={FB_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Follow on Facebook"
        className="w-10 h-10 rounded-full border border-[#E5E5E5] dark:border-[#2A2A2A] bg-transparent flex items-center justify-center hover:scale-110 transition-transform duration-150"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#1877F2"
            d="M17.525 9H14V7c0-1.032.084-1.682 1.563-1.682h1.868v-3.18A26.065 26.065 0 0013.833 2C11.027 2 9 3.657 9 6.699V9H6v3.5l3-.001V22h4v-9.502l3.066-.001L17.525 9z"
          />
        </svg>
      </a>

      {/* Instagram */}
      <a
        href={IG_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Follow on Instagram"
        className="w-10 h-10 rounded-full border border-[#E5E5E5] dark:border-[#2A2A2A] bg-transparent flex items-center justify-center hover:scale-110 transition-transform duration-150"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
              <stop offset="0%"  stopColor="#fdf497" />
              <stop offset="5%"  stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <path
            fill={`url(#${gradientId})`}
            d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
          />
        </svg>
      </a>
    </div>
  );
}
