import 'react-router'

declare module 'react-router' {
  interface RouteHandle {
    title?: string
  }
}
