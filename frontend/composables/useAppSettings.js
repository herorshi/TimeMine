// Company settings (GET /settings), fetched once and shared. refresh() after saving settings.
export function useAppSettings() {
  const settings = useState('app-settings', () => null)
  const loading = useState('app-settings-loading', () => false)
  async function refresh() {
    loading.value = true
    try { settings.value = (await useApi().get('/settings')).data } finally { loading.value = false }
    return settings.value
  }
  if (!settings.value && !loading.value && import.meta.client) refresh().catch(() => {})
  /** 'none' | 'yellow' | 'red' for a number of late minutes */
  const lateLevel = (minutes) => {
    const m = Number(minutes || 0)
    if (m <= 0) return 'none'
    const red = Number(settings.value?.late_red_min ?? 30)
    const yellow = Number(settings.value?.late_yellow_min ?? 1)
    if (m >= red) return 'red'
    if (m >= yellow) return 'yellow'
    return 'none'
  }
  return { settings, refresh, lateLevel }
}
