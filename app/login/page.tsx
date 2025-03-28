import type { Metadata } from "next"
import Link from "next/link"
import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "Login | Personal Finance Manager",
  description: "Login to your account",
}

export default function LoginPage() {
  return (
    <div className="container relative flex h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-primary" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Personal Finance Manager
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "This app has completely transformed how I manage my personal finances. I can now track my expenses and
              income with ease."
            </p>
            <footer className="text-sm">Sofia Davis</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Login to your account</h1>
            <p className="text-sm text-muted-foreground">Enter your email below to login to your account</p>
          </div>
          <LoginForm />
          <p className="px-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="underline underline-offset-4 hover:text-primary">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

