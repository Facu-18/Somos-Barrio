export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatRelative(date: string) {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days}d`
  return formatDate(date)
}

export function getCategoryLabel(category: string) {
  const map: Record<string, string> = {
    GASTRONOMIA: 'Gastronomía',
    SALUD: 'Salud',
    EDUCACION: 'Educación',
    SERVICIOS: 'Servicios',
    COMERCIO: 'Comercio',
    ENTRETENIMIENTO: 'Entretenimiento',
    TRANSPORTE: 'Transporte',
    OTROS: 'Otros',
    GENERAL: 'General',
    SEGURIDAD: 'Seguridad',
    CULTURA: 'Cultura',
    DEPORTES: 'Deportes',
    POLITICA: 'Política',
    ECONOMIA: 'Economía',
    VENTA: 'Venta',
    ALQUILER: 'Alquiler',
    BUSCO: 'Busco',
    REGALO: 'Regalo',
    INTERCAMBIO: 'Intercambio',
    SERVICIO: 'Servicio',
  }
  return map[category] ?? category
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'Ocurrió un error'
  }
  return 'Ocurrió un error'
}
