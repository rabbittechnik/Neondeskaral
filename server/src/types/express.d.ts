declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        sub: string
        username: string
        displayName: string
        roleId: string
      }
    }
  }
}

export {}
