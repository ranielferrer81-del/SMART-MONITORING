import { useState, useEffect, useRef, useMemo } from 'react';
import { LogOut, User } from 'lucide-react';
import type { AuthenticatedUser } from '../api/client';
import { fetchMonitoringStatus } from '../api/client';
import { resolveProfilePictureUrl } from '../utils/profilePictureUrl';

type ProfileWidgetProps = {
    user: AuthenticatedUser;
    onLogout: () => void;
};

export default function ProfileWidget({ user, onLogout }: ProfileWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [dropdownImageError, setDropdownImageError] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Dragging state
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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
        return resolveProfilePictureUrl(user.profilePicture);
    }, [user.profilePicture]);

    // Reset image error when profile picture URL changes
    useEffect(() => {
        setImageError(false);
        setDropdownImageError(false);
    }, [profilePictureUrl]);

    // Handle mouse enter - enable mouse events
    const handleMouseEnter = () => {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI) {
            electronAPI.setIgnoreMouseEvents(false);
        }
    };

    // Handle mouse leave - disable mouse events (click-through)
    const handleMouseLeave = () => {
        if (!isDragging && !isOpen) {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
                electronAPI.setIgnoreMouseEvents(true, { forward: true });
            }
        }
    };

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        // Only start drag if clicking on the button itself, not the dropdown
        if (isOpen) return;

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Add global mouse move and mouse up listeners when dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragOffset]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
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
            className="fixed"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 1000,
                pointerEvents: 'auto'
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            ref={dropdownRef}
        >
            <button
                onMouseDown={handleMouseDown}
                onClick={(e) => {
                    // Only toggle dropdown if not dragging
                    if (!isDragging) {
                        setIsOpen(!isOpen);
                    }
                }}
                className="w-16 h-16 bg-gradient-to-r from-red-800 to-red-900 text-white font-bold rounded-full shadow-2xl hover:from-red-900 hover:to-red-950 transition-all duration-300 flex items-center justify-center border-2 border-white/20"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                {profilePictureUrl && !imageError ? (
                    <img
                        src={profilePictureUrl}
                        alt={user.fullName || 'Profile'}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <User className="w-8 h-8" />
                )}
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
    );
}
