import type { Employee } from '../../types/employee'
import { createEmployeeId } from '../../data/mockEmployees'

export function emptyEmployee(): Employee {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: createEmployeeId(),
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phone: '',
    birthday: '',
    role: 'Verkäufer',
    employmentType: 'teilzeit',
    hourlyWage: 14,
    weeklyHours: 40,
    monthlyHours: 0,
    vacationDaysTotal: 28,
    vacationDaysUsed: 0,
    remainingVacationDays: 28,
    color: '#22d3ee',
    status: 'aktiv',
    workAreaIds: ['kasse'],
    startDate: today,
    notes: '',
  }
}
