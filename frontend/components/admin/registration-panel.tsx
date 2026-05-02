"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RegisterForm } from "@/components/auth/register-form"
import { UserPlus, GraduationCap, UserCheck } from "lucide-react"

export function RegistrationPanel() {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <CardHeader className="px-7 pt-7 pb-0">
        <CardTitle className="flex items-center gap-3 text-lg font-semibold text-slate-900">
          <UserPlus size={18} color="#6366f1" /> User Registration
        </CardTitle>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Register students and teachers with optional face enrollment and smart validation.
        </p>
      </CardHeader>
      <CardContent className="px-7 pb-7 pt-6">
        <Tabs defaultValue="student">
          <TabsList className="mb-5 flex flex-wrap gap-3">
            <TabsTrigger value="student" className="flex items-center gap-2">
              <GraduationCap size={14} /> Student
            </TabsTrigger>
            <TabsTrigger value="teacher" className="flex items-center gap-2">
              <UserCheck size={14} /> Teacher
            </TabsTrigger>
          </TabsList>
          <TabsContent value="student"><RegisterForm userType="student" /></TabsContent>
          <TabsContent value="teacher"><RegisterForm userType="teacher" /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
