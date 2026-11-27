// Browser geolocation as a promise. Rejects with an Error carrying a Thai message.
const MESSAGES = {
  1: 'กรุณาอนุญาตให้เว็บเข้าถึงตำแหน่งที่ตั้ง และเปิด Location Services ของเครื่อง',
  2: 'ระบุตำแหน่งไม่ได้ กรุณาตรวจสอบ Wi-Fi/GPS แล้วลองอีกครั้ง',
  3: 'ระบุตำแหน่งไม่ทันเวลา กรุณาลองอีกครั้ง',
}

export function useGeolocation() {
  /** @returns {Promise<{lat:number,lng:number,accuracy:number}>} */
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!import.meta.client || !navigator.geolocation) return reject(new Error('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง'))
      // the API's own timeout does not run while the permission prompt is unanswered: cap the whole wait
      const guard = setTimeout(() => reject(new Error('ยังระบุตำแหน่งไม่ได้ กรุณากด "อนุญาต" ให้เว็บเข้าถึงตำแหน่งที่ตั้ง แล้วลองอีกครั้ง')), 20000)
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(guard); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }) },
        (err) => { clearTimeout(guard); reject(new Error(MESSAGES[err?.code] || MESSAGES[2])) },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )
    })
  }
  return { getPosition }
}
