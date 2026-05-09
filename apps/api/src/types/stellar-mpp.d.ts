declare module '@stellar/mpp/charge/client' {
  export const Mppx: {
    create(config: {
      polyfill?: boolean
      methods: unknown[]
      onChallenge?: (
        challenge: Record<string, unknown>,
        helpers: { createCredential: () => Promise<string> },
      ) => Promise<string | undefined>
    }): {
      fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
    }
  }

  export const stellar: {
    charge(config: {
      secretKey: string
      mode?: 'pull' | 'push'
      onProgress?: (event: Record<string, unknown>) => void
    }): unknown
  }
}
