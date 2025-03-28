"use client"

// Define the fetcher function in a client component
const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    const error = new Error("An error occurred while fetching the data.")
    error.info = await response.json()
    error.status = response.status
    throw error
  }
  return response.json()
}

export const swrConfig = {
  fetcher,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 0, // Disable automatic polling to prevent potential issues
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  shouldRetryOnError: true,
  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    // Only retry on 500 errors up to 3 times
    if (error.status === 404) return
    if (retryCount >= 3) return

    // Retry after 5 seconds
    setTimeout(() => revalidate({ retryCount }), 5000)
  },
}

