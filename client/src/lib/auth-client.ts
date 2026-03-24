import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    // Make sure this matches the variable name in your .env file
    baseURL: import.meta.env.VITE_BASEURL || "http://localhost:3000",
})