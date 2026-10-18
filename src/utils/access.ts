import { createContext, useContext } from 'react';

/**
 * Who is using the app. Office staff edit everything; technicians use the whole app (start route,
 * report delays and in situ reports, their own availability) but cannot change the jobs themselves.
 */
export type Access =
  | { role: 'oficina'; email?: string }
  | { role: 'tecnico'; email: string; technicianId: string };

export const AccessContext = createContext<Access>({ role: 'oficina' });

export const useAccess = () => useContext(AccessContext);

export const READ_ONLY_MESSAGE = 'Solo la oficina puede modificar tareas y técnicos';

// Fields a technician may change on one of their own jobs
export const TECHNICIAN_EDITABLE_FIELDS = ['status', 'estimatedDuration', 'inSituReport', 'manualOrder'];
