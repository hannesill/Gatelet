import { cn } from '../utils';

/**
 * Official Google Gmail Logo (2020)
 * Extracted from official Google static assets.
 */
export function GmailLogo({ className }: { className?: string }) {
  return (
    <svg className={cn("h-full w-full", className)} viewBox="52 43.8 82 64.2" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M58 108h14V74L52 59v43c0 3.315 2.685 6 6 6z" fill="#4285F4"/>
      <path d="M120 108h14c3.315 0 6-2.685 6-6V59l-20 15v34z" fill="#34A853"/>
      <path d="M120 48v26l20-15v-8c0-7.415-8.465-11.65-14.4-7.2L120 48z" fill="#FBBC04"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M72 74V48l24 18 24-18v26L96 92 72 74z" fill="#EA4335"/>
      <path d="M52 51v8l20 15V48l-5.6-4.2C60.465 39.35 52 43.585 52 51z" fill="#C5221F"/>
    </svg>
  );
}

/**
 * Official Google Calendar Logo (2020)
 * Extracted from official Google static assets.
 * Includes the "31" date representation.
 */
export function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg className={cn("h-full w-full", className)} viewBox="186 38 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M244 56h-40v40h40V56z" fill="#fff"/>
      <path d="M212.205 87.03c-1.495-1.01-2.53-2.485-3.095-4.435l3.47-1.43c.315 1.2.865 2.13 1.65 2.79.78.66 1.73.985 2.84.985 1.135 0 2.11-.345 2.925-1.035s1.225-1.57 1.225-2.635c0-1.09-.43-1.98-1.29-2.67-.86-.69-1.94-1.035-3.23-1.035h-2.005V74.13h1.8c1.11 0 2.045-.3 2.805-.9.76-.6 1.14-1.42 1.14-2.465 0-.93-.34-1.67-1.02-2.225-.68-.555-1.54-.835-2.585-.835-1.02 0-1.83.27-2.43.815a4.784 4.784 0 00-1.31 2.005l-3.435-1.43c.455-1.29 1.29-2.43 2.515-3.415 1.225-.985 2.79-1.48 4.69-1.48 1.405 0 2.67.27 3.79.815 1.12.545 2 1.3 2.635 2.26.635.965.95 2.045.95 3.245 0 1.225-.295 2.26-.885 3.11-.59.85-1.315 1.5-2.175 1.955v.205a6.605 6.605 0 012.79 2.175c.725.975 1.09 2.14 1.09 3.5 0 1.36-.345 2.575-1.035 3.64s-1.645 1.905-2.855 2.515c-1.215.61-2.58.92-4.095.92-1.755.005-3.375-.5-4.87-1.51z" fill="#4285F4"/>
      <path d="M233.52 69.81l-3.81 2.755-1.905-2.89 6.835-4.93h2.62V88h-3.74V69.81z" fill="#4285F4"/>
      <path d="M244 96h-40v18h40V96z" fill="#34A853"/>
      <path d="M244 38h-52c-3.315 0-6 2.685-6 6v52h18V56h40V38z" fill="#4285F4"/>
      <path d="M186 96v12c0 3.315 2.685 6 6 6h12V96h-18z" fill="#188038"/>
      <path d="M262 56h-18v40h18V56z" fill="#FBBC04"/>
      <path d="M262 56V44c0-3.315-2.685-6-6-6h-12v18h18z" fill="#1967D2"/>
      <path d="M244 114l18-18h-18v18z" fill="#EA4335"/>
    </svg>
  );
}

/**
 * Microsoft Logo (Colorful 4-Square)
 */
export function OutlookCalendarLogo({ className }: { className?: string }) {
  return (
    <svg className={cn("h-full w-full", className)} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}
