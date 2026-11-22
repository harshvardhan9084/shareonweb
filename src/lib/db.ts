import { PrismaClient } from '@prisma/client'

// Lazy Prisma client.
//
// The client is only constructed on first property access — and only ever
// accessed by the prisma session backend (DATABASE_URL set). This keeps the
// module safe to import on hosts where Prisma is not configured or the client
// has not been generated (e.g. a Vercel build using the relay session store).

type PrismaDb = InstanceType<typeof PrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaDb | undefined
}

function createClient(): PrismaDb {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set — the prisma session backend is unavailable. ' +
        'Configure RELAY_URL (hosted) or DATABASE_URL (self-hosted).',
    )
  }
  return new PrismaClient({
    log: ['query'],
  })
}

export const db = new Proxy({} as PrismaDb, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createClient()
    }
    const client = globalForPrisma.prisma
    const value = Reflect.get(client as object, prop)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

if (process.env.NODE_ENV !== 'production') {
  // Keep the memoized client across dev hot reloads.
  void globalForPrisma
}
