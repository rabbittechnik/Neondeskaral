import type { Employee } from '../../types/employee'
import { createEmployeeId } from '../../lib/createEmployeeId'

export function employeeDefaults(): Omit<Employee, 'id'> {
  const today = new Date().toISOString().slice(0, 10)
  return {
    salutation: 'none',
    firstName: '',
    lastName: '',
    displayName: '',
    shortName: '',
    email: '',
    phone: '',
    mobilePhone: '',
    landlinePhone: '',
    birthday: '',
    personnelNumber: '',
    role: 'Verkäufer',
    employmentRole: 'Verkäufer',
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
    cashRegisterCardNumber: '',
    terminalEnabled: true,
    timeTrackingEnabled: true,
    timeTrackingMode: 'station_default',
    breakMode: 'station_default',
    mobilePunchMode: 'station_default',
    checkInMode: 'station_default',
    checkOutMode: 'station_default',
    employeeAppEnabled: true,
    payType: 'hourly',
    workDays: ['mo', 'di', 'mi', 'do', 'fr'],
    hideInPayroll: false,
    overtimeEnabled: false,
    overtimeStartDate: '',
    overtimeAutoCalculate: false,
    overtimeIncludeInReports: true,
    vacationStartEnabled: false,
    vacationStartDate: '',
    vacationAutoAverage13Weeks: false,
    useStationBreakSettings: true,
    ownBreakRuleEnabled: false,
    surchargeMode: 'none',
    nightSurchargeStart: '',
    nightSurchargeEnd: '',
    nightSurchargeAfterTwoHours: false,
    surchargeCalculationMode: 'higher',
    hideContactInAddressBook: false,
    showOnlyFirstNameInEmployeeApp: false,
    visibleInTeamSchedule: true,
    phoneVisibleToTeam: true,
    emailVisibleToTeam: true,
    preferredShiftTypes: [],
    preferredWorkDays: [],
    notPreferredWorkDays: [],
    canWorkWeekends: true,
    canWorkHolidays: true,
    planningNotes: '',
    weekdayAvailability: undefined,
    reserveEnabled: false,
    reserveConditions: {},
    preferredShiftPolicy: 'any',
    weekendDayPreference: 'either',
  }
}

export function emptyEmployee(): Employee {
  return { id: createEmployeeId(), ...employeeDefaults() }
}

export function mergeEmployeeFromApi(data: Partial<Employee> & { id: string }): Employee {
  const sal = (data.salutation ?? 'none') as Employee['salutation']
  return {
    ...emptyEmployee(),
    ...data,
    id: data.id,
    salutation: sal,
    workAreaIds: Array.isArray(data.workAreaIds) ? data.workAreaIds : ['kasse'],
    workDays:
      Array.isArray(data.workDays) && data.workDays.length > 0
        ? data.workDays
        : ['mo', 'di', 'mi', 'do', 'fr'],
    preferredShiftTypes: data.preferredShiftTypes ?? [],
    preferredWorkDays: data.preferredWorkDays ?? [],
    notPreferredWorkDays: data.notPreferredWorkDays ?? [],
    weekdayAvailability: data.weekdayAvailability,
    reserveEnabled: data.reserveEnabled ?? false,
    reserveConditions: data.reserveConditions ?? {},
    preferredShiftPolicy: data.preferredShiftPolicy ?? 'any',
    weekendDayPreference: data.weekendDayPreference ?? 'either',
    desiredShiftsPerMonth: data.desiredShiftsPerMonth,
    minShiftsPerMonth: data.minShiftsPerMonth,
    maxShiftsPerMonth: data.maxShiftsPerMonth,
    desiredWeekendsPerMonth: data.desiredWeekendsPerMonth,
    displayName:
      data.displayName?.trim() ||
      `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() ||
      'Mitarbeiter',
  }
}
