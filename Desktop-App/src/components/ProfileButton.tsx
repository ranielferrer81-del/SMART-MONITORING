import { useState, useEffect, useRef, useMemo } from 'react';
import { LogOut, User } from 'lucide-react';
import type { AuthenticatedUser } from '../api/client';
import { fetchMonitoringStatus } from '../api/client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

const buildPictureUrl = (picture: string | null): string | null => {
  if (!picture) return null;
  if (picture.startsWith('http')) return picture;
  if (picture.startsWith('/storage/')) return `${API_BASE_URL}${picture}`;
  if (picture.startsWith('storage/')) return `${API_BASE_URL}/${picture}`;
  if (picture.startsWith('/')) return `${API_BASE_URL}${picture}`;
  return `${API_BASE_URL}/storage/${picture}`;
};

type ProfileButtonProps = {
  user: AuthenticatedUser;
  onLogout: () => void;
};

export default function ProfileButton({ user, onLogout }: ProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [dropdownImageError, setDropdownImageError] = useState(false);
  const mountTimeRef = useRef<number>(Date.now());
  const lastMouseYRef = useRef<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<{ is_active: boolean; is_extension_connected: boolean }>({ is_active: false, is_extension_connected: false });

  // Check monitoring status when dropdown is open
  useEffect(() => {
    if (isOpen) {
      const checkStatus = async () => {
        const status = await fetchMonitoringStatus();
        setMonitoringStatus(status);
      };
      checkStatus();
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const profilePictureUrl = useMemo(() => {
    return buildPictureUrl(user.profilePicture);
  }, [user.profilePicture]);

  // Reset image error when profile picture URL changes
  useEffect(() => {
    setImageError(false);
    setDropdownImageError(false);
  }, [profilePictureUrl]);

  // Track mount time to prevent immediate display after PIN entry
  useEffect(() => {
    mountTimeRef.current = Date.now();
  }, []);

  // Expand window and show button when mouse enters the top center area
  useEffect(() => {
    let collapseTimeout: NodeJS.Timeout;

    // Expand window and show button when mouse enters
    const handleMouseEnter = () => {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        electronAPI.expandProfileWindow();
      }
      setIsVisible(true);
      if (collapseTimeout) clearTimeout(collapseTimeout);
    };

    // Collapse window when mouse leaves, but only if dropdown is not open
    const handleMouseLeave = () => {
      if (!isOpen) {
        collapseTimeout = setTimeout(() => {
          setIsVisible(false);
          const electronAPI = (window as any).electronAPI;
          if (electronAPI) {
            electronAPI.collapseProfileWindow();
          }
        }, 1500); // Increased from 500ms to 1500ms to give user more time
      }
      // If dropdown is open, keep window expanded
    };

    // Track mouse position - expand when mouse is at very top
    const handleMouseMove = (event: MouseEvent) => {
      const mouseY = event.clientY;
      const timeSinceMount = Date.now() - mountTimeRef.current;
      const previousY = lastMouseYRef.current;
      lastMouseYRef.current = mouseY;

      // Expand when mouse is at the very top (within 60px)
      if (mouseY <= 60) {
        // Show immediately if:
        // 1. Enough time has passed since mount (prevents immediate display after PIN entry)
        // 2. OR mouse moved upward to reach the top (indicates user intent)
        const movedUpward = previousY > mouseY && previousY > 50;
        if (timeSinceMount >= 500 || movedUpward) {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI) {
            electronAPI.expandProfileWindow();
          }
          setIsVisible(true);
          if (collapseTimeout) clearTimeout(collapseTimeout);
        }
      } else if (!isOpen && mouseY > 150) {
        // Collapse if mouse moves down and dropdown is not open
        collapseTimeout = setTimeout(() => {
          setIsVisible(false);
          const electronAPI = (window as any).electronAPI;
          if (electronAPI) {
            electronAPI.collapseProfileWindow();
          }
        }, 800);
      }
    };

    // Add listeners to window
    window.addEventListener('mousemove', handleMouseMove);

    // Add listeners to container
    if (containerRef.current) {
      containerRef.current.addEventListener('mouseenter', handleMouseEnter);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (containerRef.current) {
        containerRef.current.removeEventListener('mouseenter', handleMouseEnter);
        containerRef.current.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (collapseTimeout) clearTimeout(collapseTimeout);
    };
  }, [isOpen]);

  // Keep window expanded and button visible when dropdown is open
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        electronAPI.expandProfileWindow();
      }
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Hide button after closing dropdown if mouse is not near top
        setTimeout(() => {
          const mouseY = event.clientY;
          if (mouseY > 150) {
            setIsVisible(false);
          }
        }, 200);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      className="w-full h-full flex items-start justify-center pt-4 relative"
      style={{ overflow: 'visible', minHeight: '100%' }}
      ref={containerRef}
    >
      <div
        className="relative transition-all duration-300 ease-out"
        style={{
          zIndex: 1000,
          overflow: 'visible',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(-20px)',
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
        ref={dropdownRef}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-8 py-4 bg-gradient-to-r from-red-800 to-red-900 text-white font-bold text-xl rounded-lg shadow-2xl hover:from-red-900 hover:to-red-950 transition-all duration-300 flex items-center gap-3 border-2 border-white/20 relative z-10"
          style={{ whiteSpace: 'nowrap' }}
        >
          {profilePictureUrl && !imageError ? (
            <img
              src={profilePictureUrl}
              alt={user.fullName || 'Profile'}
              className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
              onError={() => setImageError(true)}
            />
          ) : (
            <User className="w-6 h-6" />
          )}
          PROFILE
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 w-80 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-red-200 z-[100]"
            style={{
              position: 'absolute',
              minWidth: '320px',
              maxWidth: '320px',
              overflow: 'visible',
              display: 'block'
            }}
          >
            <div className="p-6" style={{ overflow: 'visible' }}>
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-red-200">
                {profilePictureUrl && !dropdownImageError ? (
                  <img
                    src={profilePictureUrl}
                    alt={user.fullName || 'Profile'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-red-300 flex-shrink-0"
                    onError={() => setDropdownImageError(true)}
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {user.fullName?.charAt(0).toUpperCase() || 'S'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-lg truncate">
                    {user.fullName || 'Student'}
                  </p>
                  <p className="text-sm text-slate-600 truncate">
                    {user.studentNumber || 'No student number'}
                  </p>
                  {user.course && (
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {user.course} {user.section ? `• ${user.section}` : ''}
                    </p>
                  )}
                </div>
              </div>


              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Monitoring Status:</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${monitoringStatus.is_extension_connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-xs text-slate-600">{monitoringStatus.is_extension_connected ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                {!monitoringStatus.is_extension_connected && user.role === 'student' && (
                  <p className="text-xs text-red-600 mt-1">
                    Please ensure the Chrome Extension is installed and active.
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

