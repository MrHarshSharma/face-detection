# Global Authentication System

This project now features a global authentication system that can be used throughout the application.

## Components

### 1. AuthContext (`/contexts/AuthContext.tsx`)
The main authentication context that provides:
- User state management
- Login/logout functionality
- Persistent session handling
- Loading states

#### Usage:
```tsx
import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { user, isAuthenticated, login, logout, setShowLoginModal } = useAuth()
  
  // Your component logic
}
```

### 2. LoginModal (`/components/auth/LoginModal.tsx`)
A reusable login modal component that:
- Automatically shows when triggered
- Handles form validation
- Integrates with the global auth context
- Customizable title and subtitle

#### Usage:
```tsx
import LoginModal from '@/components/auth/LoginModal'

// Basic usage (uses default title/subtitle)
<LoginModal />

// Custom usage
<LoginModal 
  title="Custom Login Title"
  subtitle="Custom subtitle text"
/>
```

### 3. ProtectedRoute (`/components/auth/ProtectedRoute.tsx`)
A route guard component that:
- Automatically shows login modal for unauthenticated users
- Renders children only when authenticated
- Provides customizable fallback UI

#### Usage:
```tsx
import ProtectedRoute from '@/components/auth/ProtectedRoute'

function MyProtectedPage() {
  return (
    <ProtectedRoute 
      title="Access Required"
      subtitle="Please login to access this feature"
    >
      <div>Your protected content here</div>
    </ProtectedRoute>
  )
}
```

### 4. AuthHeader (`/components/auth/AuthHeader.tsx`)
A reusable header component that:
- Shows login/logout buttons
- Displays user information when logged in
- Optionally shows system status indicators

#### Usage:
```tsx
import AuthHeader from '@/components/auth/AuthHeader'

function MyPage() {
  return (
    <div>
      {/* Basic usage */}
      <AuthHeader />
      
      {/* With status indicator */}
      <AuthHeader 
        status={{
          isReady: mySystemReady,
          readyText: "System Ready",
          loadingText: "Loading System..."
        }}
      />
    </div>
  )
}
```

## Setup

### 1. Root Layout Integration
The `AuthProvider` is already integrated in the root layout (`/app/layout.tsx`):

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navigation />
          {children}
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  )
}
```

### 2. Authentication Flow
1. User visits a protected page
2. `ProtectedRoute` checks authentication status
3. If not authenticated, shows `LoginModal`
4. User logs in through the modal
5. Success redirects to protected content
6. Credentials are saved for auto-login

### 3. User Session Persistence
- Credentials are automatically saved to localStorage
- Users are auto-logged in on subsequent visits
- Session persists across browser refreshes
- Logout clears all saved data

## Migration from Page-Specific Auth

The find-person page has been updated to use the global system:

### Before:
```tsx
// Local authentication state
const [isAuthenticated, setIsAuthenticated] = useState(false)
const [showLoginModal, setShowLoginModal] = useState(true)
// ... more local auth state

// Local auth functions
const handleLogin = async (e) => { /* ... */ }
const handleLogout = () => { /* ... */ }

// Conditional rendering
{isAuthenticated && (
  <div>Protected content</div>
)}
```

### After:
```tsx
// Global authentication
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AuthHeader from '@/components/auth/AuthHeader'

function MyPage() {
  const { user, isAuthenticated } = useAuth()
  
  return (
    <ProtectedRoute>
      <AuthHeader />
      <div>Protected content always renders here</div>
    </ProtectedRoute>
  )
}
```

## Benefits

1. **Reusability**: Auth components can be used anywhere
2. **Consistency**: Same login experience across the app
3. **Maintainability**: Single source of truth for auth logic
4. **Scalability**: Easy to add new protected routes
5. **User Experience**: Persistent sessions and auto-login

## Database Integration

The system integrates with Supabase for user authentication:
- Users table stores credentials
- Real authentication validation
- Secure credential handling

## Future Enhancements

Potential improvements:
- JWT token-based authentication
- Role-based access control
- OAuth providers (Google, GitHub, etc.)
- Password reset functionality
- Email verification
- Multi-factor authentication 