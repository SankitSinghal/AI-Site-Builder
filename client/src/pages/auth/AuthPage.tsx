import { useParams } from "react-router-dom";
import { AuthView, AuthUIProvider } from "@daveyplate/better-auth-ui"; 
import { authClient } from "@/lib/auth-client"; 

export default function AuthPage() {
  const { pathname } = useParams();

  return (
    <main className="p-6 flex flex-col justify-center items-center h-[80vh]">
      {/* 1. Wrap the View in the Provider */}
      <AuthUIProvider authClient={authClient}>
        
        {/* 2. Remove authClievnt prop from here */}
        <AuthView 
          pathname={pathname} 
          classNames={{ base: 'bg-black/10 ring ring-indigo-900' }} 
        />
        
      </AuthUIProvider>
    </main>
  );
}