import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../store/auth'
import { getErrorMessage } from '../lib/utils'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Requerido'),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    try {
      const result = await authService.login(data)
      setAuth(result.user, result.accessToken)
      navigate('/')
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700">Somos Barrio</h1>
          <p className="text-gray-500 mt-1">Ingresá a tu cuenta</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Email"
              id="email"
              type="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Contraseña"
              id="password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            {serverError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full mt-1">
              Ingresar
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            ¿No tenés cuenta?{' '}
            <Link to="/register" className="text-green-700 font-medium hover:underline">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
