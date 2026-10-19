import React, { useState } from 'react';
import { 
  AppNotification, 
  requestBrowserNotificationPermission, 
  sendWebPushNotification,
  playNotificationSound 
} from '../utils/notifications';
import { 
  Bell, 
  X, 
  Check, 
  Trash2, 
  AlertTriangle, 
  Zap, 
  Wrench, 
  Volume2, 
  Send, 
  CheckCircle2, 
  ShieldAlert,
  Flame,
  Clock,
  Sparkles
} from 'lucide-react';
import { Technician } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  permissionState: NotificationPermission;
  onPermissionChange: (state: NotificationPermission) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSimulateUrgentPush: () => void;
  technicians: Technician[];
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  permissionState,
  onPermissionChange,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSimulateUrgentPush,
  technicians,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'urgent' | 'unread'>('all');
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    const newPerm = await requestBrowserNotificationPermission();
    onPermissionChange(newPerm);
    setIsRequesting(false);

    if (newPerm === 'granted') {
      sendWebPushNotification('🔔 RUTECH Pro: Notificaciones Activadas', {
        body: 'A partir de ahora recibirás alertas de nuevos servicios y cambios urgentes en tu ruta.',
        tag: 'rutatech-welcome',
      });
    }
  };

  const handleTestChime = () => {
    playNotificationSound(false);
    sendWebPushNotification('🛠️ Prueba de Notificación Push', {
      body: 'Sistema de avisos funcionando correctamente para los técnicos.',
      tag: 'test-push',
    });
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'urgent') return n.priority === 'urgente';
    if (filterType === 'unread') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: AppNotification['type'], priority: AppNotification['priority']) => {
    if (priority === 'urgente' || type === 'urgent_change') {
      return (
        <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
          <Flame className="w-4 h-4 animate-bounce" />
        </div>
      );
    }
    if (type === 'new_assignment') {
      return (
        <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
          <Wrench className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'route_optimized') {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
          <Zap className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
        <AlertTriangle className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  Avisos
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500 text-white">
                    {unreadCount} sin leer
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Alertas automáticas en navegador para nuevos servicios asignados y cambios urgentes en ruta.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Web Push Permission Banner */}
        <div className="p-3 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              {permissionState === 'granted' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : permissionState === 'denied' ? (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Bell className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              )}
              <div>
                <span className="font-semibold text-slate-200">
                  Notificaciones de Navegador (Web Push):
                </span>{' '}
                <span className={
                  permissionState === 'granted'
                    ? 'text-emerald-400 font-bold'
                    : permissionState === 'denied'
                    ? 'text-rose-400'
                    : 'text-amber-400 font-medium'
                }>
                  {permissionState === 'granted'
                    ? '✓ Permiso Concedido'
                    : permissionState === 'denied'
                    ? 'Bloqueadas en navegador (Avisos sonoros locales activos)'
                    : 'Pendiente de activación'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {permissionState !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  disabled={isRequesting}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs shadow-xs cursor-pointer transition-colors"
                >
                  {isRequesting ? 'Solicitando...' : 'Activar avisos en este dispositivo'}
                </button>
              )}

              <button
                onClick={handleTestChime}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Probar sonido y notificación"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Probar</span>
              </button>

            </div>
          </div>
        </div>

        {/* Filters and Actions Toolbar */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('urgent')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                filterType === 'urgent' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Urgentes ({notifications.filter(n => n.priority === 'urgente').length})
            </button>
            <button
              onClick={() => setFilterType('unread')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                filterType === 'unread' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sin leer ({unreadCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-slate-600 hover:text-blue-600 font-medium cursor-pointer text-xs"
              >
                Marcar todas leídas
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                title="Borrar historial"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List Body */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 text-xs">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-semibold text-slate-700">Sin notificaciones en esta vista</h3>
              <p className="text-slate-400 text-xs mt-1">
                Los avisos de nuevos servicios asignados y cambios de ruta aparecerán aquí en tiempo real.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const tech = technicians.find(t => t.id === notification.technicianId);

              return (
                <div
                  key={notification.id}
                  onClick={() => onMarkAsRead(notification.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    !notification.read
                      ? notification.priority === 'urgente'
                        ? 'bg-rose-50/80 border-rose-300 shadow-xs'
                        : 'bg-blue-50/60 border-blue-200 shadow-xs'
                      : 'bg-white border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  {getNotificationIcon(notification.type, notification.priority)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {notification.title}
                        </span>
                        {notification.priority === 'urgente' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white">
                            URGENTE
                          </span>
                        )}
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {/^\d{4}-/.test(notification.timestamp) ? new Date(notification.timestamp).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : notification.timestamp}
                      </span>
                    </div>

                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {notification.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      {notification.technicianName && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          {tech && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: tech.color }}
                            />
                          )}
                          Para: <strong>{notification.technicianName}</strong>
                        </span>
                      )}

                      {notification.serviceCode && (
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {notification.serviceCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Las notificaciones Web Push alertan a los operarios en su ordenador o dispositivo móvil.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
