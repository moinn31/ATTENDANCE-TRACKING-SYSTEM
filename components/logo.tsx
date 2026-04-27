import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full p-1.5"
      >
        {/* Scanning Frame Corners */}
        <path
          d="M4 8V5C4 4.44772 4.44772 4 5 4H8"
          stroke="#2b5c9e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M16 4H19C19.5523 4 20 4.44772 20 5V8"
          stroke="#2b5c9e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M20 16V19C20 19.5523 19.5523 20 19 20H16"
          stroke="#2b5c9e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M8 20H5C4.44772 20 4 19.5523 4 19V16"
          stroke="#2b5c9e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        
        {/* Human Profile */}
        <circle cx="12" cy="9.5" r="3" fill="#2b5c9e" />
        <path
          d="M7 17.5C7 14.7386 9.23858 12.5 12 12.5C14.7614 12.5 17 14.7386 17 17.5V18H7V17.5Z"
          fill="#2b5c9e"
        />
        
        {/* Success Checkmark Badge */}
        <circle cx="18" cy="18" r="4" fill="#10b981" stroke="white" strokeWidth="1.5" />
        <path
          d="M16.5 18L17.5 19L19.5 17"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
