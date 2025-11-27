import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Notification } from '../types';
import { getNotifications, markAllNotificationsRead } from '../services/storageService';

interface Props {
    hasUnread: boolean;
    onRead: () => void;
}

const NotificationBell: React.FC<Props> = ({ hasUnread, onRead }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadNotifications = () => {
        setNotifications(getNotifications());
    };

    const handleToggle = () => {
        if (!isOpen) {
            loadNotifications();
        }
        setIsOpen(!isOpen);
    };

    const handleMarkRead = () => {
        markAllNotificationsRead();
        loadNotifications();
        onRead();
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={handleToggle}
                className="relative p-2 text-slate-300 hover:text-white transition-colors rounded-full hover:bg-slate-700"
            >
                <Bell size={24} />
                {hasUnread && (
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                        <h3 className="font-bold text-white text-sm">Notifications</h3>
                        <button 
                            onClick={handleMarkRead}
                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                            <CheckCheck size={14} /> Mark all read
                        </button>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                No notifications
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div key={notif.id} className={`p-3 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors ${!notif.read ? 'bg-slate-700/20' : ''}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                            notif.type === 'success' ? 'bg-green-500/20 text-green-400' :
                                            notif.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            {notif.type === 'success' ? 'Receive' : notif.type === 'warning' ? 'Send' : 'Info'}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {new Date(notif.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-medium text-slate-200 mb-0.5">{notif.title}</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">{notif.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;