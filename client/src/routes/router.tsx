import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { AccountPage } from '../pages/account/AccountPage'
import { BillingDocumentsPage } from '../pages/account/BillingDocumentsPage'
import { BillingPage } from '../pages/account/BillingPage'
import { DevicesPage } from '../pages/account/DevicesPage'
import { UsersPage } from '../pages/account/UsersPage'
import { AbsencesPage } from '../pages/absences/AbsencesPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { CalendarPage } from '../pages/calendar/CalendarPage'
import { AnnouncementsPage } from '../pages/communication/AnnouncementsPage'
import { ChatGroupsPage } from '../pages/communication/ChatGroupsPage'
import { ContactsPage } from '../pages/contacts/ContactsPage'
import { CountersPage } from '../pages/counters/CountersPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { DocumentsPage } from '../pages/documents/DocumentsPage'
import { EmployeesPage } from '../pages/employees/EmployeesPage'
import { HolidaysPage } from '../pages/holidays/HolidaysPage'
import { ListsPage } from '../pages/lists/ListsPage'
import { ModulesPage } from '../pages/modules/ModulesPage'
import { AbsenceReportsPage } from '../pages/reports/AbsenceReportsPage'
import { PayrollSchedulePage } from '../pages/reports/PayrollSchedulePage'
import { PayrollTimePage } from '../pages/reports/PayrollTimePage'
import { TaskReportsPage } from '../pages/reports/TaskReportsPage'
import { SchedulePage } from '../pages/schedule/SchedulePage'
import { AppearanceSettingsPage } from '../pages/settings/AppearanceSettingsPage'
import { EmailSettingsPage } from '../pages/settings/EmailSettingsPage'
import { GeneralSettingsPage } from '../pages/settings/GeneralSettingsPage'
import { StationsPage } from '../pages/stations/StationsPage'
import { TasksPage } from '../pages/tasks/TasksPage'
import { VacationBlocksPage } from '../pages/vacationBlocks/VacationBlocksPage'
import { WorkAreasPage } from '../pages/workAreas/WorkAreasPage'
import { SidebarProvider } from '../store/sidebar-context'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/',
    element: (
      <SidebarProvider>
        <AppLayout />
      </SidebarProvider>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
        handle: { title: 'Startseite' },
      },
      {
        path: 'communication/chat-groups',
        element: <ChatGroupsPage />,
        handle: { title: 'Chat-Gruppen' },
      },
      {
        path: 'communication/announcements',
        element: <AnnouncementsPage />,
        handle: { title: 'Mitteilungen' },
      },
      {
        path: 'schedule',
        element: <SchedulePage />,
        handle: { title: 'Schichtplan' },
      },
      {
        path: 'schichtplan',
        element: <SchedulePage />,
        handle: { title: 'Schichtplan' },
      },
      {
        path: 'absences',
        element: <AbsencesPage />,
        handle: { title: 'Abwesenheiten' },
      },
      {
        path: 'tasks',
        element: <TasksPage />,
        handle: { title: 'Aufgaben' },
      },
      {
        path: 'lists',
        element: <ListsPage />,
        handle: { title: 'Listen' },
      },
      {
        path: 'documents',
        element: <DocumentsPage />,
        handle: { title: 'Dokumente' },
      },
      {
        path: 'calendar',
        element: <CalendarPage />,
        handle: { title: 'Terminkalender' },
      },
      {
        path: 'contacts',
        element: <ContactsPage />,
        handle: { title: 'Kontakte' },
      },
      {
        path: 'counters',
        element: <CountersPage />,
        handle: { title: 'Zählerstände' },
      },
      {
        path: 'employees',
        element: <EmployeesPage />,
        handle: { title: 'Mitarbeiter' },
      },
      {
        path: 'work-areas',
        element: <WorkAreasPage />,
        handle: { title: 'Arbeitsbereiche' },
      },
      {
        path: 'vacation-blocks',
        element: <VacationBlocksPage />,
        handle: { title: 'Urlaubssperren' },
      },
      {
        path: 'holidays',
        element: <HolidaysPage />,
        handle: { title: 'Feiertage' },
      },
      {
        path: 'reports/payroll-time',
        element: <PayrollTimePage />,
        handle: { title: 'Lohnabrechnung (Zeiterfassung)' },
      },
      {
        path: 'reports/payroll-schedule',
        element: <PayrollSchedulePage />,
        handle: { title: 'Lohnabrechnung (Schichtplan)' },
      },
      {
        path: 'reports/tasks',
        element: <TaskReportsPage />,
        handle: { title: 'Auswertung Aufgaben' },
      },
      {
        path: 'reports/absences',
        element: <AbsenceReportsPage />,
        handle: { title: 'Auswertung Abwesenheiten' },
      },
      {
        path: 'settings/general',
        element: <GeneralSettingsPage />,
        handle: { title: 'Einstellungen · Allgemein' },
      },
      {
        path: 'settings/email',
        element: <EmailSettingsPage />,
        handle: { title: 'E-Mail-Benachrichtigungen' },
      },
      {
        path: 'settings/appearance',
        element: <AppearanceSettingsPage />,
        handle: { title: 'Ansicht / Darstellung' },
      },
      {
        path: 'account',
        element: <AccountPage />,
        handle: { title: 'Mein Konto' },
      },
      {
        path: 'account/devices',
        element: <DevicesPage />,
        handle: { title: 'Geräte & Apps' },
      },
      {
        path: 'account/users',
        element: <UsersPage />,
        handle: { title: 'Benutzer verwalten' },
      },
      {
        path: 'account/billing',
        element: <BillingPage />,
        handle: { title: 'Rechnungen' },
      },
      {
        path: 'account/billing-documents',
        element: <BillingDocumentsPage />,
        handle: { title: 'Abrechnungsunterlagen' },
      },
      {
        path: 'stations',
        element: <StationsPage />,
        handle: { title: 'Stationen verwalten' },
      },
      {
        path: 'modules',
        element: <ModulesPage />,
        handle: { title: 'Module verwalten' },
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
