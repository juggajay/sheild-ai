// Twilio SMS integration
// Uses Twilio REST API for SMS delivery

export interface SmsOptions {
  to: string
  message: string
}

export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER
  return !!(accountSid && authToken && phoneNumber)
}

/**
 * Get Twilio configuration status
 */
export function getTwilioConfig(): { configured: boolean; fromNumber?: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !phoneNumber) {
    return { configured: false }
  }

  return {
    configured: true,
    fromNumber: phoneNumber
  }
}

/**
 * Send an SMS via Twilio
 */
export async function sendSms(options: SmsOptions): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  // Check for dev mode simulation
  if (process.env.NODE_ENV === 'development' && (!accountSid || accountSid === 'test' || accountSid.startsWith('AC_TEST'))) {
    console.log('[Twilio DEV] Would send SMS:', {
      to: options.to,
      from: fromNumber,
      message: options.message.substring(0, 50) + (options.message.length > 50 ? '...' : '')
    })
    return {
      success: true,
      messageId: `dev-sms-${Date.now()}`
    }
  }

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      error: 'Twilio credentials not configured'
    }
  }

  try {
    // Use Twilio REST API directly
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const formData = new URLSearchParams()
    formData.append('To', options.to)
    formData.append('From', fromNumber)
    formData.append('Body', options.message)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    const data = await response.json()

    if (response.ok) {
      console.log('[Twilio] SMS sent successfully:', {
        to: options.to,
        messageId: data.sid,
        status: data.status
      })

      return {
        success: true,
        messageId: data.sid
      }
    } else {
      console.error('[Twilio] Failed to send SMS:', data)
      return {
        success: false,
        error: data.message || 'Failed to send SMS'
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Twilio] Error sending SMS:', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Send a critical alert SMS
 */
export async function sendCriticalAlert(params: {
  phoneNumber: string
  subcontractorName: string
  projectName: string
  issue: string
}): Promise<SmsResult> {
  const { phoneNumber, subcontractorName, projectName, issue } = params

  const message = `CRITICAL ALERT - RiskShield AI

Subcontractor: ${subcontractorName}
Project: ${projectName}

Issue: ${issue}

Please take immediate action.`

  return sendSms({
    to: phoneNumber,
    message
  })
}

/**
 * Send an expiration warning SMS
 */
export async function sendExpirationWarningSms(params: {
  phoneNumber: string
  subcontractorName: string
  projectName: string
  expiryDate: string
  daysRemaining: number
}): Promise<SmsResult> {
  const { phoneNumber, subcontractorName, projectName, expiryDate, daysRemaining } = params

  const urgency = daysRemaining <= 7 ? 'URGENT' : 'REMINDER'

  const message = `${urgency}: ${subcontractorName}'s COC for ${projectName} expires ${expiryDate} (${daysRemaining} days). Please update immediately. - RiskShield AI`

  return sendSms({
    to: phoneNumber,
    message
  })
}

/**
 * Send a stop work risk SMS
 */
export async function sendStopWorkRiskSms(params: {
  phoneNumber: string
  subcontractorName: string
  projectName: string
  reason: string
}): Promise<SmsResult> {
  const { phoneNumber, subcontractorName, projectName, reason } = params

  const message = `STOP WORK RISK - ${subcontractorName} on ${projectName}: ${reason}. Immediate action required. - RiskShield AI`

  return sendSms({
    to: phoneNumber,
    message
  })
}
