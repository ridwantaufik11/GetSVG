// Replace with your Gumroad product ID from the dashboard URL:
// https://app.gumroad.com/products/<product_id>/edit
export const GUMROAD_PRODUCT_ID = 'YOUR_GUMROAD_PRODUCT_ID'

export type GumroadError = 'invalid' | 'refunded' | 'network'

export interface GumroadResult {
  valid: boolean
  email?: string
  error?: GumroadError
}

export async function verifyLicenseKey(licenseKey: string): Promise<GumroadResult> {
  try {
    const body = new URLSearchParams({
      product_id: GUMROAD_PRODUCT_ID,
      license_key: licenseKey.trim(),
      increment_uses_count: 'false',
    })
    const res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      body,
    })
    if (!res.ok) return { valid: false, error: 'network' }
    const json = await res.json()
    if (!json.success) return { valid: false, error: 'invalid' }
    if (json.purchase?.refunded || json.purchase?.chargebacked) {
      return { valid: false, error: 'refunded' }
    }
    return { valid: true, email: json.purchase?.email }
  } catch {
    return { valid: false, error: 'network' }
  }
}
