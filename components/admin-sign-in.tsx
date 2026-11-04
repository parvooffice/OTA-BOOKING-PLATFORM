"use client";

import { SignIn } from "@clerk/nextjs";

export function AdminSignIn() {
  return <main className="grid min-h-[100svh] place-items-center bg-paper px-5 py-12"><div><p className="mb-5 text-center font-display text-2xl">Odisha Retreat · Host desk</p><SignIn routing="hash" signUpUrl="/404" /></div></main>;
}
