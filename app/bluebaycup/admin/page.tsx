'use client'

import React, { useState, useEffect } from 'react'

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check authentication status
    // Replace this with your actual authentication check
    const checkAuth = async () => {
      // Example: check for session, token, etc.
      setIsLoading(false)
    }
    
    checkAuth()
  }, [])

  const handleLogin = () => {
    // Implement your login logic here
    setIsLoggedIn(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <p className="mb-4">Please log in to access the admin panel.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Admin Features */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">User Management</h2>
            <p className="text-gray-600">Manage users and permissions</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Content Management</h2>
            <p className="text-gray-600">Edit and publish content</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Analytics</h2>
            <p className="text-gray-600">View site statistics</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <p className="text-gray-600">Configure application settings</p>
          </div>
        </div>

        <button
          onClick={() => setIsLoggedIn(false)}
          className="mt-8 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
        >
          Log Out
        </button>
      </div>
    </div>
  )
}
