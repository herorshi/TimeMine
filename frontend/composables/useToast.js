let id = 0
/** const toast = useToast(); toast.success('บันทึกแล้ว'); toast.error(apiError(e)) */
export function useToast() {
  const items = useState('toasts', () => [])
  const push = (type, message, ms = 3500) => {
    const t = { id: ++id, type, message }
    items.value.push(t)
    setTimeout(() => { items.value = items.value.filter((x) => x.id !== t.id) }, ms)
  }
  return { items, success: (m) => push('success', m), error: (m) => push('error', m, 5000), info: (m) => push('info', m), warning: (m) => push('warning', m, 5000) }
}
