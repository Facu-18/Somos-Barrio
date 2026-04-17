import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { authService } from '../services/auth.service'
import { barriosService } from '../services/barrios.service'
import { useAuthStore } from '../store/auth'
import { getErrorMessage } from '../lib/utils'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  barrioSlug: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const { data: barrios = [] } = useQuery({
    queryKey: ['barrios'],
    queryFn: barriosService.list,
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    try {
      const result = await authService.register(data)
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
          <p className="text-gray-500 mt-1">Creá tu cuenta</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Nombre"
              id="name"
              placeholder="Tu nombre"
              error={errors.name?.message}
              {...register('name')}
            />
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
              placeholder="Mínimo 8 caracteres"
              error={errors.password?.message}
              {...register('password')}
            />

            {barrios.length > 0 && (
              <Select
                label="Tu barrio (opcional)"
                id="barrioSlug"
                options={[
                  { value: '', label: 'Seleccioná tu barrio' },
                  ...barrios.map((b) => ({ value: b.slug, label: b.name })),
                ]}
                {...register('barrioSlug')}
              />
            )}

            {serverError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full mt-1">
              Crear cuenta
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-green-700 font-medium hover:underline">
              Ingresá
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
