import { cn } from '../utils';

export function GmailLogo({ className }: { className?: string }) {
  return (
    <svg className={cn("h-full w-full", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" fill="#EA4335" />
      <path d="M22 6L12 13L2 6V18H22V6Z" fill="#FBBC04" />
      <path d="M22 6L12 13L2 6" fill="#C5221F" />
      <path d="M20 4H4C2.9 4 2 4.9 2 6V7L12 14L22 7V6C22 4.9 21.1 4 20 4Z" fill="#EA4335" />
      <path d="M2 18V6.75L12 13.75L22 6.75V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18Z" fill="#4285F4" />
      <path d="M12 13.75L2 6.75V6C2 4.9 2.9 4 4 4H5L12 10L19 4H20C21.1 4 22 4.9 22 6V6.75L12 13.75Z" fill="#34A853" />
    </svg>
  );
}

export function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg className={cn("h-full w-full", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 4H5C3.89543 4 3 4.89543 3 6V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V6C21 4.89543 20.1046 4 19 4Z" fill="white" />
      <path d="M21 8.5V6C21 4.89543 20.1046 4 19 4H15V8.5H21Z" fill="#EA4335" />
      <path d="M3 15.5V18C3 19.1046 3.89543 20 5 20H9V15.5H3Z" fill="#34A853" />
      <path d="M15 20H19C20.1046 20 21 19.1046 21 18V15.5H15V20Z" fill="#4285F4" />
      <path d="M3 6V8.5H9V4H5C3.89543 4 3 4.89543 3 6Z" fill="#4285F4" />
      <path d="M9 4V8.5H15V4H9Z" fill="#FBBC04" />
      <path d="M15 8.5V15.5H21V8.5H15Z" fill="#4285F4" />
      <path d="M3 8.5V15.5H9V8.5H3Z" fill="#4285F4" />
      <path d="M9 15.5V20H15V15.5H9Z" fill="#4285F4" />
      <path d="M9 8.5V15.5H15V8.5H9Z" fill="white" />
    </svg>
  );
}

export function OutlookCalendarLogo({ className }: { className?: string }) {
  return (
    <svg className={cn("h-full w-full", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 5.5V18.5C21 19.8807 19.8807 21 18.5 21H5.5C4.11929 21 3 19.8807 3 18.5V5.5C3 4.11929 4.11929 3 5.5 3H18.5C19.8807 3 21 4.11929 21 5.5Z" fill="#0078D4" />
      <path d="M17.5 7H6.5V17H17.5V7Z" fill="white" />
      <path d="M15.5 4H8.5V7H15.5V4Z" fill="#005A9E" />
      <path d="M8.5 10H10V11.5H8.5V10ZM11.25 10H12.75V11.5H11.25V10ZM14 10H15.5V11.5H14V10ZM8.5 13H10V14.5H8.5V13ZM11.25 13H12.75V14.5H11.25V13ZM14 13H15.5V14.5H14V13Z" fill="#0078D4" />
    </svg>
  );
}
